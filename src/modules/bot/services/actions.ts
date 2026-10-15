'use server';
import 'server-only';
import { z } from 'zod';
import { ADMIN_ONLY, guarded } from '@/modules/auth';
import type { QuestionUpdate } from '../types';
import { updateQuestion } from './script';

export async function saveQuestionAction(questionId: string, input: QuestionUpdate) {
  return guarded(ADMIN_ONLY, async () => {
    await updateQuestion(z.uuid().parse(questionId), input);
    return null;
  });
}
