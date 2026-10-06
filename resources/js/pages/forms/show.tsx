import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowRightLeft,
    ArrowUp,
    CheckSquare,
    Copy,
    Edit2,
    Eye,
    EyeOff,
    Filter,
    FolderPlus,
    HelpCircle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';

interface QuestionData {
    id: number;
    group_id?: number;
    question_text: string;
    guidance: string | null;
    input_type: string;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only?: boolean;
    vessel_type_ids?: number[];
    reports_count: number;
}

interface GroupData {
    id: number;
    title: string;
    chapter_no: string | null;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only: boolean;
    vessel_type_ids?: number[];
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

interface FlatGroup {
    id: number;
    title: string;
    chapter_no: string | null;
    parent_id: number | null;
}

interface VesselTypeItem {
    id: number;
    name: string;
}

interface Props {
    form: FormData;
    chapters: GroupData[];
    flat_groups?: FlatGroup[];
    all_groups?: FlatGroup[];
    vessel_types?: VesselTypeItem[];
}

export default function FormShow({ form, chapters, flat_groups = [], all_groups = [], vessel_types = [] }: Props) {
    const groupsList = flat_groups.length > 0 ? flat_groups : all_groups;
    const breadcrumbs = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Form Templates', href: '/admin/forms' },
        { title: `${form.code} (${form.name})`, href: `/admin/forms/${form.id}` },
    ];

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
    const [questionInputType, setQuestionInputType] = useState('none');

    // Bulk Move State (Task 2.3)
    const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
    const [targetGroupId, setTargetGroupId] = useState<string>('');

    // Applicability State (Task 2.4)
    const [applicabilityModalOpen, setApplicabilityModalOpen] = useState(false);
    const [applicabilityTarget, setApplicabilityTarget] = useState<{
        type: 'group' | 'question';
        id: number;
        title: string;
    } | null>(null);
    const [selectedVesselTypes, setSelectedVesselTypes] = useState<number[]>([]);
    const [selectedIceClassOnly, setSelectedIceClassOnly] = useState(false);

    // Expanded guidance state
    const [expandedGuidance, setExpandedGuidance] = useState<Record<number, boolean>>({});

    const toggleGuidance = (id: number) => {
        setExpandedGuidance((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Selection toggle for bulk operations
    const toggleSelectQuestion = (id: number) => {
        setSelectedQuestionIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectAllInGroup = (group: GroupData) => {
        const ids = group.questions.map((q) => q.id);
        const allSelected = ids.every((id) => selectedQuestionIds.includes(id));
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
                onSuccess: () => setGroupModalOpen(false),
            });
        } else {
            router.post(`/admin/forms/${form.id}/groups`, {
                title: groupTitle,
                chapter_no: groupChapterNo || null,
                parent_id: groupParentId,
                ice_class_only: groupIceClass,
            }, {
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
        setQuestionInputType('none');
        setQuestionModalOpen(true);
    };

    const openEditQuestion = (question: QuestionData) => {
        setEditingQuestion(question);
        setQuestionGroupId(null);
        setQuestionText(question.question_text);
        setQuestionGuidance(question.guidance || '');
        setQuestionInputType(question.input_type);
        setQuestionModalOpen(true);
    };

    const handleSaveQuestion = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingQuestion) {
            router.put(`/admin/questions/${editingQuestion.id}`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: questionInputType,
            }, {
                onSuccess: () => setQuestionModalOpen(false),
            });
        } else if (questionGroupId) {
            router.post(`/admin/groups/${questionGroupId}/questions`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: questionInputType,
            }, {
                onSuccess: () => setQuestionModalOpen(false),
            });
        }
    };

    // Action Helpers
    const handleReorderGroup = (id: number, direction: 'up' | 'down') => {
        router.post(`/admin/groups/${id}/reorder`, { direction });
    };

    const handleToggleGroup = (id: number) => {
        router.post(`/admin/groups/${id}/toggle`);
    };

    const handleDeleteGroup = (group: GroupData) => {
        const isUsed = group.reports_count > 0;
        const msg = isUsed
            ? `This group is used in ${group.reports_count} historical report(s). Deleting will archive it from future reports while preserving history (FM-9). Proceed?`
            : 'Are you sure you want to delete this group?';

        if (confirm(msg)) {
            router.delete(`/admin/groups/${group.id}`);
        }
    };

    const handleReorderQuestion = (id: number, direction: 'up' | 'down') => {
        router.post(`/admin/questions/${id}/reorder`, { direction });
    };

    const handleToggleQuestion = (id: number) => {
        router.post(`/admin/questions/${id}/toggle`);
    };

    const handleDuplicateQuestion = (id: number) => {
        router.post(`/admin/questions/${id}/duplicate`);
    };

