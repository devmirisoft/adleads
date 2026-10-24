import { MessageCircle } from 'lucide-react';
import { Button } from '@/modules/core/components';
import { whatsappUrl } from '../constants/site';

type Props = {
  children?: React.ReactNode;
  size?: 'lg' | 'xl';
  variant?: 'default' | 'secondary';
  className?: string;
};

/** Every WhatsApp call to action on the public site. */
export function WhatsAppButton({
  children = 'Chat on WhatsApp',
  size = 'xl',
  variant = 'default',
  className,
}: Props) {
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <MessageCircle data-icon="inline-start" aria-hidden />
        {children}
      </a>
    </Button>
  );
}
