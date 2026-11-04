'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import {
  Button,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/modules/core/components';
import type { ApiResult } from '@/modules/core/types';
import type { TemplateName } from '../constants/templates';
import { sendReply, sendTemplateReply } from '../services/actions';
import type { ChatMessage } from '../types';

export type TemplateOption = { name: TemplateName; preview: string; vars: Record<string, string> };

/** Shows `draft` in the thread now and runs the send with its id. `restore` refills the input if it's refused. */
export type SendMessage = (
  draft: Pick<ChatMessage, 'type' | 'templateName' | 'body'>,
  run: (messageId: string) => Promise<ApiResult<ChatMessage>>,
  restore: () => void,
) => void;

type Props = {
  leadId: string;
  /** Lead wrote within the last 24 h: free-form allowed. */
  windowOpen: boolean;
  optedOut: boolean;
  /** Templates whose variables could be filled from this lead's data. */
  templates: TemplateOption[];
  onSend: SendMessage;
};

export function ReplyBox({ leadId, windowOpen, optedOut, templates, onSend }: Props) {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<TemplateName | ''>('');

  if (optedOut) {
    return (
      <p className="text-sm text-muted-foreground">This lead opted out. We can’t message them.</p>
    );
  }

  const chosen = templates.find((t) => t.name === template);

  return (
    <div className="flex flex-col gap-3">
      {windowOpen ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reply = text;
            setText('');
            onSend(
              { type: 'TEXT', templateName: null, body: { text: reply.trim() } },
              (messageId) => sendReply(leadId, reply, messageId),
              () => setText((typed) => typed || reply),
            );
          }}
        >
          <FormField id="reply" label="Reply">
            <Textarea id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={!text.trim()}>
              <Send className="size-4" aria-hidden />
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
              disabled={!chosen}
              onClick={() => {
                if (!chosen) return;
                setTemplate('');
                onSend(
                  { type: 'TEMPLATE', templateName: chosen.name, body: { text: chosen.preview } },
                  (messageId) => sendTemplateReply(leadId, chosen.name, chosen.vars, messageId),
                  () => setTemplate(chosen.name),
                );
              }}
            >
              Send template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
