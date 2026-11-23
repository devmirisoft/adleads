'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { Logo, Sidebar, UserMenu, type ShellUser } from './Sidebar';

type Props = {
  user: ShellUser;
  /** Inbox nav badge. */
  unreadCount?: number;
  /** Server action that signs the user out. */
  signOutAction?: () => Promise<void>;
  children: React.ReactNode;
};

/** App frame. Owns page padding and max width — pages never set their own. */
export function AdminShell({ user, unreadCount = 0, signOutAction, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = { user, unreadCount, signOutAction };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border lg:block">
        <Sidebar {...sidebar} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 grid grid-cols-3 items-center border-b border-border bg-background px-4 py-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Sidebar {...sidebar} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="justify-self-center">
            <Logo />
          </span>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link
                href="/inbox"
                aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox'}
                className="relative"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 size-2 rounded-full bg-danger" />
                )}
              </Link>
            </Button>
            <UserMenu user={user} signOutAction={signOutAction} compact />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
