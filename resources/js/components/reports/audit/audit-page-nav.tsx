import React from 'react';
import { Calendar, History, UserCheck } from 'lucide-react';

export interface AuditPageNavProps {
    activeChapterId: number;
    onChapterSwitch: (chapterId: number) => void;
}

export function AuditPageNav({ activeChapterId, onChapterSwitch }: AuditPageNavProps) {
    const isPage1 = activeChapterId === 0 || activeChapterId === -101;
    const isPage2 = activeChapterId === -102;
    const isPage3 = activeChapterId === -103;

    const pages = [
        {
            id: -101,
            title: '1. Audit Details',
            subtitle: 'Scope, Types, Dates & Operations',
            icon: Calendar,
            isActive: isPage1,
        },
        {
            id: -102,
            title: '2. People & Crew',
            subtitle: 'Auditors & Auditees Register',
            icon: UserCheck,
            isActive: isPage2,
        },
        {
            id: -103,
            title: '3. Previous Audit',
            subtitle: 'Prior NCs, Observations & Follow-up',
            icon: History,
            isActive: isPage3,
        },
    ];

    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-lg border bg-muted/30">
            {pages.map((p) => {
                const Icon = p.icon;
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onChapterSwitch(p.id)}
                        className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-all ${
                            p.isActive
                                ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80 ring-1 ring-primary/20'
                                : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
                        }`}
                    >
                        <div
                            className={`size-7 rounded-md flex items-center justify-center shrink-0 ${
                                p.isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-xs truncate leading-tight font-medium">
                                {p.title}
                            </span>
                            <span className="block text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                {p.subtitle}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
