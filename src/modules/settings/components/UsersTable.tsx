'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MoreHorizontal, Plus, UserCog } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateTime,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  toast,
  type DataTableColumn,
} from '@/modules/core/components';
import type { Role } from '@/modules/core/types';
import { newUserSchema, ROLE_LABEL, type NewUser } from '../constants/keys';
import { addUserAction, setUserActiveAction, setUserRoleAction } from '../services/actions';
import type { UserListItem } from '../services/users';

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const ROLE_HELP: Record<Role, string> = {
  ADMIN: 'Everything, including batches, bot script, settings and users',
  SALES: 'Works leads, enrollments and payments',
  VIEWER: 'Read-only',
};

function RoleSelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value?: Role;
  onChange: (r: Role) => void;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]} — {ROLE_HELP[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewUser>({ resolver: zodResolver(newUserSchema) });

  async function onSubmit(values: NewUser) {
    const res = await addUserAction(values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${values.name} can now sign in`);
    reset();
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add user
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Share the password with them privately; they sign in with their email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <FormField id="u-name" label="Name" required error={errors.name?.message}>
              <Input id="u-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField id="u-email" label="Email" required error={errors.email?.message}>
              <Input
                id="u-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </FormField>
            <FormField id="u-role" label="Role" required error={errors.role?.message}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    id="u-role"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.role}
                  />
                )}
              />
            </FormField>
            <FormField
              id="u-password"
              label="Password"
              required
              help="At least 10 characters"
              error={errors.password?.message}
            >
              <Input
                id="u-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Add user
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowActions({ user, me }: { user: UserListItem; me: string }) {
  const [dialog, setDialog] = useState<'role' | 'deactivate' | null>(null);
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  if (user.id === me) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('role')}>Change role</DropdownMenuItem>
          {user.isActive ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('deactivate')}>
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={async () => {
                const res = await setUserActiveAction(user.id, true);
                if (res.ok) toast.success(`${user.name} can sign in again`);
                else toast.error(res.error);
              }}
            >
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog === 'role'} onOpenChange={(o) => setDialog(o ? 'role' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change {user.name}&apos;s role</DialogTitle>
            <DialogDescription>Takes effect on their next page load.</DialogDescription>
          </DialogHeader>
          <FormField id={`role-${user.id}`} label="Role" required>
            <RoleSelect id={`role-${user.id}`} value={role} onChange={setRole} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={saving || role === user.role}
              onClick={async () => {
                setSaving(true);
                const res = await setUserRoleAction(user.id, role);
                setSaving(false);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${user.name} is now ${ROLE_LABEL[role]}`);
                setDialog(null);
              }}
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={(o) => setDialog(o ? 'deactivate' : null)}
        tone="danger"
        title={`Deactivate ${user.name}?`}
        description="They are signed out and can't sign in again until reactivated. Their past actions stay in the history."
        confirmLabel="Deactivate"
        onConfirm={async () => {
          const res = await setUserActiveAction(user.id, false);
          if (res.ok) toast.success(`${user.name} deactivated`);
          else toast.error(res.error);
        }}
      />
    </>
  );
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserListItem[];
  currentUserId: string;
}) {
  const columns: DataTableColumn<UserListItem>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row: { original: u } }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {u.name}
            {u.id === currentUserId && ' (you)'}
          </span>
          <span className="text-xs text-muted-foreground">{u.email}</span>
        </div>
      ),
    },
    { id: 'role', header: 'Role', cell: ({ row }) => ROLE_LABEL[row.original.role] },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      id: 'added',
      header: 'Added',
      cell: ({ row }) => <DateTime value={row.original.createdAt} />,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions user={row.original} me={currentUserId} />,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AddUserDialog />
      </div>
      <DataTable
        columns={columns}
        data={users}
        total={users.length}
        page={1}
        pageSize={Math.max(users.length, 1)}
        emptyState={<EmptyState icon={UserCog} title="No users" />}
      />
    </div>
  );
}
