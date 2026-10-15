import { requireRole } from '@/modules/auth';
import { CoursesTable, listCourses } from '@/modules/batches';
import { listQuestions, QuestionEditor } from '@/modules/bot';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/core/components';

export default async function ScriptPage() {
  await requireRole('ADMIN');
  const [questions, courses] = await Promise.all([listQuestions(), listCourses()]);

  return (
    <>
      <PageHeader
        title="Bot script"
        description="What the WhatsApp bot asks, and the courses it offers"
      />
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Bot questions</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4 flex flex-col gap-6">
          {questions.map((q) => (
            <QuestionEditor key={q.id} question={q} />
          ))}
        </TabsContent>
        <TabsContent value="courses" className="mt-4">
          <CoursesTable courses={courses} />
        </TabsContent>
      </Tabs>
    </>
  );
}
