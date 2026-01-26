'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  ClipboardList,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserCircle,
  Trophy,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { ChatNotificationProvider } from '@/components/chat-notification-provider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { label: 'Fiverr Accounts', href: '/admin/fiverr-accounts', icon: Building2 },
  { label: 'Developer Tiers', href: '/admin/developer-tiers', icon: Trophy },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const managerNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
  { label: 'Projects', href: '/manager/projects', icon: FolderKanban },
];

const teamLeadNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/team-lead', icon: LayoutDashboard },
  { label: 'Projects', href: '/team-lead/projects', icon: FolderKanban },
];

const developerNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/developer', icon: LayoutDashboard },
  { label: 'Tasks', href: '/developer/tasks', icon: FolderKanban },
];

const designerNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/designer', icon: LayoutDashboard },
  { label: 'Assets', href: '/designer/assets', icon: FolderKanban },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isInitialized, user, logout, initialize } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const getNavItems = () => {
    switch (user.role) {
      case 'ADMIN':
        return adminNavItems;
      case 'MANAGER':
        return managerNavItems;
      case 'TEAM_LEAD':
        return teamLeadNavItems;
      case 'DEVELOPER':
        return developerNavItems;
      case 'DESIGNER':
        return designerNavItems;
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const isActive = (href: string) => {
    if (href === '/admin' || href === '/manager' || href === '/team-lead' || href === '/developer' || href === '/designer') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const getRoleBadgeClass = (role: string) => {
    const classes: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      TEAM_LEAD: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      DEVELOPER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      DESIGNER: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ChatNotificationProvider>
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <span className="font-bold text-lg">CodeReve</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-modern">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive(item.href) && (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </a>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t space-y-2">
            <a
              href="/profile"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(false)}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', getRoleBadgeClass(user.role))}
                >
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notification Bell */}
              <NotificationBell userRole={user.role} />

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="p-4 lg:p-6">{children}</main>

        {/* Footer */}
        <footer className="border-t py-4 px-4 lg:px-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} CodeReve. Internal Use Only.</p>
            <p>v1.0.0</p>
          </div>
        </footer>
      </div>

      {/* Toast notifications */}
      <Toaster richColors position="top-right" />
    </div>
    </ChatNotificationProvider>
  );
}
