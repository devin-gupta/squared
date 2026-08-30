import type { TransactionParsed } from "@/types/transaction";

export const CURRENCIES = [
  ["USD", "US dollar"],
  ["INR", "Indian rupee"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["CAD", "Canadian dollar"],
  ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"],
  ["CHF", "Swiss franc"],
  ["CNY", "Chinese yuan"],
  ["HKD", "Hong Kong dollar"],
  ["SGD", "Singapore dollar"],
  ["THB", "Thai baht"],
  ["VND", "Vietnamese dong"],
  ["IDR", "Indonesian rupiah"],
  ["KRW", "South Korean won"],
  ["NZD", "New Zealand dollar"],
  ["MXN", "Mexican peso"],
  ["BRL", "Brazilian real"],
  ["AED", "UAE dirham"],
  ["SAR", "Saudi riyal"],
  ["ZAR", "South African rand"],
  ["TRY", "Turkish lira"],
  ["SEK", "Swedish krona"],
  ["NOK", "Norwegian krone"],
  ["DKK", "Danish krone"],
  ["PLN", "Polish złoty"],
  ["CZK", "Czech koruna"],
  ["HUF", "Hungarian forint"],
  ["MYR", "Malaysian ringgit"],
  ["PHP", "Philippine peso"],
  ["ILS", "Israeli shekel"],
] as const;

export interface CurrencyQuote {
  currency: string;
  rate: number; // USD per unit of the original currency
  date: string;
  provider: "Frankfurter";
}

export interface CurrencyConversion {
  original_currency: string;
  original_amount: number;
  rate: number;
  rate_date: string;
  provider: "Frankfurter";
}

export function normalizeCurrency(value: string | undefined): string {
  const currency = (value ?? "USD").trim().toUpperCase();
  if (!CURRENCIES.some(([code]) => code === currency)) {
    throw new Error("Choose a supported currency before saving this expense.");
  }
  return currency;
}

export function currencyAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function validateQuote(
  value: CurrencyQuote,
  currency: string,
  now = Date.now(),
): CurrencyQuote {
  if (
    value.currency !== currency ||
    value.provider !== "Frankfurter" ||
    !Number.isFinite(value.rate) ||
    value.rate <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
  ) {
    throw new Error("The exchange rate is unavailable. Please try again.");
  }
  const date = Date.parse(value.date + "T00:00:00Z");
  if (
    !Number.isFinite(date) ||
    date > now + 86400000 ||
    now - date > 7 * 86400000
  ) {
    throw new Error(
      "The exchange rate is out of date. Please try again later.",
    );
  }
  return value;
}

function decimal(value: number): [bigint, bigint] {
  const [coefficient, exponent = "0"] = value
    .toString()
    .toLowerCase()
    .split("e");
  const places = (coefficient.split(".")[1]?.length || 0) - Number(exponent);
  const numerator = BigInt(coefficient.replace(".", ""));
  return places >= 0
    ? [numerator, BigInt(10) ** BigInt(places)]
    : [numerator * BigInt(10) ** BigInt(-places), BigInt(1)];
}

function exactCents(amount: number, rate: number): [bigint, bigint] {
  const [a, b] = decimal(amount);
  const [c, d] = decimal(rate);
  return [a * c * BigInt(100), b * d];
}

export function usdAmount(amount: number, rate: number): number {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(rate) ||
    amount < 0 ||
    rate <= 0
  )
    throw new Error("Enter a valid amount and exchange rate.");
  const [numerator, denominator] = exactCents(amount, rate);
  // Round positive amounts half-up, matching PostgreSQL NUMERIC rounding.
  return (
    Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2))) /
    100
  );
}

// Distribute rounding cents by fractional remainder. The converted allocations
// must sum to the converted total, including receipts with discount line items.
function convertParts(
  amounts: number[],
  originalTotal: number,
  rate: number,
  usdCents: number,
): number[] {
  if (
    !amounts.length ||
    amounts.some((amount) => !Number.isFinite(amount)) ||
    Math.abs(amounts.reduce((sum, amount) => sum + amount, 0) - originalTotal) >
      0.005
  ) {
    throw new Error(
      "The receipt items or custom shares must add up to the original expense amount.",
    );
  }
  const exact = amounts.map((amount) => exactCents(amount, rate));
  const floors = exact.map(
    ([numerator, denominator]) =>
      numerator / denominator -
      (numerator < BigInt(0) && numerator % denominator !== BigInt(0)
        ? BigInt(1)
        : BigInt(0)),
  );
  const rounded = floors.map(Number);
  if (rounded.some((amount) => !Number.isSafeInteger(amount)))
    throw new Error("The converted allocations are too large.");
  const remaining = usdCents - rounded.reduce((sum, amount) => sum + amount, 0);
  if (remaining < 0 || remaining > amounts.length)
    throw new Error("Check the expense allocations before converting.");
  const order = exact
    .map(([numerator, denominator], index) => ({
      index,
      fraction: numerator - floors[index] * denominator,
      denominator,
    }))
    .sort((a, b) => {
      const difference =
        b.fraction * a.denominator - a.fraction * b.denominator;
      return difference > BigInt(0)
        ? 1
        : difference < BigInt(0)
          ? -1
          : a.index - b.index;
    });
  for (let index = 0; index < remaining; index++) rounded[order[index].index]++;
  return rounded.map((amount) => amount / 100);
}

export function convertExpense(
  parsed: TransactionParsed,
  quote: CurrencyQuote,
): TransactionParsed & { currency_conversion: CurrencyConversion } {
  const currency = normalizeCurrency(parsed.currency);
  validateQuote(quote, currency);
  if (!Number.isFinite(parsed.total_amount) || parsed.total_amount <= 0)
    throw new Error("Enter a valid expense amount.");
  const usdCents = Math.round(usdAmount(parsed.total_amount, quote.rate) * 100);
  if (!Number.isSafeInteger(usdCents) || usdCents < 1 || usdCents > 9999999999)
    throw new Error(
      "The converted amount must be between USD 0.01 and USD 99,999,999.99.",
    );
  const lines = parsed.line_items?.length
    ? convertParts(
        parsed.line_items.map((item) => item.amount),
        parsed.total_amount,
        quote.rate,
        usdCents,
      )
    : undefined;
  if (parsed.adjustments?.some((share) => share.amount < 0))
    throw new Error("Custom shares can’t be negative.");
  const shares =
    parsed.split_type === "custom" && !lines
      ? convertParts(
          (parsed.adjustments || []).map((share) => share.amount),
          parsed.total_amount,
          quote.rate,
          usdCents,
        )
      : undefined;
  return {
    ...parsed,
    currency: "USD",
    total_amount: usdCents / 100,
    line_items: lines
      ? parsed.line_items!.map((item, index) => ({
          ...item,
          amount: lines[index],
        }))
      : parsed.line_items,
    adjustments: shares
      ? parsed.adjustments!.map((share, index) => ({
          ...share,
          amount: shares[index],
        }))
      : undefined,
    currency_conversion: {
      original_currency: currency,
      original_amount: parsed.total_amount,
      rate: quote.rate,
      rate_date: quote.date,
      provider: quote.provider,
    },
  };
}
