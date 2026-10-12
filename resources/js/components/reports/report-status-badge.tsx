import React from 'react';
import { Badge } from '@/components/ui/badge';

export function ReportStatusBadge({ status, className = '' }: { status: string; className?: string }) {
    switch (status) {
        case 'draft':
            return (
                <Badge variant="secondary" className={`font-medium capitalize ${className}`}>
                    Draft
                </Badge>
            );
        case 'in_progress':
            return (
                <Badge
                    variant="outline"
                    className={`border-sky-500/40 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-medium ${className}`}
                >
                    In Progress
                </Badge>
            );
        case 'submitted':
            return (
                <Badge
                    variant="outline"
                    className={`border-emerald-600/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-medium ${className}`}
                >
                    Submitted
                </Badge>
            );
        case 'reviewed':
            return (
                <Badge
                    variant="outline"
                    className={`border-indigo-500/40 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 font-medium ${className}`}
                >
                    Reviewed
                </Badge>
            );
        case 'closed':
            return (
                <Badge
                    variant="outline"
                    className={`border-slate-500/40 bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 font-medium ${className}`}
                >
                    Closed
                </Badge>
            );
        case 'reopened':
            return (
                <Badge variant="destructive" className={`font-medium ${className}`}>
                    Reopened
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className={`font-medium capitalize ${className}`}>
                    {status.replace('_', ' ')}
                </Badge>
            );
    }
}
