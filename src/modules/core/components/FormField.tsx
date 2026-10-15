import { Label } from './ui/label';

type Props = {
  /** Must match the control's `id`. Give the control `aria-invalid={!!error}` so it shows the error state. */
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  /** e.g. `errors.name?.message` from react-hook-form. */
  error?: string;
  children: React.ReactNode;
};

export function FormField({ id, label, required, help, error, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {help && !error && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
