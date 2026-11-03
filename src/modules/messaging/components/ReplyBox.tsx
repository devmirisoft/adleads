'use client';

import { useRef, useState } from 'react';
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
import type { TemplateName } from '../constants/templates';

export type TemplateOption = { name: TemplateName; preview: string; vars: Record<string, string> };

const TYPING_EVERY_MS = 20_000; // Meta's indicator lasts 25 s

type Props = {
  /** Lead wrote within the last 24 h: free-form allowed. */
  windowOpen: boolean;
  optedOut: boolean;
  /** Templates whose variables could be filled from this lead's data. */
  templates: TemplateOption[];
  onSendText: (text: string) => void;
  onSendTemplate: (template: TemplateOption) => void;
  onTyping: () => void;
};

/** The composer. Sends never block it: the bubble appears in the thread, so it's ready for the next one. */
export function ReplyBox({
  windowOpen,
  optedOut,
  templates,
  onSendText,
  onSendTemplate,
  onTyping,
}: Props) {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<TemplateName | ''>('');
  const input = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  if (optedOut) {
    return (
      <p className="text-sm text-muted-foreground">This lead opted out. We can’t message them.</p>
    );
  }

  const chosen = templates.find((t) => t.name === template);

  function submit() {
    const reply = text.trim();
    if (!reply) return;
    setText('');
    onSendText(reply);
    input.current?.focus(); // clicking Send moved focus to the button
  }

  return (
    <div className="flex flex-col gap-3">
      {windowOpen ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField id="reply" label="Reply" help="Enter sends. Shift+Enter starts a new line.">
            <Textarea
              id="reply"
              ref={input}
              rows={2}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim() && Date.now() - lastTyping.current > TYPING_EVERY_MS) {
                  lastTyping.current = Date.now();
                  onTyping();
                }
              }}
              onKeyDown={(e) => {
                // isComposing: Enter is confirming a word in a Hindi or other IME, not sending.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={!text.trim()}>
              <Send className="size-4" aria-hidden />
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm" role="status">
          Customer hasn’t messaged in 24h — send a template
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
                onSendTemplate(chosen);
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
