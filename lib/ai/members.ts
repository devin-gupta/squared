import type { TransactionParsed } from "./schemas";

function comparableName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]/g, "");
}

export function canonicalMemberName(
  value: string | undefined,
  memberNames: string[],
): string | undefined {
  if (!value) return undefined;
  const wanted = comparableName(value);
  if (!wanted) return undefined;
  const exact = memberNames.find((name) => comparableName(name) === wanted);
  if (exact) return exact;
  if (wanted.length < 3) return undefined;
  const partial = memberNames.filter((name) => {
    const candidate = comparableName(name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  return partial.length === 1 ? partial[0] : undefined;
}

export function canonicalizeParsedMembers(
  parsed: TransactionParsed,
  memberNames: string[],
): TransactionParsed {
  const payer = canonicalMemberName(parsed.payer_name, memberNames);
  return {
    ...parsed,
    ...(payer ? { payer_name: payer } : {}),
    adjustments: parsed.adjustments?.map((share) => ({
      ...share,
      user_name:
        canonicalMemberName(share.user_name, memberNames) || share.user_name,
    })),
    line_items: parsed.line_items?.map((item) => ({
      ...item,
      split_among: item.split_among?.map(
        (name) => canonicalMemberName(name, memberNames) || name,
      ),
    })),
  };
}
