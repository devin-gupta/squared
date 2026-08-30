// Normalize a printed TOTAL, never dates, booking IDs, unit prices or FX rates.
// The raw source stays separate from the model's numeric interpretation.
export function printedAmount(text: string, currency: string): number | null {
  const tokens = text.match(/[-+]?\d[\d.,'’\u00a0\u202f ]*/g);
  if (tokens?.length !== 1) return null;
  const token = tokens[0].trim();
  // Spaces/apostrophes must form proper groups, not concatenate unrelated digits.
  if (
    /[ '’\u00a0\u202f]/.test(token) &&
    !/^[-+]?\d{1,3}(?:[ '’\u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(token)
  )
    return null;
  const compact = token.replace(/[ '’\u00a0\u202f]/g, "");
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    /* unknown currency: require ordinary decimal precision */
  }
  const parse = (value: string) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  };
  if (/^[-+]?\d+$/.test(compact)) return parse(compact);
  if (compact.includes(".") && compact.includes(",")) {
    const decimal =
      compact.lastIndexOf(".") > compact.lastIndexOf(",") ? "." : ",";
    const grouping = decimal === "." ? "," : ".";
    const [whole, fraction, extra] = compact.split(decimal);
    if (
      extra !== undefined ||
      !/^\d+$/.test(fraction) ||
      (fraction.length > digits && !/^0+$/.test(fraction))
    )
      return null;
    const groups = whole.replace(/^[-+]/, "").split(grouping);
    if (
      !/^\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((group) => !/^\d{3}$/.test(group))
    )
      return null;
    return parse(whole.split(grouping).join("") + "." + fraction);
  }
  const groups = compact.split(/[.,]/);
  if (
    groups.length === 2 &&
    /^\d{1,2}$/.test(groups[1]) &&
    (groups[1].length <= digits || /^0+$/.test(groups[1]))
  )
    return parse(groups.join("."));
  if (
    digits < 3 &&
    /^[-+]?[1-9]\d{0,2}$/.test(groups[0]) &&
    groups.slice(1).every((group) => /^\d{3}$/.test(group))
  )
    return parse(groups.join(""));
  // A single 3-digit separator in a 3-decimal currency is ambiguous.
  return null;
}
