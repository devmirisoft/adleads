import { requireRole } from '@/modules/auth';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/core/components';
import { getAllSettings, listUsers, SettingsForm, UsersTable } from '@/modules/settings';

export default async function SettingsPage() {
  const me = await requireRole('ADMIN');
  const [settings, users] = await Promise.all([getAllSettings(), listUsers()]);

  return (
    <>
      <PageHeader title="Settings" description="Trial rules, bot messages and staff accounts" />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <SettingsForm settings={settings} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTable users={users} currentUserId={me.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}
