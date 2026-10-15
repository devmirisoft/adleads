const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** 299900 → "₹2,999.00". Amounts are integer paise everywhere. */
export function formatMoney(paise: number): string {
  return inr.format(paise / 100);
}
