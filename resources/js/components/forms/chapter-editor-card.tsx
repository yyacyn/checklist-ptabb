import {
    ArrowDown,
    ArrowUp,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Eye,
    EyeOff,
    Filter,
    FolderPlus,
    History,
    MoreHorizontal,
    Plus,
    Square,
    Trash2,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuestionRow } from './question-row';
import type { FormGroupData, FormQuestionData, FormVesselTypeItem } from './types';

export interface ChapterEditorCardProps {
    chapter: FormGroupData;
    vesselTypes: FormVesselTypeItem[];
    selectedQuestionIds: number[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onSelectAllInGroup: (group: FormGroupData) => void;
    onToggleGroup: (groupId: number) => void;
    onBulkToggleGroup: (group: FormGroupData, enable: boolean) => void;
    onReorderGroup: (groupId: number, dir: 'up' | 'down') => void;
    onOpenGroupApplicability: (group: FormGroupData) => void;
    onOpenHistory: (type: 'group' | 'question', id: number, title: string) => void;
    onOpenEditGroup: (group: FormGroupData) => void;
    onDeleteGroup: (group: FormGroupData) => void;
    onOpenAddSubgroup: (chapterId: number) => void;
    onOpenAddQuestion: (groupId: number) => void;
    collapsedSubgroups: Record<number, boolean>;
    onToggleSubgroupCollapse: (subgroupId: number) => void;
    expandedGuidance: Record<number, boolean>;
    onToggleGuidance: (questionId: number) => void;
    onToggleSelectQuestion: (questionId: number) => void;
    onOpenEditQuestion: (q: FormQuestionData) => void;
    onOpenQuestionApplicability: (q: FormQuestionData) => void;
    onReorderQuestion: (questionId: number, dir: 'up' | 'down') => void;
    onToggleQuestion: (questionId: number) => void;
    onDuplicateQuestion: (questionId: number) => void;
    onDeleteQuestion: (q: FormQuestionData) => void;
    prevTab: { id: number | 'summary' | 'photo'; title: string } | null;
    nextTab: { id: number | 'summary' | 'photo'; title: string } | null;
    onSelectTab: (tabId: number | 'summary' | 'photo') => void;
}

export function ChapterEditorCard({
    chapter,
    vesselTypes,
    selectedQuestionIds,
    isCollapsed,
    onToggleCollapse,
    onSelectAllInGroup,
    onToggleGroup,
    onBulkToggleGroup,
    onReorderGroup,
    onOpenGroupApplicability,
    onOpenHistory,
    onOpenEditGroup,
    onDeleteGroup,
    onOpenAddSubgroup,
    onOpenAddQuestion,
    collapsedSubgroups,
    onToggleSubgroupCollapse,
    expandedGuidance,
    onToggleGuidance,
    onToggleSelectQuestion,
    onOpenEditQuestion,
    onOpenQuestionApplicability,
    onReorderQuestion,
    onToggleQuestion,
    onDuplicateQuestion,
    onDeleteQuestion,
    prevTab,
    nextTab,
    onSelectTab,
}: ChapterEditorCardProps) {
    const getAllGroupQuestionIds = (group: FormGroupData): number[] => {
        let ids: number[] = (group.questions || []).map((q) => q.id);
        (group.subgroups || []).forEach((sg) => {
            ids = ids.concat((sg.questions || []).map((q) => q.id));
        });
        return ids;
    };

    const chapterQuestionIds = getAllGroupQuestionIds(chapter);
    const isChapterAllSelected =
        chapterQuestionIds.length > 0 &&
        chapterQuestionIds.every((id) => selectedQuestionIds.includes(id));

    return (
        <Card
            key={chapter.id}
            id={`chapter-${chapter.id}`}
            className={`gap-0 overflow-hidden py-0 shadow-xs ${
                !chapter.is_enabled ? 'opacity-60 bg-muted/20' : ''
            }`}
        >
            <CardHeader className="border-b bg-muted/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                            title={isCollapsed ? 'Expand Chapter' : 'Collapse Chapter'}
                        >
                            {isCollapsed ? (
                                <ChevronRight className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelectAllInGroup(chapter)}
                            className="text-muted-foreground hover:text-foreground shrink-0 mr-1 cursor-pointer"
                            title="Select all questions in this group"
                        >
                            {isChapterAllSelected ? (
                                <CheckSquare className="size-4 text-primary" />
                            ) : (
                                <Square className="size-4" />
                            )}
                        </button>
                        <h3
                            className="font-semibold text-lg cursor-pointer select-none"
                            onClick={onToggleCollapse}
                        >
                            {chapter.chapter_no ? `${chapter.chapter_no}. ` : ''}
                            {chapter.title}
                        </h3>
                        {!chapter.is_enabled && <Badge variant="destructive">Disabled</Badge>}
                        {chapter.ice_class_only && <Badge variant="outline">Ice Class</Badge>}
                        {(chapter.vessel_type_ids || []).length > 0 && (
                            <Badge variant="outline" className="text-xs">
                                {(vesselTypes || [])
                                    .filter((vt) => (chapter.vessel_type_ids || []).includes(vt.id))
                                    .map((vt) => vt.name)
                                    .join('/')}
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            size="sm"
                            variant="ghost"
                            title={chapter.is_enabled ? 'Disable' : 'Enable'}
                            onClick={() => onToggleGroup(chapter.id)}
                        >
                            {chapter.is_enabled ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4 text-muted-foreground" />
                            )}
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenAddSubgroup(chapter.id)}
                            className="cursor-pointer"
                        >
                            <FolderPlus className="size-3.5 mr-1" /> Add Subgroup
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenAddQuestion(chapter.id)}
                            className="cursor-pointer"
                        >
                            <Plus className="size-3.5 mr-1" /> Add Question
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="More Options">
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                    onClick={() => onReorderGroup(chapter.id, 'up')}
                                    className="cursor-pointer"
                                >
                                    <ArrowUp className="size-4 mr-2" /> Move Up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onReorderGroup(chapter.id, 'down')}
                                    className="cursor-pointer"
                                >
                                    <ArrowDown className="size-4 mr-2" /> Move Down
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onBulkToggleGroup(chapter, !chapter.is_enabled)}
                                    className="cursor-pointer"
                                >
                                    {chapter.is_enabled ? (
                                        <EyeOff className="size-4 mr-2" />
                                    ) : (
                                        <Eye className="size-4 mr-2" />
                                    )}
                                    {chapter.is_enabled
                                        ? 'Disable All Questions'
                                        : 'Enable All Questions'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onOpenGroupApplicability(chapter)}
                                    className="cursor-pointer"
                                >
                                    <Filter className="size-4 mr-2" /> Applicability
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onOpenHistory('group', chapter.id, chapter.title)}
                                    className="cursor-pointer"
                                >
                                    <History className="size-4 mr-2" /> Change History
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onOpenEditGroup(chapter)}
                                    className="cursor-pointer"
                                >
                                    <Edit2 className="size-4 mr-2" /> Edit Chapter
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => onDeleteGroup(chapter)}
                                >
                                    <Trash2 className="size-4 mr-2" /> Delete Chapter
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            {!isCollapsed && (
                <CardContent className="space-y-4 p-4">
                    {/* Subgroups */}
                    {chapter.subgroups && chapter.subgroups.length > 0 && (
                        <div className="space-y-6">
                            {chapter.subgroups.map((subgroup) => {
                                const subQuestionIds = (subgroup.questions || []).map((q) => q.id);
                                const isSubAllSelected =
                                    subQuestionIds.length > 0 &&
                                    subQuestionIds.every((id) => selectedQuestionIds.includes(id));
                                const isSubCollapsed = Boolean(collapsedSubgroups[subgroup.id]);

                                return (
                                    <section
                                        key={subgroup.id}
                                        className={!subgroup.is_enabled ? 'opacity-60' : ''}
                                    >
                                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b">
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleSubgroupCollapse(subgroup.id)}
                                                    className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                                                    title={isSubCollapsed ? 'Expand Subgroup' : 'Collapse Subgroup'}
                                                >
                                                    {isSubCollapsed ? (
                                                        <ChevronRight className="size-3.5" />
                                                    ) : (
                                                        <ChevronDown className="size-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectAllInGroup(subgroup)}
                                                    className="text-muted-foreground hover:text-foreground shrink-0 mr-1 cursor-pointer"
                                                >
                                                    {isSubAllSelected ? (
                                                        <CheckSquare className="size-3.5 text-primary" />
                                                    ) : (
                                                        <Square className="size-3.5" />
                                                    )}
                                                </button>
                                                <h4
                                                    className="font-semibold text-sm uppercase tracking-wide text-muted-foreground cursor-pointer select-none"
                                                    onClick={() => onToggleSubgroupCollapse(subgroup.id)}
                                                >
                                                    {subgroup.title}
                                                </h4>
                                                {!subgroup.is_enabled && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        Disabled
                                                    </Badge>
                                                )}
                                                {(subgroup.vessel_type_ids || []).length > 0 && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {(vesselTypes || [])
                                                            .filter((vt) =>
                                                                (subgroup.vessel_type_ids || []).includes(vt.id)
                                                            )
                                                            .map((vt) => vt.name)
                                                            .join('/')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    title={subgroup.is_enabled ? 'Disable' : 'Enable'}
                                                    onClick={() => onToggleGroup(subgroup.id)}
                                                >
                                                    {subgroup.is_enabled ? (
                                                        <Eye className="size-3.5" />
                                                    ) : (
                                                        <EyeOff className="size-3.5 text-muted-foreground" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs cursor-pointer"
                                                    onClick={() => onOpenAddQuestion(subgroup.id)}
                                                >
                                                    <Plus className="size-3 mr-1" /> Question
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            title="More Options"
                                                        >
                                                            <MoreHorizontal className="size-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            onClick={() => onReorderGroup(subgroup.id, 'up')}
                                                            className="cursor-pointer"
                                                        >
                                                            <ArrowUp className="size-3.5 mr-2" /> Move Up
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => onReorderGroup(subgroup.id, 'down')}
                                                            className="cursor-pointer"
                                                        >
                                                            <ArrowDown className="size-3.5 mr-2" /> Move Down
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => onOpenGroupApplicability(subgroup)}
                                                            className="cursor-pointer"
                                                        >
                                                            <Filter className="size-3.5 mr-2" /> Applicability
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                onOpenHistory('group', subgroup.id, subgroup.title)
                                                            }
                                                            className="cursor-pointer"
                                                        >
                                                            <History className="size-3.5 mr-2" /> Change History
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => onOpenEditGroup(subgroup)}
                                                            className="cursor-pointer"
                                                        >
                                                            <Edit2 className="size-3.5 mr-2" /> Rename
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                            onClick={() => onDeleteGroup(subgroup)}
                                                        >
                                                            <Trash2 className="size-3.5 mr-2" /> Delete Subgroup
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        {/* Subgroup Questions */}
                                        {!isSubCollapsed && (
                                            <div className="space-y-2">
                                                {(subgroup.questions || []).map((q) => (
                                                    <QuestionRow
                                                        key={q.id}
                                                        question={q}
                                                        vesselTypes={vesselTypes}
                                                        isSelected={selectedQuestionIds.includes(q.id)}
                                                        isExpanded={Boolean(expandedGuidance[q.id])}
                                                        onSelect={() => onToggleSelectQuestion(q.id)}
                                                        onToggleGuidance={() => onToggleGuidance(q.id)}
                                                        onEdit={() => onOpenEditQuestion(q)}
                                                        onApplicability={() => onOpenQuestionApplicability(q)}
                                                        onHistory={() =>
                                                            onOpenHistory('question', q.id, q.question_text)
                                                        }
                                                        onReorder={(dir) => onReorderQuestion(q.id, dir)}
                                                        onToggle={() => onToggleQuestion(q.id)}
                                                        onDuplicate={() => onDuplicateQuestion(q.id)}
                                                        onDelete={() => onDeleteQuestion(q)}
                                                    />
                                                ))}
                                                {(subgroup.questions || []).length === 0 && (
                                                    <p className="text-xs text-muted-foreground italic py-2">
                                                        No questions in this subgroup.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}

                    {/* Direct Chapter Questions */}
                    {(chapter.questions || []).length > 0 && (
                        <div className="space-y-2">
                            {(chapter.questions || []).map((q) => (
                                <QuestionRow
                                    key={q.id}
                                    question={q}
                                    vesselTypes={vesselTypes}
                                    isSelected={selectedQuestionIds.includes(q.id)}
                                    isExpanded={Boolean(expandedGuidance[q.id])}
                                    onSelect={() => onToggleSelectQuestion(q.id)}
                                    onToggleGuidance={() => onToggleGuidance(q.id)}
                                    onEdit={() => onOpenEditQuestion(q)}
                                    onApplicability={() => onOpenQuestionApplicability(q)}
                                    onHistory={() => onOpenHistory('question', q.id, q.question_text)}
                                    onReorder={(dir) => onReorderQuestion(q.id, dir)}
                                    onToggle={() => onToggleQuestion(q.id)}
                                    onDuplicate={() => onDuplicateQuestion(q.id)}
                                    onDelete={() => onDeleteQuestion(q)}
                                />
                            ))}
                        </div>
                    )}

                    {(chapter.questions || []).length === 0 &&
                        (!chapter.subgroups || chapter.subgroups.length === 0) && (
                            <p className="text-xs text-muted-foreground italic py-2">
                                No questions in this chapter.
                            </p>
                        )}
                </CardContent>
            )}

            <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                {prevTab ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectTab(prevTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <ChevronLeft className="size-4" />
                        <span className="truncate max-w-[200px]">{prevTab.title}</span>
                    </Button>
                ) : (
                    <div />
                )}
                {nextTab ? (
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onSelectTab(nextTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <span className="truncate max-w-[200px]">{nextTab.title}</span>
                        <ChevronRight className="size-4" />
                    </Button>
                ) : (
                    <div />
                )}
            </CardFooter>
        </Card>
    );
}
