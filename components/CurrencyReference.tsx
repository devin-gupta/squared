import {
  currencyAmount,
  type CurrencyConversion,
} from "@/lib/currency/convert";

export default function CurrencyReference({
  conversion,
}: {
  conversion: CurrencyConversion;
}) {
  return (
    <p className="rounded-xl bg-[#edf1e9] p-3 text-xs leading-relaxed text-[#5e6b5f]">
      Originally{" "}
      {currencyAmount(conversion.original_amount, conversion.original_currency)}
      . Converted at 1 {conversion.original_currency} = {conversion.rate} USD{" "}
      using the {conversion.rate_date} {conversion.provider} reference rate.
    </p>
  );
}
