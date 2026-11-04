import { CopyButton } from './CopyButton';
import { formatPhone } from '../utils/phone';

/** E.164 → "+91 98123 45678" with a copy button. */
export function Phone({ e164 }: { e164: string }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {formatPhone(e164)}
      <CopyButton value={e164} label="phone number" />
    </span>
  );
}
