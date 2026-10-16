import { Link, usePage } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    BookOpen,
    ClipboardList,
    LayoutGrid,
    ShieldAlert,
    User as UserIcon,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

interface MobileNavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    isActive: (url: string) => boolean;
}

export function AppMobileNav() {
    const page = usePage();
    const user = (page.props as { auth?: { user?: { role?: string } } }).auth?.user;
    const isSuperadmin = user?.role === 'superadmin';
    const currentUrl = page.url;

    const navItems: MobileNavItem[] = [
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutGrid,
            isActive: (url: string) => url === '/dashboard' || url.startsWith('/dashboard?'),
        },
        {
            title: 'Reports',
            href: '/reports',
            icon: ClipboardList,
            isActive: (url: string) => url.startsWith('/reports'),
        },
        {
            title: 'Findings',
            href: '/findings',
            icon: ShieldAlert,
            isActive: (url: string) => url.startsWith('/findings'),
        },
        ...(isSuperadmin
            ? [
                  {
                      title: 'Forms',
                      href: '/admin/forms',
                      icon: BookOpen,
                      isActive: (url: string) => url.startsWith('/admin/forms'),
                  },
                  {
                      title: 'Accounts',
                      href: '/admin/users',
                      icon: Users,
                      isActive: (url: string) =>
                          url.startsWith('/admin/users') || url.startsWith('/admin/vessel'),
                  },
              ]
            : [
                  {
                      title: 'Account',
                      href: '/settings/profile',
                      icon: UserIcon,
                      isActive: (url: string) => url.startsWith('/settings'),
                  },
              ]),
    ];

    return (
        <nav
            aria-label="Mobile Navigation"
            data-test="mobile-bottom-nav"
            className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        >
            <div className="flex h-15 w-full items-center justify-around px-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive(currentUrl);

                    return (
                        <Link
                            key={typeof item.href === 'string' ? item.href : item.title}
                            href={item.href}
                            prefetch
                            className={cn(
                                'flex flex-1 flex-col items-center justify-center py-1 px-0.5 min-w-0 transition-colors duration-150 select-none',
                                active
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground active:text-primary'
                            )}
                        >
                            <div
                                className={cn(
                                    'relative flex items-center justify-center rounded-full px-3 py-1 transition-all',
                                    active && 'bg-primary/10'
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'size-5 transition-transform',
                                        active ? 'stroke-[2.5] scale-105' : 'stroke-[1.75]'
                                    )}
                                />
                            </div>
                            <span
                                className={cn(
                                    'text-[10px] leading-tight tracking-tight truncate max-w-full mt-0.5',
                                    active ? 'font-semibold' : 'font-medium'
                                )}
                            >
                                {item.title}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
