import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowRightLeft,
    ArrowUp,
    Calendar,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    Copy,
    Edit2,
    Eye,
    EyeOff,
    FileText,
    Filter,
    FolderPlus,
    Hash,
    HelpCircle,
    History,
    MoreHorizontal,
    Paperclip,
    Plus,
    Square,
    Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuestionData {
    id: number;
    group_id: number;
    question_text: string;
    guidance: string | null;
    input_type: string;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only: boolean;
    vessel_type_ids: number[];
    reports_count: number;
}

interface GroupData {
    id: number;
    parent_id?: number | null;
    title: string;
    chapter_no: string | null;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only: boolean;
    vessel_type_ids: number[];
    reports_count: number;
    questions: QuestionData[];
    subgroups?: GroupData[];
}

interface FormData {
    id: number;
    code: string;
    name: string;
    form_version: string;
    template_version: number;
    answer_set: string;
}

interface VesselTypeItem {
    id: number;
    name: string;
}

interface GroupOption {
    id: number;
    title: string;
    parent_id: number | null;
}

interface HistoryItem {
    id: number;
    action: string;
    field: string | null;
    before_value: string | null;
    after_value: string | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        role: string;
    } | null;
}

interface Props {
    form: FormData;
    chapters?: GroupData[];
    all_groups?: GroupOption[];
    flat_groups?: GroupOption[];
    vessel_types?: VesselTypeItem[];
}

export function parseQuestionInputType(inputType: string) {
    const raw = (inputType || 'none').toLowerCase().trim();
    if (raw === 'none') {
        return { hasChoices: true, hasText: false, hasDate: false, hasNumber: false, hasFile: false };
    }
    const tokens = raw.split(',').map((t) => t.trim());
    const isPureOnly = tokens.some((t) => t.endsWith('_only'));
    const hasChoices = !isPureOnly && !tokens.includes('no_choices');

    return {
        hasChoices,
        hasText: tokens.includes('text') || tokens.includes('text_only'),
        hasDate: tokens.includes('date') || tokens.includes('date_only'),
        hasNumber: tokens.includes('number') || tokens.includes('number_only'),
        hasFile: tokens.includes('file') || tokens.includes('file_only'),
    };
}

export function buildQuestionInputType(flags: {
    hasChoices: boolean;
    hasText: boolean;
    hasDate: boolean;
    hasNumber: boolean;
    hasFile: boolean;
}): string {
    const types: string[] = [];
    if (flags.hasText) types.push('text');
    if (flags.hasDate) types.push('date');
    if (flags.hasNumber) types.push('number');
    if (flags.hasFile) types.push('file');

    if (flags.hasChoices) {
        if (types.length === 0) return 'none';
        return types.join(',');
    } else {
        if (types.length === 0) return 'text_only';
        return types.map((t) => `${t}_only`).join(',');
    }
}

