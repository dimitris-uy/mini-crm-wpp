/**
 * Returns a human-readable relative time string in Spanish from an epoch-ms timestamp.
 * e.g. "ahora", "hace 5 min", "hace 3 h", "hace 2 dias"
 */
export function timeAgo(epochMs: number): string {
  const seconds = Math.floor((Date.now() - epochMs) / 1000);

  if (seconds < 60) return 'ahora';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} dias`;

  const weeks = Math.floor(days / 7);
  if (days < 30) return `hace ${weeks} sem`;

  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} meses`;

  const years = Math.floor(months / 12);
  return `hace ${years} a`;
}

const MONTH_NAMES_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Formats an ISO date string (YYYY-MM-DD) into a readable Spanish format.
 * Returns "6 may" for current year, "6 may 2025" for other years.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const currentYear = new Date().getFullYear();

  const monthName = MONTH_NAMES_ES[month - 1];

  if (year === currentYear) {
    return `${day} ${monthName}`;
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Formats a phone string with + prefix, or returns "Desconocido".
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return 'Desconocido';
  return phone.startsWith('+') ? phone : `+${phone}`;
}
