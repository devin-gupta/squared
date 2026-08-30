import { normalizeInvite } from "../auth/preferences";

export function generateShareUrl(inviteCode: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  const code = normalizeInvite(inviteCode);
  if (!code) return "";
  const url = new URL(`/trip/${code}`, window.location.origin);
  return url.toString();
}

export async function shareTrip(
  inviteCode: string,
  tripName: string,
): Promise<boolean> {
  const shareUrl = generateShareUrl(inviteCode);
  if (!shareUrl) return false;

  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Join ${tripName} on Squared`,
        // Let Messages display the URL's rich preview without an extra copy
        // of the code or a long text block. The code is already in the URL.
        url: shareUrl,
      });
      return true;
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
      return false;
    }
  }

  return false;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy:", error);
    return false;
  }
}
