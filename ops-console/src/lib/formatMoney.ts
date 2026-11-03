export function formatMoney(amountMinor: number, currency: string): string {
  const amount = (amountMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${currency}`;
}