export default function FormShow({
    form,
    chapters = [],
    all_groups = [],
    flat_groups = [],
    vessel_types = [],
}: Props) {
    const groupsList = all_groups.length > 0 ? all_groups : flat_groups;
    // Group Modal State
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
    const [groupParentId, setGroupParentId] = useState<number | null>(null);
    const [groupTitle, setGroupTitle] = useState('');
    const [groupChapterNo, setGroupChapterNo] = useState('');
    const [groupIceClass, setGroupIceClass] = useState(false);

    // Question Modal State
    const [questionModalOpen, setQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
    const [questionGroupId, setQuestionGroupId] = useState<number | null>(null);
    const [questionText, setQuestionText] = useState('');
    const [questionGuidance, setQuestionGuidance] = useState('');
    const [questionHasChoices, setQuestionHasChoices] = useState(true);
    const [questionHasText, setQuestionHasText] = useState(false);
    const [questionHasDate, setQuestionHasDate] = useState(false);
    const [questionHasNumber, setQuestionHasNumber] = useState(false);
    const [questionHasFile, setQuestionHasFile] = useState(false);

    // Applicability Modal State (Task 2.4)
    const [applicabilityModalOpen, setApplicabilityModalOpen] = useState(false);
    const [applicabilityTarget, setApplicabilityTarget] = useState<{ type: 'group' | 'question'; id: number; title: string } | null>(null);
    const [selectedVesselTypes, setSelectedVesselTypes] = useState<number[]>([]);
    const [selectedIceClassOnly, setSelectedIceClassOnly] = useState(false);

    // Bulk Move State (Task 2.3)
    const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
    const [targetGroupId, setTargetGroupId] = useState<string>('');

    // History Modal State (Task 2.6)
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTitle, setHistoryTitle] = useState('');
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

    // Expanded guidance state
    const [expandedGuidance, setExpandedGuidance] = useState<Record<number, boolean>>({});


    // Collapse/Expand state for chapters and subgroups
    const [collapsedChapters, setCollapsedChapters] = useState<Record<number, boolean>>({});
    const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<number, boolean>>({});

    const toggleChapterCollapse = (id: number) => {
        setCollapsedChapters((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSubgroupCollapse = (id: number) => {
        setCollapsedSubgroups((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const expandAll = () => {
        setCollapsedChapters({});
        setCollapsedSubgroups({});
    };

    const collapseAll = () => {
        const chMap: Record<number, boolean> = {};
        const subMap: Record<number, boolean> = {};
        chapters.forEach((ch) => {
            chMap[ch.id] = true;
            (ch.subgroups || []).forEach((sg) => {
                subMap[sg.id] = true;
            });
        });
        setCollapsedChapters(chMap);
        setCollapsedSubgroups(subMap);
    };

    const toggleGuidance = (id: number) => {
        setExpandedGuidance((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Selection toggle for bulk operations
    const toggleSelectQuestion = (id: number) => {
        setSelectedQuestionIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const getAllGroupQuestionIds = (group: GroupData): number[] => {
        const direct = (group.questions || []).map((q) => q.id);
        const sub = (group.subgroups || []).flatMap((sg) => (sg.questions || []).map((q) => q.id));
        return [...direct, ...sub];
    };

    const selectAllInGroup = (group: GroupData) => {
        const ids = getAllGroupQuestionIds(group);
        const allSelected = ids.length > 0 && ids.every((id) => selectedQuestionIds.includes(id));
        if (allSelected) {
            setSelectedQuestionIds((prev) => prev.filter((id) => !ids.includes(id)));
        } else {
            setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...ids])));
        }
    };

    // Open Group Modal
    const openAddChapter = () => {
        setEditingGroup(null);
        setGroupParentId(null);
        setGroupTitle('');
        setGroupChapterNo('');
        setGroupIceClass(false);
        setGroupModalOpen(true);
    };

    const openAddSubgroup = (parentId: number) => {
        setEditingGroup(null);
        setGroupParentId(parentId);
        setGroupTitle('');
        setGroupChapterNo('');
        setGroupIceClass(false);
        setGroupModalOpen(true);
    };

    const openEditGroup = (group: GroupData) => {
        setEditingGroup(group);
        setGroupParentId(null);
        setGroupTitle(group.title);
        setGroupChapterNo(group.chapter_no || '');
        setGroupIceClass(group.ice_class_only);
        setGroupModalOpen(true);
    };

    const handleSaveGroup = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingGroup) {
            router.put(`/admin/groups/${editingGroup.id}`, {
                title: groupTitle,
                chapter_no: groupChapterNo || null,
                ice_class_only: groupIceClass,
            }, {
                preserveScroll: true,
                onSuccess: () => setGroupModalOpen(false),
            });
        } else {
            router.post(`/admin/forms/${form.id}/groups`, {
                title: groupTitle,
                chapter_no: groupChapterNo || null,
                parent_id: groupParentId,
                ice_class_only: groupIceClass,
            }, {
                preserveScroll: true,
                onSuccess: () => setGroupModalOpen(false),
            });
        }
    };

    // Open Question Modal
    const openAddQuestion = (groupId: number) => {
        setEditingQuestion(null);
        setQuestionGroupId(groupId);
        setQuestionText('');
        setQuestionGuidance('');
        setQuestionHasChoices(true);
        setQuestionHasText(false);
        setQuestionHasDate(false);
        setQuestionHasNumber(false);
        setQuestionHasFile(false);
        setQuestionModalOpen(true);
    };

    const openEditQuestion = (question: QuestionData) => {
        setEditingQuestion(question);
        setQuestionGroupId(null);
        setQuestionText(question.question_text);
        setQuestionGuidance(question.guidance || '');
        const flags = parseQuestionInputType(question.input_type);
        setQuestionHasChoices(flags.hasChoices);
        setQuestionHasText(flags.hasText);
        setQuestionHasDate(flags.hasDate);
        setQuestionHasNumber(flags.hasNumber);
        setQuestionHasFile(flags.hasFile);
        setQuestionModalOpen(true);
    };

    const handleSaveQuestion = (e: React.FormEvent) => {
        e.preventDefault();
        const inputType = buildQuestionInputType({
            hasChoices: questionHasChoices,
            hasText: questionHasText,
            hasDate: questionHasDate,
            hasNumber: questionHasNumber,
            hasFile: questionHasFile,
        });

        if (editingQuestion) {
            router.put(`/admin/questions/${editingQuestion.id}`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: inputType,
            }, {
                preserveScroll: true,
                onSuccess: () => setQuestionModalOpen(false),
            });
        } else if (questionGroupId) {
            router.post(`/admin/groups/${questionGroupId}/questions`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: inputType,
            }, {
                preserveScroll: true,
                onSuccess: () => setQuestionModalOpen(false),
            });
        }
    };

    // Applicability Modal (Task 2.4)
    const openGroupApplicability = (group: GroupData) => {
        setApplicabilityTarget({ type: 'group', id: group.id, title: group.title });
        setSelectedVesselTypes(group.vessel_type_ids || []);
        setSelectedIceClassOnly(group.ice_class_only);
        setApplicabilityModalOpen(true);
    };

    const openQuestionApplicability = (question: QuestionData) => {
        setApplicabilityTarget({ type: 'question', id: question.id, title: question.question_text });
        setSelectedVesselTypes(question.vessel_type_ids || []);
        setSelectedIceClassOnly(question.ice_class_only);
        setApplicabilityModalOpen(true);
    };

    const handleSaveApplicability = (e: React.FormEvent) => {
        e.preventDefault();
        if (!applicabilityTarget) return;

        const url = applicabilityTarget.type === 'group'
            ? `/admin/groups/${applicabilityTarget.id}/applicability`
            : `/admin/questions/${applicabilityTarget.id}/applicability`;

        router.put(url, {
            vessel_type_ids: selectedVesselTypes,
            ice_class_only: selectedIceClassOnly,
        }, {
            preserveScroll: true,
            onSuccess: () => setApplicabilityModalOpen(false),
        });
    };

    // Bulk Move (Task 2.3)
    const handleBulkMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedQuestionIds.length === 0 || !targetGroupId) return;

        router.post('/admin/questions/bulk-move', {
            question_ids: selectedQuestionIds,
            target_group_id: Number(targetGroupId),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setBulkMoveModalOpen(false);
                setSelectedQuestionIds([]);
                setTargetGroupId('');
            },
        });
    };

    // Bulk Toggle Group (Task 2.3)
    const handleBulkToggleGroup = (group: GroupData, enable: boolean) => {
        router.post(`/admin/groups/${group.id}/bulk-toggle`, { enable }, { preserveScroll: true });
    };

    // History View (Task 2.6)
    const openHistory = async (type: 'group' | 'question', id: number, title: string) => {
        setHistoryTitle(`${type === 'group' ? 'Group' : 'Question'}: ${title}`);
        setHistoryLoading(true);
        setHistoryModalOpen(true);

        try {
            const res = await fetch(`/admin/${type === 'group' ? 'groups' : 'questions'}/${id}/history`);
            const data = await res.json();
            setHistoryItems(data);
        } catch {
            setHistoryItems([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Action Helpers
    const handleReorderGroup = (id: number, direction: 'up' | 'down') => {
        router.post(`/admin/groups/${id}/reorder`, { direction }, { preserveScroll: true });
    };

    const handleToggleGroup = (id: number) => {
        router.post(`/admin/groups/${id}/toggle`, {}, { preserveScroll: true });
    };

    const handleDeleteGroup = (group: GroupData) => {
        if (confirm('Are you sure you want to delete this group?')) {
            router.delete(`/admin/groups/${group.id}`, { preserveScroll: true });
        }
    };

    const handleReorderQuestion = (id: number, direction: 'up' | 'down') => {
        router.post(`/admin/questions/${id}/reorder`, { direction }, { preserveScroll: true });
    };

    const handleToggleQuestion = (id: number) => {
        router.post(`/admin/questions/${id}/toggle`, {}, { preserveScroll: true });
    };

    const handleDuplicateQuestion = (id: number) => {
        router.post(`/admin/questions/${id}/duplicate`, {}, { preserveScroll: true });
    };

    const handleDeleteQuestion = (question: QuestionData) => {
        if (confirm('Are you sure you want to delete this question?')) {
            router.delete(`/admin/questions/${question.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title={`Template Editor: ${form.code}`} />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-sm font-bold">
                                {form.code}
                            </Badge>
                            <Badge variant="default">Template v{form.template_version}</Badge>
                            <span className="text-xs text-muted-foreground">(Paper {form.form_version})</span>
                        </div>
                        <Heading title={form.name} description="Superadmin template editor: live changes update future reports immediately." />
                    </div>

                    <div className="flex items-center gap-2 self-start flex-wrap">
                        <Button variant="outline" size="sm" onClick={expandAll} className="flex items-center gap-1.5 text-xs">
                            <ChevronsUpDown className="size-3.5" />
                            <span>Expand All</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={collapseAll} className="flex items-center gap-1.5 text-xs">
                            <ChevronsDownUp className="size-3.5" />
                            <span>Collapse All</span>
                        </Button>
                        {selectedQuestionIds.length > 0 && (
                            <Button variant="secondary" onClick={() => setBulkMoveModalOpen(true)} className="flex items-center gap-1.5">
                                <ArrowRightLeft className="size-4" />
                                <span>Move {selectedQuestionIds.length} Selected Question(s)</span>
                            </Button>
                        )}
                        <Button onClick={openAddChapter} className="flex items-center gap-1.5">
                            <Plus className="size-4" />
                            <span>Add Chapter / Section</span>
                        </Button>
                    </div>
                </div>

                {/* Chapter Tree */}
                <div className="space-y-6">
                    {chapters.map((chapter) => {
                        const chapterQuestionIds = getAllGroupQuestionIds(chapter);
                        const isChapterAllSelected =
                            chapterQuestionIds.length > 0 &&
                            chapterQuestionIds.every((id) => selectedQuestionIds.includes(id));
                        const isChapterCollapsed = Boolean(collapsedChapters[chapter.id]);

                        return (
                            <Card key={chapter.id} className={`gap-0 overflow-hidden py-0 ${!chapter.is_enabled ? 'opacity-60 bg-muted/20' : ''}`}>
                                <CardHeader className="border-b bg-muted/40 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => toggleChapterCollapse(chapter.id)}
                                                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                                                title={isChapterCollapsed ? 'Expand Chapter' : 'Collapse Chapter'}
                                            >
                                                {isChapterCollapsed ? (
                                                    <ChevronRight className="size-4" />
                                                ) : (
                                                    <ChevronDown className="size-4" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectAllInGroup(chapter)}
                                                className="text-muted-foreground hover:text-foreground shrink-0 mr-1"
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
                                                onClick={() => toggleChapterCollapse(chapter.id)}
                                            >
                                                {chapter.chapter_no ? `${chapter.chapter_no}. ` : ''}{chapter.title}
                                            </h3>
                                            {!chapter.is_enabled && <Badge variant="destructive">Disabled</Badge>}
                                            {chapter.ice_class_only && <Badge variant="outline">Ice Class</Badge>}
                                            {(chapter.vessel_type_ids || []).length > 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                    {(vessel_types || [])
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
                                                onClick={() => handleToggleGroup(chapter.id)}
                                            >
                                                {chapter.is_enabled ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}
                                            </Button>

                                            <Button size="sm" variant="outline" onClick={() => openAddSubgroup(chapter.id)}>
                                                <FolderPlus className="size-3.5 mr-1" /> Add Subgroup
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => openAddQuestion(chapter.id)}>
                                                <Plus className="size-3.5 mr-1" /> Add Question
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="More Options">
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuItem onClick={() => handleReorderGroup(chapter.id, 'up')}>
                                                        <ArrowUp className="size-4 mr-2" /> Move Up
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleReorderGroup(chapter.id, 'down')}>
                                                        <ArrowDown className="size-4 mr-2" /> Move Down
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleBulkToggleGroup(chapter, !chapter.is_enabled)}>
                                                        {chapter.is_enabled ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
                                                        {chapter.is_enabled ? 'Disable All Questions' : 'Enable All Questions'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openGroupApplicability(chapter)}>
                                                        <Filter className="size-4 mr-2" /> Applicability
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openHistory('group', chapter.id, chapter.title)}>
                                                        <History className="size-4 mr-2" /> Change History
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditGroup(chapter)}>
                                                        <Edit2 className="size-4 mr-2" /> Edit Chapter
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteGroup(chapter)}>
                                                        <Trash2 className="size-4 mr-2" /> Delete Chapter
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </CardHeader>

                                {!isChapterCollapsed && (
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
                                                        <section key={subgroup.id} className={!subgroup.is_enabled ? 'opacity-60' : ''}>
                                                            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b">
                                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleSubgroupCollapse(subgroup.id)}
                                                                        className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
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
                                                                        onClick={() => selectAllInGroup(subgroup)}
                                                                        className="text-muted-foreground hover:text-foreground shrink-0 mr-1"
                                                                    >
                                                                        {isSubAllSelected ? (
                                                                            <CheckSquare className="size-3.5 text-primary" />
                                                                        ) : (
                                                                            <Square className="size-3.5" />
                                                                        )}
                                                                    </button>
                                                                    <h4
                                                                        className="font-semibold text-sm uppercase tracking-wide text-muted-foreground cursor-pointer select-none"
                                                                        onClick={() => toggleSubgroupCollapse(subgroup.id)}
                                                                    >
                                                                        {subgroup.title}
                                                                    </h4>
                                                                    {!subgroup.is_enabled && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                                                                    {(subgroup.vessel_type_ids || []).length > 0 && (
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                            {(vessel_types || [])
                                                                                .filter((vt) => (subgroup.vessel_type_ids || []).includes(vt.id))
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
                                                                        onClick={() => handleToggleGroup(subgroup.id)}
                                                                    >
                                                                        {subgroup.is_enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddQuestion(subgroup.id)}>
                                                                        <Plus className="size-3 mr-1" /> Question
                                                                    </Button>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="More Options">
                                                                                <MoreHorizontal className="size-3.5" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-44">
                                                                            <DropdownMenuItem onClick={() => handleReorderGroup(subgroup.id, 'up')}>
                                                                                <ArrowUp className="size-3.5 mr-2" /> Move Up
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => handleReorderGroup(subgroup.id, 'down')}>
                                                                                <ArrowDown className="size-3.5 mr-2" /> Move Down
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => openGroupApplicability(subgroup)}>
                                                                                <Filter className="size-3.5 mr-2" /> Applicability
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => openHistory('group', subgroup.id, subgroup.title)}>
                                                                                <History className="size-3.5 mr-2" /> Change History
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => openEditGroup(subgroup)}>
                                                                                <Edit2 className="size-3.5 mr-2" /> Rename
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteGroup(subgroup)}>
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
                                                                            vesselTypes={vessel_types}
                                                                            isSelected={selectedQuestionIds.includes(q.id)}
                                                                            isExpanded={Boolean(expandedGuidance[q.id])}
                                                                            onSelect={() => toggleSelectQuestion(q.id)}
                                                                            onToggleGuidance={() => toggleGuidance(q.id)}
                                                                            onEdit={() => openEditQuestion(q)}
                                                                            onApplicability={() => openQuestionApplicability(q)}
                                                                            onHistory={() => openHistory('question', q.id, q.question_text)}
                                                                            onReorder={(dir) => handleReorderQuestion(q.id, dir)}
                                                                            onToggle={() => handleToggleQuestion(q.id)}
                                                                            onDuplicate={() => handleDuplicateQuestion(q.id)}
                                                                            onDelete={() => handleDeleteQuestion(q)}
                                                                        />
                                                                    ))}
                                                                    {(subgroup.questions || []).length === 0 && (
                                                                        <p className="text-xs text-muted-foreground italic py-2">No questions in this subgroup.</p>
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
                                                        vesselTypes={vessel_types}
                                                        isSelected={selectedQuestionIds.includes(q.id)}
                                                        isExpanded={Boolean(expandedGuidance[q.id])}
                                                        onSelect={() => toggleSelectQuestion(q.id)}
                                                        onToggleGuidance={() => toggleGuidance(q.id)}
                                                        onEdit={() => openEditQuestion(q)}
                                                        onApplicability={() => openQuestionApplicability(q)}
                                                        onHistory={() => openHistory('question', q.id, q.question_text)}
                                                        onReorder={(dir) => handleReorderQuestion(q.id, dir)}
                                                        onToggle={() => handleToggleQuestion(q.id)}
                                                        onDuplicate={() => handleDuplicateQuestion(q.id)}
                                                        onDelete={() => handleDeleteQuestion(q)}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {(chapter.questions || []).length === 0 &&
                                            (!chapter.subgroups || chapter.subgroups.length === 0) && (
                                                <p className="text-xs text-muted-foreground italic py-2">No questions in this chapter.</p>
                                            )}
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Group Dialog */}
            <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? 'Edit Group / Chapter' : groupParentId ? 'Add Subgroup' : 'Add Chapter / Section'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveGroup} className="space-y-4">
                        {!groupParentId && (
                            <div className="space-y-1">
                                <Label htmlFor="chapter_no">Chapter Number (optional)</Label>
                                <Input
                                    id="chapter_no"
                                    value={groupChapterNo}
                                    onChange={(e) => setGroupChapterNo(e.target.value)}
                                    placeholder="e.g. 4, 11"
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={groupTitle}
                                onChange={(e) => setGroupTitle(e.target.value)}
                                placeholder="Group title"
                                required
                            />
                        </div>
                        {!groupParentId && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="ice_class"
                                    checked={groupIceClass}
                                    onChange={(e) => setGroupIceClass(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="ice_class" className="cursor-pointer">Ice Class</Label>
                            </div>
                        )}
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setGroupModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Question Dialog */}
            <Dialog open={questionModalOpen} onOpenChange={setQuestionModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveQuestion} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="q_text">Question Text</Label>
                            <textarea
                                id="q_text"
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                rows={3}
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="q_guidance">Guidance Text / Bracketed Help (optional)</Label>
                            <textarea
                                id="q_guidance"
                                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                rows={2}
                                value={questionGuidance}
                                onChange={(e) => setQuestionGuidance(e.target.value)}
                                placeholder="Expandable help text for the inspector"
                            />
                        </div>

                        {/* Response & Input Capabilities (All Independent Checkboxes) */}
                        <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
                            <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                Response & Input Capabilities
                            </Label>

                            <div className="space-y-2.5">
                                {/* Choices Checkbox */}
                                <div className="flex items-center gap-2.5 pb-2.5 border-b">
                                    <input
                                        type="checkbox"
                                        id="chk_choices"
                                        checked={questionHasChoices}
                                        onChange={(e) => setQuestionHasChoices(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label htmlFor="chk_choices" className="cursor-pointer text-sm font-semibold">
                                        Standard Choices (Yes / No / NS / NA buttons)
                                    </Label>
                                </div>

                                <Label className="text-xs text-muted-foreground font-medium block pt-0.5">
                                    Input Fields (Check all that apply)
                                </Label>

                                <div className="space-y-2 pl-0.5">
                                    {/* Text Input Checkbox */}
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            id="chk_text"
                                            checked={questionHasText}
                                            onChange={(e) => setQuestionHasText(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <Label htmlFor="chk_text" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                            <span>Text / Remarks Input (notes, explanation, single-line text)</span>
                                        </Label>
                                    </div>

                                    {/* Date Input Checkbox */}
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            id="chk_date"
                                            checked={questionHasDate}
                                            onChange={(e) => setQuestionHasDate(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <Label htmlFor="chk_date" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                                            <span>Date Input (calendar date picker)</span>
                                        </Label>
                                    </div>

                                    {/* Numeric Input Checkbox */}
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            id="chk_number"
                                            checked={questionHasNumber}
                                            onChange={(e) => setQuestionHasNumber(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <Label htmlFor="chk_number" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                            <Hash className="size-3.5 text-muted-foreground shrink-0" />
                                            <span>Numeric Input (measurements, counts, pressure)</span>
                                        </Label>
                                    </div>

                                    {/* File Input Checkbox */}
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            id="chk_file"
                                            checked={questionHasFile}
                                            onChange={(e) => setQuestionHasFile(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <Label htmlFor="chk_file" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                            <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                                            <span>File / Attachment Input (document scan, certificate, photo upload)</span>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setQuestionModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Question</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Applicability Dialog (Task 2.4) */}
            <Dialog open={applicabilityModalOpen} onOpenChange={setApplicabilityModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Applicability</DialogTitle>
                    </DialogHeader>
                    {applicabilityTarget && (
                        <form onSubmit={handleSaveApplicability} className="space-y-4">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                <strong>Target:</strong> {applicabilityTarget.title}
                            </p>

                            <div className="space-y-2">
                                <Label>Applicable Vessel Types</Label>
                                <p className="text-xs text-muted-foreground">
                                    Leave all unselected to apply to all vessel types.
                                </p>
                                <div className="space-y-1.5 rounded border p-3">
                                    {vessel_types.map((vt) => (
                                        <div key={vt.id} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`vt_${vt.id}`}
                                                checked={selectedVesselTypes.includes(vt.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedVesselTypes((prev) => [...prev, vt.id]);
                                                    } else {
                                                        setSelectedVesselTypes((prev) => prev.filter((id) => id !== vt.id));
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            <Label htmlFor={`vt_${vt.id}`} className="cursor-pointer text-sm font-normal">
                                                {vt.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="app_ice_class"
                                    checked={selectedIceClassOnly}
                                    onChange={(e) => setSelectedIceClassOnly(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="app_ice_class" className="cursor-pointer">
                                    Ice Class Vessels Only
                                </Label>
                            </div>

                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setApplicabilityModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Save Applicability</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Bulk Move Dialog (Task 2.3) */}
            <Dialog open={bulkMoveModalOpen} onOpenChange={setBulkMoveModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move {selectedQuestionIds.length} Question(s)</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBulkMove} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="target_group">Destination Group / Subgroup</Label>
                            <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select destination group" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {groupsList.map((g) => (
                                        <SelectItem key={g.id} value={String(g.id)}>
                                            {g.parent_id ? `↳ ${g.title}` : g.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setBulkMoveModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!targetGroupId}>
                                Move Questions
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Modal (Task 2.6) */}
            <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
                <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Change History</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2 font-medium">{historyTitle}</p>

                    <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                        {historyLoading && <p className="text-sm text-muted-foreground">Loading history log...</p>}
                        {!historyLoading && historyItems.length === 0 && (
                            <p className="text-sm text-muted-foreground italic py-4 text-center">No change history recorded yet.</p>
                        )}
                        {!historyLoading && historyItems.map((item) => (
                            <div key={item.id} className="rounded border bg-muted/20 p-2.5 text-xs space-y-1">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="font-semibold text-foreground uppercase tracking-wider">{item.action}</span>
                                    <span>{new Date(item.created_at).toLocaleString()}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    By: <span className="text-foreground font-medium">{item.user?.name || 'System'}</span> ({item.user?.role || 'admin'})
                                </div>
                                {item.field && (
                                    <div className="text-muted-foreground">
                                        Field: <span className="font-mono">{item.field}</span>
                                    </div>
                                )}
                                {item.before_value !== null && (
                                    <div className="rounded bg-destructive/10 p-1 font-mono text-[11px] text-destructive">
                                        - {item.before_value}
                                    </div>
                                )}
                                {item.after_value !== null && (
                                    <div className="rounded bg-emerald-500/10 p-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                        + {item.after_value}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setHistoryModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

FormShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Form Templates', href: '/admin/forms' },
        { title: 'Template Editor', href: '/admin/forms' },
    ],
};

function QuestionRow({
    question,
    vesselTypes,
    isSelected,
    isExpanded,
    onSelect,
    onToggleGuidance,
    onEdit,
    onApplicability,
    onHistory,
    onReorder,
    onToggle,
    onDuplicate,
    onDelete,
}: {
    question: QuestionData;
    vesselTypes: VesselTypeItem[];
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: () => void;
    onToggleGuidance: () => void;
    onEdit: () => void;
    onApplicability: () => void;
    onHistory: () => void;
    onReorder: (dir: 'up' | 'down') => void;
    onToggle: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    return (
        <div className={`flex flex-col gap-1 rounded border p-2.5 transition-colors ${!question.is_enabled ? 'opacity-50 bg-muted/30' : 'bg-background hover:bg-muted/10'} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1">
                    <button type="button" onClick={onSelect} className="mt-0.5 text-muted-foreground hover:text-foreground">
                        {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>

                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-foreground">{question.question_text}</span>
                            {!question.is_enabled && <Badge variant="destructive" className="text-[10px] px-1 py-0">Disabled</Badge>}
                            {question.input_type !== 'none' && (
                                <div className="inline-flex items-center gap-1 flex-wrap">
                                    {question.input_type.split(',').map((typeToken) => (
                                        <Badge key={typeToken} variant="secondary" className="text-[10px] font-mono uppercase px-1.5 py-0">
                                            {typeToken.replace(/_/g, ' ')}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {question.ice_class_only && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Ice Class
                                </Badge>
                            )}
                            {(question.vessel_type_ids || []).length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {(vesselTypes || []).filter((vt) => (question.vessel_type_ids || []).includes(vt.id)).map((vt) => vt.name).join('/')}
                                </Badge>
                            )}
                            {question.guidance && (
                                <button
                                    type="button"
                                    onClick={onToggleGuidance}
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center"
                                    title="Toggle Guidance"
                                >
                                    <HelpCircle className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {isExpanded && question.guidance && (
                            <div className="mt-1.5 rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                                <strong>Guidance:</strong> {question.guidance}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={question.is_enabled ? 'Disable' : 'Enable'} onClick={onToggle}>
                        {question.is_enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={onEdit}>
                        <Edit2 className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="More Actions">
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onReorder('up')}>
                                <ArrowUp className="size-3.5 mr-2" /> Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReorder('down')}>
                                <ArrowDown className="size-3.5 mr-2" /> Move Down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onApplicability}>
                                <Filter className="size-3.5 mr-2" /> Applicability
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDuplicate}>
                                <Copy className="size-3.5 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onHistory}>
                                <History className="size-3.5 mr-2" /> Change History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                                <Trash2 className="size-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
