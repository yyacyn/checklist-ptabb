import { Link, usePage } from '@inertiajs/react';
import React from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { dashboard } from '@/routes';
import type { BreadcrumbItem as BreadcrumbItemType, User } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage();
    const user = (page.props as { auth?: { user?: User } }).auth?.user;

    return (
        <>
            {/* Mobile Top Header (md:hidden) */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border/60 bg-background/95 backdrop-blur-sm px-4 sticky top-0 z-30 md:hidden">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Link href={dashboard()} className="flex items-center gap-2 shrink-0" aria-label="Go to Dashboard">
                        <div className="size-8 rounded-md bg-white p-0.5 border border-border/40 overflow-hidden shadow-2xs flex items-center justify-center">
                            <AppLogoIcon className="size-full object-contain" />
                        </div>
                    </Link>
                    {breadcrumbs.length > 0 ? (
                        <div className="min-w-0 truncate text-xs">
                            <Breadcrumbs breadcrumbs={breadcrumbs} />
                        </div>
                    ) : (
                        <span className="font-semibold text-sm truncate text-foreground">
                            Checklist & Inspection
                        </span>
                    )}
                </div>

                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center justify-center rounded-full ring-offset-background transition-opacity hover:opacity-80 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                aria-label="Open user menu"
                            >
                                <Avatar className="size-8 shrink-0 border border-border/60">
                                    <AvatarImage src={user.avatar} alt={user.name} />
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                        {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" side="bottom">
                            <UserMenuContent user={user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </header>

            {/* Desktop Header (hidden md:flex) */}
            {breadcrumbs.length > 0 && (
                <header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
                    <div className="flex items-center gap-2">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </header>
            )}
        </>
    );
}
