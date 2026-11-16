import { requireRole } from '@/modules/auth';
import { CoursesTable, listCourses } from '@/modules/batches';
import { listQuestions, QuestionEditor, scriptPreview } from '@/modules/bot';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/core/components';
import { BotMessageEditor, getBotMessages, type BotMessageKey } from '@/modules/settings';

/** Replies that aren't part of the normal booking flow. */
const OTHER_REPLIES: BotMessageKey[] = [
  'msg_link_changed',
  'msg_no_seats',
  'msg_waitlist',
  'msg_link_coming',
  'msg_trial_used',
  'msg_handed_over',
  'msg_stuck',
];

export default async function ScriptPage() {
  await requireRole('ADMIN');
  const [questions, courses, messages, preview] = await Promise.all([
    listQuestions(),
    listCourses(),
    getBotMessages(),
    scriptPreview(),
  ]);
  const message = (key: BotMessageKey) => (
    <BotMessageEditor key={key} messageKey={key} text={messages[key]} />
  );

  return (
    <>
      <PageHeader
        title="Bot script"
        description="Everything the WhatsApp bot says, in the order a lead sees it"
      />
      <Tabs defaultValue="conversation">
        <TabsList>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="other">Other replies</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>
        <TabsContent value="conversation" className="mt-4 flex flex-col gap-6">
          {message('welcome_text')}
          {questions.map((q) => (
            <QuestionEditor
              key={q.id}
              question={q}
              preview={q.key === 'course' || q.key === 'batch' ? preview[q.key] : undefined}
            />
          ))}
          {message('msg_seat_booked')}
          {message('msg_trial_link')}
          {message('msg_paid_link')}
        </TabsContent>
        <TabsContent value="other" className="mt-4 flex flex-col gap-6">
          {OTHER_REPLIES.map(message)}
        </TabsContent>
        <TabsContent value="courses" className="mt-4">
          <CoursesTable courses={courses} />
        </TabsContent>
      </Tabs>
    </>
  );
}
