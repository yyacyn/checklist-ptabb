import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    CloudOff,
    FileDown,
    Loader2,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Trash2,
    Users,
    WifiOff,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReportStatusBadge } from './report-status-badge';
import type { QueueSyncState } from '@/lib/autosave-queue';
import { formatDate } from '@/lib/question-utils';
import type { LockData, ReportData } from '@/types';

export interface ReportHeaderProps {
    report: ReportData;
    globalSyncState: QueueSyncState;
    isOffline: boolean;
    pendingQueueCount: number;
    isFlushingQueue: boolean;
    onTriggerManualQueueFlush: () => void;
    overallStats: {
        totalApplicable: number;
        totalAnswered: number;
        percent: number;
    };
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    showUnansweredOnly: boolean;
    onToggleUnansweredOnly: () => void;
    canDelete?: boolean;
    onDeleteClick?: () => void;
    lockState: LockData | null;
    onAcquireLock: (takeOver?: boolean) => void;
    isEditable?: boolean;
}

export function ReportHeader({
    report,
    globalSyncState,
    isOffline,
    pendingQueueCount,
    isFlushingQueue,
    onTriggerManualQueueFlush,
    overallStats,
    searchQuery,
    onSearchQueryChange,
    showUnansweredOnly,
    onToggleUnansweredOnly,
    canDelete,
    onDeleteClick,
    lockState,
    onAcquireLock,
    isEditable = true,
}: ReportHeaderProps) {
    return (
        <>
            {/* Top Sticky Header */}
            <header className="border-b bg-card px-4 sm:px-6 py-2.5 shrink-0 z-30">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Navigation & Document Identification */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <Link href="/reports">
                                <ArrowLeft className="size-4 mr-1.5" />
                                <span className="text-xs font-medium">All Reports</span>
                            </Link>
                        </Button>

                        <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-sm text-foreground truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                                    {report.vessel_name}
                                </h2>
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0">
                                    {report.reference_number}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-medium">
                                    {report.form.code}
                                </Badge>
                                <ReportStatusBadge status={report.status} className="text-[10px] px-1.5 py-0 shrink-0" />
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                                Inspection Date: {formatDate(report.report_date)} • {report.form.code} v{report.template_version}
                            </p>
                        </div>
                    </div>

                    {/* Right: Progress, Sync, Tools & Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Global Save / Sync Status */}
                        <div className="flex items-center">
                            {globalSyncState === 'saved' && (
                                <span
                                    className="text-xs text-muted-foreground flex items-center gap-1.5"
                                    title="All checklist changes saved"
                                >
                                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    <span className="hidden xl:inline text-[11px] font-medium">Saved</span>
                                </span>
                            )}
                            {globalSyncState === 'saving' && (
                                <span
                                    className="text-xs text-muted-foreground flex items-center gap-1.5"
                                    title="Saving change to server..."
                                >
                                    <Loader2 className="size-3.5 text-primary animate-spin" />
                                    <span className="hidden xl:inline text-[11px] font-medium">Saving...</span>
                                </span>
                            )}
                            {globalSyncState === 'retrying' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    onClick={onTriggerManualQueueFlush}
                                    disabled={isFlushingQueue}
                                    className="h-7 text-xs border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 flex items-center gap-1 px-2"
                                    title="Temporary VSAT drop or offline. Click to retry syncing immediately."
                                >
                                    <CloudOff className="size-3 text-amber-500" />
                                    <span className="text-[11px]">{pendingQueueCount} queued</span>
                                    <RefreshCw className={`size-3 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                                </Button>
                            )}
                            {isOffline && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                                    <WifiOff className="size-3" /> Offline
                                </Badge>
                            )}
                        </div>

                        <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

                        {/* Overall Progress */}
                        <div
                            className="flex items-center gap-2"
                            title={`Progress: ${overallStats.totalAnswered} of ${overallStats.totalApplicable} answered (${overallStats.percent}%)`}
                        >
                            <div className="w-16 sm:w-24 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${overallStats.percent}%` }}
                                />
                            </div>
                            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                {overallStats.totalAnswered}/{overallStats.totalApplicable} ({overallStats.percent}%)
                            </span>
                        </div>

                        <div className="h-4 w-px bg-border shrink-0 hidden md:block" />

                        {/* Search Jump */}
                        <div className="relative w-32 sm:w-36 lg:w-44 hidden sm:block">
                            <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                            <Input
                                placeholder="Search question..."
                                value={searchQuery}
                                onChange={(e) => onSearchQueryChange(e.target.value)}
                                className="h-7 text-xs pl-7 pr-2"
                            />
                        </div>

                        {/* Unanswered Filter Toggle */}
                        <Button
                            size="sm"
                            variant={showUnansweredOnly ? 'default' : 'outline'}
                            onClick={onToggleUnansweredOnly}
                            className="h-7 text-xs px-2.5 flex items-center gap-1.5 whitespace-nowrap"
                            title={showUnansweredOnly ? 'Show all questions' : 'Filter to show unanswered questions only'}
                        >
                            <SlidersHorizontal className="size-3" />
                            <span className="hidden md:inline">{showUnansweredOnly ? 'Unanswered' : 'Filter'}</span>
                        </Button>

                        {/* Export / View PDF Action */}
                        <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 text-xs px-2.5 flex items-center gap-1.5 whitespace-nowrap bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900 border-neutral-300 shadow-xs dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 dark:border-neutral-200"
                            title="Preview or print report PDF"
                        >
                            <a href={`/reports/${report.id}/pdf`} target="_blank" rel="noopener noreferrer">
                                <FileDown className="size-3 text-neutral-700 dark:text-neutral-700" />
                                <span className="hidden sm:inline font-medium">PDF</span>
                            </a>
                        </Button>

                        {/* Delete Draft Action */}


                        {canDelete && isEditable && (
                            <>
                                <div className="h-4 w-px bg-border shrink-0" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onDeleteClick}
                                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60 flex items-center gap-1.5 shrink-0"
                                    title="Delete this draft report"
                                >
                                    <Trash2 className="size-3" />
                                    <span className="hidden sm:inline">Delete</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Advisory Edit Lock Banner (NFR-15) */}
            {lockState && lockState.is_locked && !lockState.is_owner && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                        <Users className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                            <strong>{lockState.owner_name}</strong> is currently editing this report. Concurrent changes might conflict.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => onAcquireLock(true)}
                        className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 shrink-0"
                    >
                        Take over editing
                    </Button>
                </div>
            )}
        </>
    );
}
