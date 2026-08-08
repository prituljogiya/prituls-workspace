/** Normalize billing month input to YYYY-MM or null. */
export function normalizeBillingMonth(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  // Accept full date ISO / YYYY-MM-DD → take year-month
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return null;
}

export function formatBillingMonth(billingMonth?: string | null): string | null {
  const ym = normalizeBillingMonth(billingMonth);
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function currentBillingMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
