export function normalizeVenmoUsername(input: string): string | null {
  const username = input.trim().replace(/^@/, "");
  return /^[A-Za-z0-9_-]{1,64}$/.test(username) ? username : null;
}

export function venmoLinks(
  username: string,
  action: "pay" | "charge",
  amount: number,
  note: string,
) {
  const handle = normalizeVenmoUsername(username);
  if (!handle || !Number.isFinite(amount) || amount <= 0)
    throw new Error("Enter a valid Venmo username and payment amount.");
  const query = new URLSearchParams({
    txn: action,
    recipients: handle,
    amount: amount.toFixed(2),
    note,
  });
  // Personal-payment deep links are best effort: Venmo may change support.
  // Always keep a profile fallback and require confirmation inside Venmo.
  return {
    app: `venmo://paycharge?${query.toString()}`,
    profile: `https://venmo.com/u/${encodeURIComponent(handle)}`,
  };
}
