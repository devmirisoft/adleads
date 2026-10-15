'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  Label,
  Switch,
  toast,
} from '@/modules/core/components';
import { formatPhone, normalizePhone } from '@/modules/core/utils';
import { useChatPolling } from '../hooks/useChatPolling';
import { buildMetaPayload, type SimulatedInbound } from '../utils/metaPayload';
import { ChatBubble } from './ChatBubble';

type Props = { recent: { phone: string; name: string }[] };

const SIM_AD = { adId: '120210000000001', headline: 'Spoken English – Reel 1' };
const randomPhone = () => `+919${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

/**
 * Dev-only stand-in for a lead's phone. Every action becomes a real Meta-shaped webhook
 * POSTed to /api/dev/whatsapp-inbound; bot replies are read back from the messages table.
 */
export function WhatsAppSimulator({ recent }: Props) {
  const [phoneInput, setPhoneInput] = useState(recent[0]?.phone ?? randomPhone());
  const [name, setName] = useState(recent[0]?.name ?? 'Rahul Sharma');
  const [fromAd, setFromAd] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const phone = normalizePhone(phoneInput);
  const { messages, refresh } = useChatPolling(
    phone ? `/api/dev/whatsapp-messages?phone=${encodeURIComponent(phone)}` : null,
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send(message: SimulatedInbound) {
    if (!phone) return toast.error('Enter a valid phone number first.');
    setSending(true);
    try {
      const payload = buildMetaPayload({
        waId: phone.slice(1),
        profileName: name || 'WhatsApp user',
        message,
        referral: fromAd ? { ...SIM_AD, ctwaClid: `ctwa_sim_${phone.slice(-6)}` } : undefined,
      });
      const res = await fetch('/api/dev/whatsapp-inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as { failed?: string[]; error?: string };
      if (!res.ok) toast.error(result.error ?? 'The webhook was rejected.');
      else if (result.failed?.length) toast.error(`Bot error: ${result.failed.join('; ')}`);
      await refresh();
    } catch {
      toast.error('Could not reach the dev server.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Lead&apos;s phone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField
            id="sim-phone"
            label="Phone number"
            required
            help={phone ? formatPhone(phone) : undefined}
            error={phone ? undefined : 'Enter a mobile number, e.g. 98123 45678'}
          >
            <Input
              id="sim-phone"
              value={phoneInput}
              aria-invalid={!phone}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </FormField>
          <FormField id="sim-name" label="WhatsApp profile name">
            <Input id="sim-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="sim-ad" checked={fromAd} onCheckedChange={setFromAd} />
            <Label htmlFor="sim-ad">Came from an ad (adds a referral)</Label>
          </div>
          <Button variant="outline" onClick={() => setPhoneInput(randomPhone())}>
            <RefreshCw className="size-4" aria-hidden />
            New number
          </Button>
          {recent.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Recent chats</span>
              {recent.map((r) => (
                <Button
                  key={r.phone}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setPhoneInput(r.phone);
                    setName(r.name);
                  }}
                >
                  {r.name} · {formatPhone(r.phone)}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {name || 'WhatsApp user'} {phone && `· ${formatPhone(phone)}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-96 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No messages yet"
              description="Say hi to start the bot, the way a lead from an ad would."
              action={<Button onClick={() => send({ kind: 'text', text: 'Hi' })}>Send “Hi”</Button>}
            />
          ) : (
            messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                self="IN"
                onTap={sending ? undefined : (c) => send(c)}
              />
            ))
          )}
          <div ref={bottom} />
        </CardContent>
        <CardFooter>
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void send({ kind: 'text', text: text.trim() });
              setText('');
            }}
          >
            <Input
              aria-label="Message"
              placeholder="Type a message"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={sending || !phone}
            >
              <Send className="size-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
