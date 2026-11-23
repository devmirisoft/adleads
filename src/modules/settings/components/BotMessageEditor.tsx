'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Button,
  FormActions,
  FormField,
  SectionCard,
  Textarea,
  toast,
} from '@/modules/core/components';
import {
  BOT_MESSAGES,
  botMessageSchema,
  type BotMessageInput,
  type BotMessageKey,
} from '../constants/messages';
import { saveBotMessageAction } from '../services/actions';

/** One fixed bot reply on the Bot script page. */
export function BotMessageEditor({
  messageKey,
  text,
}: {
  messageKey: BotMessageKey;
  text: string;
}) {
  const def = BOT_MESSAGES[messageKey];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BotMessageInput>({
    resolver: zodResolver(botMessageSchema),
    defaultValues: { key: messageKey, text },
  });
  const id = `msg-${messageKey}`;

  async function onSubmit(values: BotMessageInput) {
    const res = await saveBotMessageAction(values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${def.title} message saved`);
    reset(values);
  }

  return (
    <SectionCard title={def.title} description={def.when}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          id={id}
          label="Message the bot sends"
          required
          help={
            def.vars.length
              ? `You can use ${def.vars.map((v) => `{${v}}`).join(' ')}`
              : 'Sent exactly as written.'
          }
          error={errors.text?.message}
        >
          <Textarea id={id} rows={4} aria-invalid={!!errors.text} {...register('text')} />
        </FormField>
        <FormActions>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save changes
          </Button>
        </FormActions>
      </form>
    </SectionCard>
  );
}
