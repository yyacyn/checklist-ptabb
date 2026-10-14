import {
    Calendar,
    Camera,
    CheckCircle2,
    FileCheck,
    History,
    Info,
    ShieldAlert,
    UserCheck,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { ChapterData, FindingData, PhotoRecord, SummarySchema } from '@/types';

export interface ReportChapterSidebarProps {
    isPhotoForm: boolean;
    isB008?: boolean;
    photoChapterTitle: string;
    photos: PhotoRecord[];
    activeChapterId: number;
    onChapterSwitch: (chapterId: number) => void;
    groups: ChapterData[];
    chapterStats: Record<
        number,
        {
            applicable: number;
            answered: number;
            noCount: number;
            nsCount: number;
        }
    >;
    summarySchema: SummarySchema;
    summaryChapterNo: string | number;
    summaryChapterTitle: string;
    findings: FindingData[];
}

export function ReportChapterSidebar({
    isPhotoForm,
    isB008 = false,
    photoChapterTitle,
    photos,
    activeChapterId,
    onChapterSwitch,
    groups,
    chapterStats,
    summarySchema,
    summaryChapterNo,
    summaryChapterTitle,
    findings,
}: ReportChapterSidebarProps) {
    return (
        <aside className="w-80 shrink-0 border-r bg-muted/20 overflow-y-auto p-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1">
                {isPhotoForm ? 'Photo Form Sections' : isB008 ? 'Audit Pages & Sections' : 'Chapters / Sections'}
            </div>

            {/* Standalone Photo Form Single Primary Section */}
            {isPhotoForm ? (
                <button
                    type="button"
                    onClick={() => onChapterSwitch(-888)}
                    className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                        activeChapterId === -888
                            ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                            : 'border border-transparent hover:bg-card/70'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Camera className="size-4 text-primary shrink-0" />
                            <span className="font-semibold text-xs text-foreground truncate">
                                1. {photoChapterTitle}
                            </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                            {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground pl-5 truncate">
                        Multi-photo inspection & walkaround records
                    </div>
                </button>
            ) : (
                <>
                    {/* D-062 Chapter 1: General Information */}
                    {!isB008 && (
                        <button
                            type="button"
                            onClick={() => onChapterSwitch(0)}
                            className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                                activeChapterId === 0
                                    ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                    : 'border border-transparent hover:bg-card/70'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Info className="size-4 text-primary shrink-0" />
                                    <span className="font-semibold text-xs text-foreground truncate">
                                        1. General Information
                                    </span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                                    Particulars
                                </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground pl-5 truncate">
                                Ship, PSC, Drydock, Operations & Officers
                            </div>
                        </button>
                    )}

                    {/* Checklist Chapters / Sections */}
                    {groups
                        .filter((g) => g.chapter_no !== '1' && g.title !== 'General Information')
                        .map((group) => {
                            const stats = chapterStats[group.id] || {
                                applicable: 0,
                                answered: 0,
                                noCount: 0,
                                nsCount: 0,
                            };
                            const isCurrent = group.id === activeChapterId;
                            const isComplete = stats.applicable > 0 && stats.answered === stats.applicable;

                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => onChapterSwitch(group.id)}
                                    className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                                        isCurrent
                                            ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                            : 'border border-transparent hover:bg-card/70'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isComplete ? (
                                                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
                                            )}
                                            <span className="font-medium text-xs text-foreground truncate">
                                                {group.chapter_no ? `${group.chapter_no}. ` : ''}
                                                {group.title}
                                            </span>
                                        </div>

                                        {!group.is_applicable && (
                                            <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600">
                                                NA
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Progress & Flags Bar */}
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-3.5">
                                        <span>
                                            {stats.answered} of {stats.applicable} answered
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {stats.noCount > 0 && (
                                                <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 rounded text-[10px]">
                                                    {stats.noCount} No
                                                </span>
                                            )}
                                            {stats.nsCount > 0 && (
                                                <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-1 rounded text-[10px]">
                                                    {stats.nsCount} NS
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                    {/* Dynamic Summary Chapter (Schema-Driven, Task 4.1) */}
                    {summarySchema.enabled !== false && (
                        <button
                            type="button"
                            onClick={() => onChapterSwitch(-999)}
                            className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                                activeChapterId === -999 || activeChapterId === -15
                                    ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                    : 'border border-transparent hover:bg-card/70'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <ShieldAlert className="size-4 text-primary shrink-0" />
                                    <span className="font-semibold text-xs text-foreground truncate">
                                        {summaryChapterNo}. {summaryChapterTitle}
                                    </span>
                                </div>
                                {summarySchema.has_findings_register !== false && (
                                    <Badge
                                        variant={findings.length > 0 ? 'destructive' : 'secondary'}
                                        className="text-[10px] shrink-0 font-mono"
                                    >
                                        {findings.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-[11px] text-muted-foreground pl-5 truncate flex items-center gap-1.5">
                                {summarySchema.has_findings_register !== false ? (
                                    <>
                                        {findings.filter((f) => f.risk === 'high').length > 0 && (
                                            <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950 px-1 rounded text-[10px]">
                                                {findings.filter((f) => f.risk === 'high').length} High
                                            </span>
                                        )}
                                        {findings.filter((f) => f.risk === 'medium').length > 0 && (
                                            <span className="text-amber-600 font-bold bg-amber-50 dark:bg-amber-950 px-1 rounded text-[10px]">
                                                {findings.filter((f) => f.risk === 'medium').length} Med
                                            </span>
                                        )}
                                        {findings.filter((f) => f.risk === 'low').length > 0 && (
                                            <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-1 rounded text-[10px]">
                                                {findings.filter((f) => f.risk === 'low').length} Low
                                            </span>
                                        )}
                                        {findings.length === 0 &&
                                            (summarySchema.has_ratings_matrix
                                                ? 'Ratings & Observations'
                                                : 'Findings & Deficiencies')}
                                    </>
                                ) : (
                                    'Executive Summary & Assessment'
                                )}
                            </div>
                        </button>
                    )}

                    {/* B-008: Vessel's Audit Report (Form B-008 Page at End) */}
                    {isB008 && (
                        <button
                            type="button"
                            onClick={() => onChapterSwitch(-100)}
                            className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                                activeChapterId === -100 || activeChapterId === 0 || activeChapterId === -101 || activeChapterId === -102 || activeChapterId === -103
                                    ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                    : 'border border-transparent hover:bg-card/70'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <FileCheck className="size-4 text-primary shrink-0" />
                                    <span className="font-semibold text-xs text-foreground truncate">
                                        Vessel&apos;s Audit Report
                                    </span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                                    Particulars
                                </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground pl-5 truncate">
                                Particulars, Operations, People & Follow-up
                            </div>
                        </button>
                    )}
                </>
            )}
        </aside>
    );
}
