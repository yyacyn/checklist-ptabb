import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { FormGroupData, SummarySchema } from './types';

export interface FormChapterSidebarProps {
    chapters: FormGroupData[];
    isPhotoForm: boolean;
    summaryFormState: SummarySchema;
    activeNavChapterId: number | 'summary' | 'photo';
    onSelectTab: (tabId: number | 'summary' | 'photo') => void;
    getAllGroupQuestionIds: (group: FormGroupData) => number[];
}

export function FormChapterSidebar({
    chapters,
    isPhotoForm,
    summaryFormState,
    activeNavChapterId,
    onSelectTab,
    getAllGroupQuestionIds,
}: FormChapterSidebarProps) {
    const totalChaptersCount =
        chapters.length +
        (!isPhotoForm && summaryFormState.enabled ? 1 : 0) +
        (isPhotoForm ? 1 : 0);

    return (
        <aside className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-6 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-border/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Table of Chapters
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                    {totalChaptersCount} {isPhotoForm ? 'Sections' : 'Chapters'}
                </Badge>
            </div>

            <div className="space-y-1">
                {chapters.map((chapter) => {
                    const totalQuestions = getAllGroupQuestionIds(chapter).length;
                    const totalSubgroups = (chapter.subgroups || []).length;
                    const isCurrent = activeNavChapterId === chapter.id;

                    return (
                        <button
                            key={chapter.id}
                            type="button"
                            onClick={() => onSelectTab(chapter.id)}
                            className={`w-full text-left rounded-lg p-2.5 transition-all flex flex-col gap-1 cursor-pointer ${
                                isCurrent
                                    ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                    : 'border border-transparent hover:bg-card/70'
                            } ${!chapter.is_enabled ? 'opacity-60' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-1.5">
                                <span className="font-semibold text-xs text-foreground truncate flex-1">
                                    {chapter.chapter_no ? `${chapter.chapter_no}. ` : ''}
                                    {chapter.title}
                                </span>
                                {!chapter.is_enabled ? (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                                        Off
                                    </Badge>
                                ) : chapter.ice_class_only ? (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                                        Ice
                                    </Badge>
                                ) : null}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                                <span>
                                    {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
                                </span>
                                {totalSubgroups > 0 && (
                                    <span className="text-[10px] font-mono text-muted-foreground/80">
                                        {totalSubgroups} sub
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}

                {/* Summary Chapter in Table of Chapters (Standard Forms Only) */}
                {!isPhotoForm && summaryFormState.enabled && (
                    <button
                        type="button"
                        onClick={() => onSelectTab('summary')}
                        className={`w-full text-left rounded-lg p-2.5 transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                            activeNavChapterId === 'summary'
                                ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                : 'border border-transparent hover:bg-card/70'
                        }`}
                    >
                        <span className="font-semibold text-xs text-foreground truncate flex-1">
                            {summaryFormState.title || 'Summary & Observations'}
                        </span>
                    </button>
                )}

                {/* Photo Chapter / Form in Table of Chapters */}
                {isPhotoForm && (
                    <button
                        type="button"
                        onClick={() => onSelectTab('photo')}
                        className={`w-full text-left rounded-lg p-2.5 transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                            activeNavChapterId === 'photo'
                                ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                : 'border border-transparent hover:bg-card/70'
                        }`}
                    >
                        <span className="font-semibold text-xs text-foreground truncate flex-1">
                            Photographic Records
                        </span>
                    </button>
                )}
            </div>
        </aside>
    );
}
