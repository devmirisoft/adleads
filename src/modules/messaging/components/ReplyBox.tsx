'use client';

import { useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  Button,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@/modules/core/components';
import type { TemplateName } from '../constants/templates';
import { sendReply, sendTemplateReply } from '../services/actions';

export type TemplateOption = { name: TemplateName; preview: string; vars: Record<string, string> };

type Props = {
  leadId: string;
  /** Lead wrote within the last 24 h: free-form allowed. */
  windowOpen: boolean;
  optedOut: boolean;
  /** Templates whose variables could be filled from this lead's data. */
  templates: TemplateOption[];
};

export function ReplyBox({ leadId, windowOpen, optedOut, templates }: Props) {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<TemplateName | ''>('');
  const [pending, start] = useTransition();

  if (optedOut) {
    return (
      <p className="text-sm text-muted-foreground">This lead opted out. We can’t message them.</p>
    );
  }

  const send = (run: () => Promise<{ ok: boolean; error?: string }>, done: () => void) =>
    start(async () => {
      const res = await run();
      if (res.ok) {
        toast.success('Message sent');
        done();
      } else toast.error(res.error);
    });

  const chosen = templates.find((t) => t.name === template);

  return (
    <div className="flex flex-col gap-3">
      {windowOpen ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(
              () => sendReply(leadId, text),
              () => setText(''),
            );
          }}
        >
          <FormField id="reply" label="Reply">
            <Textarea id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !text.trim()}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          More than 24 hours since they last wrote, so WhatsApp only allows an approved template.
        </p>
      )}
      {templates.length > 0 && (
        <div className="flex flex-col gap-3">
          <FormField id="template" label={windowOpen ? 'Or send a template' : 'Template'}>
            <Select value={template} onValueChange={(v) => setTemplate(v as TemplateName)}>
              <SelectTrigger id="template" className="w-full">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {chosen && <p className="rounded-lg bg-muted p-3 text-sm">{chosen.preview}</p>}
          <div className="flex justify-end">
            <Button
              variant={windowOpen ? 'outline' : 'default'}
              disabled={pending || !chosen}
              onClick={() =>
                chosen &&
                send(
                  () => sendTemplateReply(leadId, chosen.name, chosen.vars),
                  () => setTemplate(''),
                )
              }
            >
              Send template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
