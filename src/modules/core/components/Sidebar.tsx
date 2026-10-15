'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../utils/cn';
import type { Role } from '../types';

export type ShellUser = { name: string; email: string; role: Role };

type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[] };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/batches', label: 'Batches', icon: CalendarDays },
  { href: '/enrollments', label: 'Enrollments', icon: GraduationCap },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/script', label: 'Bot script', icon: Bot, roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', SALES: 'Sales', VIEWER: 'Viewer' };

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <MessageCircle className="size-4 text-primary" aria-hidden />
      AdLeads
    </span>
  );
}

type Props = {
  user: ShellUser;
  unreadCount?: number;
  signOutAction?: () => Promise<void>;
  /** Called after a nav link is clicked (closes the mobile sheet). */
  onNavigate?: () => void;
};

/** Sidebar contents: logo, role-filtered nav, user menu. Used by AdminShell only. */
export function Sidebar({ user, unreadCount = 0, signOutAction, onNavigate }: Props) {
  const pathname = usePathname();
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="px-2 py-1">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {NAV.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                active
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.href === '/inbox' && unreadCount > 0 && (
                <Badge className="ml-auto rounded-full" aria-label={`${unreadCount} unread`}>
                  {unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto justify-start gap-3 px-2 py-2">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col items-start">
              <span className="truncate text-sm">{user.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!signOutAction} onSelect={() => void signOutAction?.()}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
