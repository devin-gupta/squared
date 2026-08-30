import { invitePath } from "./invite";

export function generateShareUrl(
  inviteCode: string,
  tripName?: string,
): string {
  if (typeof window === "undefined") {
    return "";
  }
  const path = invitePath(inviteCode, tripName);
  if (!path) return "";
  const url = new URL(path, window.location.origin);
  return url.toString();
}

export async function shareTrip(
  inviteCode: string,
  tripName: string,
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const shareUrl = generateShareUrl(inviteCode, tripName);
  if (!shareUrl) return "failed";

  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share({
        // Link only. The page supplies the trip name and invitation copy.
        url: shareUrl,
      });
      return "shared";
    } catch (error) {
      // Cancelling a share must not unexpectedly overwrite the clipboard.
      if ((error as Error).name === "AbortError") return "cancelled";
      // A denied/failed share can lose its user gesture. Offer an explicit
      // copy button instead of assuming a subsequent clipboard write will work.
      return "failed";
    }
  }

  return (await copyToClipboard(shareUrl)) ? "copied" : "failed";
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
