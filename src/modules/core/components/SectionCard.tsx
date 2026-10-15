import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({ title, description, actions, children }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {actions && <CardAction className="flex gap-2">{actions}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
