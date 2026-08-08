/** Format YYYY-MM as "March 2026" for UI. */
export function formatBillingMonthLabel(billingMonth?: string | null): string | null {
  if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) return null;
  const [y, m] = billingMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return billingMonth;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function currentBillingMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
