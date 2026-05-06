/**
 * Returns a human-readable relative time string from an epoch-ms timestamp.
 * e.g. "just now", "5 minutes ago", "3 hours ago", "2 days ago"
 */
export function timeAgo(epochMs: number): string {
  const seconds = Math.floor((Date.now() - epochMs) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a readable format.
 * Returns "May 6" for current year, "May 6, 2025" for other years.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const currentYear = new Date().getFullYear();

  const monthName = date.toLocaleString('en-US', { month: 'short' });

  if (year === currentYear) {
    return `${monthName} ${day}`;
  }
  return `${monthName} ${day}, ${year}`;
}

/**
 * Formats a phone string with + prefix, or returns "Unknown".
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown';
  return phone.startsWith('+') ? phone : `+${phone}`;
}
