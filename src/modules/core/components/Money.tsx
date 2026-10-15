import { formatMoney } from '../utils/money';

/** Integer paise → "₹2,999.00". */
export function Money({ paise }: { paise: number }) {
  return <span className="tabular-nums">{formatMoney(paise)}</span>;
}