    const handleDeleteQuestion = (question: QuestionData) => {
        const isUsed = question.reports_count > 0;
        const msg = isUsed
            ? `This question is used in ${question.reports_count} historical report(s). Deleting will archive it from future reports while preserving history (FM-9). Proceed?`
            : 'Are you sure you want to delete this question?';

        if (confirm(msg)) {
            router.delete(`/admin/questions/${question.id}`);
        }
    };

    // Bulk Move (Task 2.3)
    const handleBulkMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedQuestionIds.length === 0 || !targetGroupId) return;

        router.post('/admin/questions/bulk-move', {
            question_ids: selectedQuestionIds,
            target_group_id: Number(targetGroupId),
        }, {
            onSuccess: () => {
                setBulkMoveModalOpen(false);
                setSelectedQuestionIds([]);
                setTargetGroupId('');
            },
        });
    };

    // Bulk Toggle Group (Task 2.3)
    const handleBulkToggleGroup = (group: GroupData, enable: boolean) => {
        router.post(`/admin/groups/${group.id}/bulk-toggle`, { enable });
    };

    // Applicability Handlers (Task 2.4)
    const openGroupApplicability = (group: GroupData) => {
        setApplicabilityTarget({ type: 'group', id: group.id, title: group.title });
        setSelectedVesselTypes(group.vessel_type_ids || []);
        setSelectedIceClassOnly(group.ice_class_only);
        setApplicabilityModalOpen(true);
    };

    const openQuestionApplicability = (question: QuestionData) => {
        setApplicabilityTarget({ type: 'question', id: question.id, title: question.question_text });
        setSelectedVesselTypes(question.vessel_type_ids || []);
        setSelectedIceClassOnly(Boolean(question.ice_class_only));
        setApplicabilityModalOpen(true);
    };

    const handleSaveApplicability = (e: React.FormEvent) => {
        e.preventDefault();
        if (!applicabilityTarget) return;

        const url =
            applicabilityTarget.type === 'group'
                ? `/admin/groups/${applicabilityTarget.id}/applicability`
                : `/admin/questions/${applicabilityTarget.id}/applicability`;

        router.put(
            url,
            {
                vessel_type_ids: selectedVesselTypes,
                ice_class_only: selectedIceClassOnly,
            },
            {
                onSuccess: () => setApplicabilityModalOpen(false),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
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
                        <Heading title={form.name} description="Superadmin template editor: live changes update future reports immediately (FM-11)." />
                    </div>

                    <div className="flex items-center gap-2 self-start">
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
                    {chapters.map((chapter) => (
                        <Card key={chapter.id} className={`border-2 ${!chapter.is_enabled ? 'opacity-60 bg-muted/20' : ''}`}>
                            <CardHeader className="bg-muted/40 p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => selectAllInGroup(chapter)}
                                            className="text-muted-foreground hover:text-foreground mr-1"
                                            title="Select all questions in this group"
                                        >
                                            {chapter.questions.length > 0 && chapter.questions.every((q) => selectedQuestionIds.includes(q.id)) ? (
                                                <CheckSquare className="size-4 text-primary" />
                                            ) : (
                                                <Square className="size-4" />
                                            )}
                                        </button>
                                        {chapter.chapter_no && (
                                            <Badge variant="secondary" className="font-mono">
                                                Ch. {chapter.chapter_no}
                                            </Badge>
                                        )}
                                        <h3 className="font-semibold text-lg">{chapter.title}</h3>
                                        {!chapter.is_enabled && <Badge variant="destructive">Disabled</Badge>}
                                        {chapter.ice_class_only && <Badge variant="outline">Ice Class Only</Badge>}
                                        {chapter.vessel_type_ids && chapter.vessel_type_ids.length > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                                {vessel_types.filter((vt) => chapter.vessel_type_ids?.includes(vt.id)).map((vt) => vt.name).join('/')} only
                                            </Badge>
                                        )}
                                        {chapter.reports_count > 0 && (
                                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                                Used in {chapter.reports_count} reports
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" title="Move Up" onClick={() => handleReorderGroup(chapter.id, 'up')}>
                                            <ArrowUp className="size-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" title="Move Down" onClick={() => handleReorderGroup(chapter.id, 'down')}>
                                            <ArrowDown className="size-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" title={chapter.is_enabled ? 'Disable' : 'Enable'} onClick={() => handleToggleGroup(chapter.id)}>
                                            {chapter.is_enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                                        </Button>
                                        <Button size="sm" variant="outline" title="Bulk toggle all questions in group" onClick={() => handleBulkToggleGroup(chapter, !chapter.is_enabled)}>
                                            {chapter.is_enabled ? 'Disable All' : 'Enable All'}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => openGroupApplicability(chapter)} title="Edit Applicability (FM-4)">
                                            <Filter className="size-3.5 mr-1" /> Applicability
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => openEditGroup(chapter)}>
                                            <Edit2 className="size-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => openAddSubgroup(chapter.id)}>
                                            <FolderPlus className="size-3.5 mr-1" /> Add Subgroup
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => openAddQuestion(chapter.id)}>
                                            <Plus className="size-3.5 mr-1" /> Add Question
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteGroup(chapter)}>
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4 p-4">
                                {/* Subgroups */}
                                {chapter.subgroups && chapter.subgroups.length > 0 && (
                                    <div className="space-y-4 pl-4 border-l-2 border-border/80">
                                        {chapter.subgroups.map((subgroup) => (
                                            <div key={subgroup.id} className="rounded-lg border bg-card p-3 shadow-xs">
                                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-2 mb-2 border-b">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => selectAllInGroup(subgroup)}
                                                            className="text-muted-foreground hover:text-foreground mr-1"
                                                            title="Select all questions in this subgroup"
                                                        >
                                                            {subgroup.questions.length > 0 && subgroup.questions.every((q) => selectedQuestionIds.includes(q.id)) ? (
                                                                <CheckSquare className="size-4 text-primary" />
                                                            ) : (
                                                                <Square className="size-4" />
                                                            )}
                                                        </button>
                                                        <h4 className="font-medium text-sm text-foreground">{subgroup.title}</h4>
                                                        {!subgroup.is_enabled && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                                                        {subgroup.ice_class_only && <Badge variant="outline" className="text-xs">Ice Class Only</Badge>}
                                                        {subgroup.vessel_type_ids && subgroup.vessel_type_ids.length > 0 && (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {vessel_types.filter((vt) => subgroup.vessel_type_ids?.includes(vt.id)).map((vt) => vt.name).join('/')} only
                                                            </Badge>
                                                        )}
                                                        {subgroup.reports_count > 0 && (
                                                            <span className="text-xs text-muted-foreground">({subgroup.reports_count} reports)</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => handleReorderGroup(subgroup.id, 'up')}>
                                                            <ArrowUp className="size-3" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleReorderGroup(subgroup.id, 'down')}>
                                                            <ArrowDown className="size-3" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleToggleGroup(subgroup.id)}>
                                                            {subgroup.is_enabled ? <Eye className="size-3" /> : <EyeOff className="size-3 text-muted-foreground" />}
                                                        </Button>
                                                        <Button size="sm" variant="outline" title="Bulk toggle all questions in subgroup" onClick={() => handleBulkToggleGroup(subgroup, !subgroup.is_enabled)}>
                                                            {subgroup.is_enabled ? 'Disable All' : 'Enable All'}
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => openGroupApplicability(subgroup)} title="Edit Applicability (FM-4)">
                                                            <Filter className="size-3 mr-1" /> Applicability
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => openEditGroup(subgroup)}>
                                                            <Edit2 className="size-3 mr-1" /> Rename
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => openAddQuestion(subgroup.id)}>
                                                            <Plus className="size-3 mr-1" /> Question
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteGroup(subgroup)}>
                                                            <Trash2 className="size-3" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Subgroup Questions */}
                                                <div className="space-y-2">
                                                    {subgroup.questions.map((q) => (
                                                        <QuestionRow
                                                            key={q.id}
                                                            question={q}
                                                            vesselTypes={vessel_types}
                                                            isSelected={selectedQuestionIds.includes(q.id)}
                                                            onSelect={() => toggleSelectQuestion(q.id)}
                                                            isExpanded={Boolean(expandedGuidance[q.id])}
                                                            onToggleGuidance={() => toggleGuidance(q.id)}
                                                            onEdit={() => openEditQuestion(q)}
                                                            onApplicability={() => openQuestionApplicability(q)}
                                                            onReorder={(dir) => handleReorderQuestion(q.id, dir)}
                                                            onToggle={() => handleToggleQuestion(q.id)}
                                                            onDuplicate={() => handleDuplicateQuestion(q.id)}
                                                            onDelete={() => handleDeleteQuestion(q)}
                                                        />
                                                    ))}
                                                    {subgroup.questions.length === 0 && (
                                                        <p className="text-xs text-muted-foreground italic py-2">No questions in this subgroup.</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Direct Chapter Questions */}
                                <div className="space-y-2">
                                    {chapter.questions.map((q) => (
                                        <QuestionRow
                                            key={q.id}
                                            question={q}
                                            vesselTypes={vessel_types}
                                            isSelected={selectedQuestionIds.includes(q.id)}
                                            onSelect={() => toggleSelectQuestion(q.id)}
                                            isExpanded={Boolean(expandedGuidance[q.id])}
                                            onToggleGuidance={() => toggleGuidance(q.id)}
                                            onEdit={() => openEditQuestion(q)}
                                            onApplicability={() => openQuestionApplicability(q)}
                                            onReorder={(dir) => handleReorderQuestion(q.id, dir)}
                                            onToggle={() => handleToggleQuestion(q.id)}
                                            onDuplicate={() => handleDuplicateQuestion(q.id)}
                                            onDelete={() => handleDeleteQuestion(q)}
                                        />
                                    ))}
                                    {chapter.questions.length === 0 && (!chapter.subgroups || chapter.subgroups.length === 0) && (
                                        <p className="text-xs text-muted-foreground italic py-2">No questions in this chapter.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
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
                                <Label htmlFor="ice_class" className="cursor-pointer">Ice Class Only</Label>
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

                        <div className="space-y-1">
                            <Label htmlFor="q_input_type">Extra Typed Input</Label>
                            <Select value={questionInputType} onValueChange={setQuestionInputType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select extra input type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (Standard Yes/No checkboxes)</SelectItem>
                                    <SelectItem value="date">Date Input</SelectItem>
                                    <SelectItem value="text">Text Input</SelectItem>
                                    <SelectItem value="number">Numeric Input</SelectItem>
                                </SelectContent>
                            </Select>
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

            {/* Bulk Move Dialog (Task 2.3) */}
            <Dialog open={bulkMoveModalOpen} onOpenChange={setBulkMoveModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move {selectedQuestionIds.length} Question(s) (FM-6)</DialogTitle>
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
                                            {g.chapter_no ? `Ch. ${g.chapter_no}: ` : ''}{g.title}
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

            {/* Applicability Dialog (Task 2.4) */}
            <Dialog open={applicabilityModalOpen} onOpenChange={setApplicabilityModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Applicability (FM-4)</DialogTitle>
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
        </AppLayout>
    );
}

function QuestionRow({
    question,
    vesselTypes = [],
    isSelected,
    onSelect,
    isExpanded,
    onToggleGuidance,
    onEdit,
    onApplicability,
    onReorder,
    onToggle,
    onDuplicate,
    onDelete,
}: {
    question: QuestionData;
    vesselTypes?: VesselTypeItem[];
    isSelected: boolean;
    onSelect: () => void;
    isExpanded: boolean;
    onToggleGuidance: () => void;
    onEdit: () => void;
    onApplicability: () => void;
    onReorder: (dir: 'up' | 'down') => void;
    onToggle: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    return (
        <div className={`flex flex-col gap-1 rounded border p-2.5 transition-colors ${!question.is_enabled ? 'opacity-50 bg-muted/30' : 'bg-background hover:bg-muted/10'} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                    <button
                        type="button"
                        onClick={onSelect}
                        className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                        title={isSelected ? 'Deselect question' : 'Select question for bulk actions'}
                    >
                        {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>

                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-foreground">{question.question_text}</span>
                            {!question.is_enabled && <Badge variant="destructive" className="text-[10px] px-1 py-0">Disabled</Badge>}
                            {question.input_type !== 'none' && (
                                <Badge variant="secondary" className="text-[10px] font-mono uppercase px-1.5 py-0">
                                    {question.input_type}
                                </Badge>
                            )}
                            {question.ice_class_only && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-600">
                                    Ice Class
                                </Badge>
                            )}
                            {question.vessel_type_ids && question.vessel_type_ids.length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {vesselTypes.filter((vt) => question.vessel_type_ids?.includes(vt.id)).map((vt) => vt.name).join('/')}
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
                            {question.reports_count > 0 && (
                                <span className="text-[10px] text-muted-foreground" title="Reports using this question">
                                    ({question.reports_count} reports)
                                </span>
                            )}
                        </div>

                        {isExpanded && question.guidance && (
                            <div className="mt-1.5 rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                                <strong>Guidance:</strong> {question.guidance}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Move Up" onClick={() => onReorder('up')}>
                        <ArrowUp className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Move Down" onClick={() => onReorder('down')}>
                        <ArrowDown className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={question.is_enabled ? 'Disable' : 'Enable'} onClick={onToggle}>
                        {question.is_enabled ? <Eye className="size-3" /> : <EyeOff className="size-3 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit Applicability (FM-4)" onClick={onApplicability}>
                        <Filter className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Duplicate" onClick={onDuplicate}>
                        <Copy className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={onEdit}>
                        <Edit2 className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" title="Delete / Archive" onClick={onDelete}>
                        <Trash2 className="size-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
