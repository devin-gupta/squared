export function generateShareUrl(inviteCode: string): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return `${window.location.origin}/?code=${inviteCode}`
}

export async function shareTrip(inviteCode: string, tripName: string): Promise<boolean> {
  const shareUrl = generateShareUrl(inviteCode)
  const shareText = `Join my trip "${tripName}" on Squared! Use code: ${inviteCode}`

  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Join ${tripName}`,
        text: shareText,
        url: shareUrl,
      })
      return true
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error)
      }
      return false
    }
  }

  return false
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy:', error)
    return false
  }
}
