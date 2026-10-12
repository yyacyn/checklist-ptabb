import { Head, router } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Camera,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Plus,
} from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ApplicabilityModalDialog,
    BulkMoveModalDialog,
    ChapterEditorCard,
    FormChapterSidebar,
    GroupModalDialog,
    HistoryModalDialog,
    PhotoSchemaEditor,
    QuestionModalDialog,
    StandalonePhotoEditor,
    SummarySchemaEditor,
    type FormGroupData,
    type FormGroupOption,
    type FormHistoryItem,
    type FormQuestionData,
    type FormVesselTypeItem,
    type PhotoCategoryItem,
    type PhotoFormItem,
    type PhotoFormOption,
    type PhotoSchema,
    type SummarySchema,
    type SummarySchemaRatingOption,
    type SummarySchemaTextField,
} from '@/components/forms';

export type QuestionData = FormQuestionData;
export type GroupData = FormGroupData;
export type VesselTypeItem = FormVesselTypeItem;
export type GroupOption = FormGroupOption;
export type HistoryItem = FormHistoryItem;
export type PhotoCategoryOption = PhotoCategoryItem;

export type {
    PhotoCategoryItem,
    PhotoFormItem,
    PhotoFormOption,
    PhotoSchema,
    SummarySchema,
    SummarySchemaRatingOption,
    SummarySchemaTextField,
};

interface FormData {
    id: number;
    code: string;
    name: string;
    form_version: string;
    template_version: number;
    answer_set: string;
    form_type?: 'standard' | 'photo';
    summary_schema?: SummarySchema | null;
    photo_schema?: PhotoSchema | null;
}

interface Props {
    form: FormData;
    chapters?: FormGroupData[];
    all_groups?: FormGroupOption[];
    flat_groups?: FormGroupOption[];
    vessel_types?: FormVesselTypeItem[];
    available_photo_forms?: PhotoFormOption[];
    photo_categories?: PhotoCategoryOption[];
}

export default function FormShow({
    form,
    chapters = [],
    all_groups = [],
    flat_groups = [],
    vessel_types = [],
    available_photo_forms = [],
}: Props) {
    const groupsList = all_groups.length > 0 ? all_groups : flat_groups;

    // Group Modal State
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<FormGroupData | null>(null);
    const [groupParentId, setGroupParentId] = useState<number | null>(null);

    // Question Modal State
    const [questionModalOpen, setQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<FormQuestionData | null>(null);
    const [questionGroupId, setQuestionGroupId] = useState<number | null>(null);

    // Applicability Modal State (Task 2.4)
    const [applicabilityModalOpen, setApplicabilityModalOpen] = useState(false);
    const [applicabilityTarget, setApplicabilityTarget] = useState<{
        type: 'group' | 'question';
        id: number;
        title: string;
    } | null>(null);
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
    const [historyItems, setHistoryItems] = useState<FormHistoryItem[]>([]);

    const isPhotoForm = form.form_type === 'photo';

    // Summary Chapter State
    const [summaryChapterCollapsed, setSummaryChapterCollapsed] = useState(false);
    const [summaryFormState, setSummaryFormState] = useState<SummarySchema>(() => ({
        enabled: !isPhotoForm && (form.summary_schema?.enabled ?? (form.code === 'D-062' || form.code === 'B-008')),
        title: form.summary_schema?.title ?? 'Summary & Observations',
        has_ratings_matrix: form.summary_schema?.has_ratings_matrix ?? false,
        rating_options: form.summary_schema?.rating_options ?? [
            { value: 'very_good', label: 'Very Good' },
            { value: 'satisfactory', label: 'Satisfactory' },
            { value: 'unsatisfactory', label: 'Unsatisfactory' },
        ],
        text_fields: form.summary_schema?.text_fields ?? [],
        has_findings_register: form.summary_schema?.has_findings_register ?? true,
    }));
    const [isSavingSummary, setIsSavingSummary] = useState(false);

    // Photo Form State
    const [photoChapterCollapsed, setPhotoChapterCollapsed] = useState(false);
    const [photoFormState, setPhotoFormState] = useState<PhotoSchema>(() => ({
        enabled: isPhotoForm || Boolean(form.photo_schema?.enabled),
        title: form.photo_schema?.title ?? (isPhotoForm ? form.name : 'Photographic Records'),
        description: form.photo_schema?.description ?? '',
        attached_form_id: form.photo_schema?.attached_form_id ?? null,
        items: form.photo_schema?.items ?? [],
    }));
    const [isSavingPhoto, setIsSavingPhoto] = useState(false);

    const [activeNavChapterId, setActiveNavChapterId] = useState<number | 'summary' | 'photo'>(() => {
        if (chapters.length > 0) return chapters[0].id;
        if (!isPhotoForm && summaryFormState.enabled) return 'summary';
        return 'photo';
    });

    // Make sure activeNavChapterId stays valid when chapters change
    React.useEffect(() => {
        if (typeof activeNavChapterId === 'number' && !chapters.some((c) => c.id === activeNavChapterId)) {
            if (chapters.length > 0) {
                setActiveNavChapterId(chapters[0].id);
            } else if (!isPhotoForm && summaryFormState.enabled) {
                setActiveNavChapterId('summary');
            } else {
                setActiveNavChapterId('photo');
            }
        }
    }, [chapters, isPhotoForm, summaryFormState.enabled]);

    const allTabs: Array<{ id: number | 'summary' | 'photo'; title: string }> = [
        ...chapters.map((c) => ({
            id: c.id,
            title: `${c.chapter_no ? c.chapter_no + '. ' : ''}${c.title}`,
        })),
        ...(!isPhotoForm && summaryFormState.enabled
            ? [{ id: 'summary' as const, title: summaryFormState.title || 'Summary & Observations' }]
            : []),
        ...(photoFormState.enabled || isPhotoForm
            ? [{ id: 'photo' as const, title: photoFormState.title || 'Photographic Records' }]
            : []),
    ];

    const currentTabIndex = allTabs.findIndex((t) => t.id === activeNavChapterId);
    const prevTab = currentTabIndex > 0 ? allTabs[currentTabIndex - 1] : null;
    const nextTab = currentTabIndex >= 0 && currentTabIndex < allTabs.length - 1 ? allTabs[currentTabIndex + 1] : null;

    const handleSelectTab = (id: number | 'summary' | 'photo') => {
        setActiveNavChapterId(id);
    };

    const handleSavePhotoSchema = () => {
        setIsSavingPhoto(true);
        router.put(
            `/admin/forms/${form.id}/photo-schema`,
            { photo_schema: photoFormState as any },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSavingPhoto(false);
                },
                onError: () => {
                    setIsSavingPhoto(false);
                },
            }
        );
    };

    const handleRemovePhotoChapter = () => {
        if (confirm('Are you sure you want to remove the Photo Form from this template?')) {
            setIsSavingPhoto(true);
            const updated = { ...photoFormState, enabled: false, attached_form_id: null, items: [] };
            setPhotoFormState(updated);
            router.put(
                `/admin/forms/${form.id}/photo-schema`,
                { photo_schema: updated as any },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setIsSavingPhoto(false);
                        if (chapters.length > 0) {
                            setActiveNavChapterId(chapters[0].id);
                        } else if (summaryFormState.enabled) {
                            setActiveNavChapterId('summary');
                        }
                    },
                    onError: () => {
                        setIsSavingPhoto(false);
                    },
                }
            );
        }
    };

    const handleRemoveSummaryChapter = () => {
        if (confirm('Are you sure you want to remove the Summary Chapter from this template?')) {
            setIsSavingSummary(true);
            const updated = { ...summaryFormState, enabled: false };
            setSummaryFormState(updated);
            router.put(
                `/admin/forms/${form.id}/summary-schema`,
                { summary_schema: updated as any },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setIsSavingSummary(false);
                        if (chapters.length > 0) {
                            setActiveNavChapterId(chapters[0].id);
                        } else if (photoFormState.enabled) {
                            setActiveNavChapterId('photo');
                        }
                    },
                    onError: () => {
                        setIsSavingSummary(false);
                    },
                }
            );
        }
    };

    const handleSaveSummarySchema = () => {
        setIsSavingSummary(true);
        router.put(
            `/admin/forms/${form.id}/summary-schema`,
            { summary_schema: summaryFormState as any },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSavingSummary(false);
                },
                onError: () => {
                    setIsSavingSummary(false);
                },
            }
        );
    };

    // Guidance expansion state
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
        setSummaryChapterCollapsed(false);
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
        setSummaryChapterCollapsed(true);
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

    const getAllGroupQuestionIds = (group: FormGroupData): number[] => {
        const direct = (group.questions || []).map((q) => q.id);
        const sub = (group.subgroups || []).flatMap((sg) => (sg.questions || []).map((q) => q.id));
        return [...direct, ...sub];
    };

    const selectAllInGroup = (group: FormGroupData) => {
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
        setGroupModalOpen(true);
    };

    const openAddSubgroup = (parentId: number) => {
        setEditingGroup(null);
        setGroupParentId(parentId);
        setGroupModalOpen(true);
    };

    const openEditGroup = (group: FormGroupData) => {
        setEditingGroup(group);
        setGroupParentId(null);
        setGroupModalOpen(true);
    };

    // Open Question Modal
    const openAddQuestion = (groupId: number) => {
        setEditingQuestion(null);
        setQuestionGroupId(groupId);
        setQuestionModalOpen(true);
    };

    const openEditQuestion = (question: FormQuestionData) => {
        setEditingQuestion(question);
        setQuestionGroupId(null);
        setQuestionModalOpen(true);
    };

    // Applicability Modal (Task 2.4)
    const openGroupApplicability = (group: FormGroupData) => {
        setApplicabilityTarget({ type: 'group', id: group.id, title: group.title });
        setSelectedVesselTypes(group.vessel_type_ids || []);
        setSelectedIceClassOnly(group.ice_class_only);
        setApplicabilityModalOpen(true);
    };

    const openQuestionApplicability = (question: FormQuestionData) => {
        setApplicabilityTarget({ type: 'question', id: question.id, title: question.question_text });
        setSelectedVesselTypes(question.vessel_type_ids || []);
        setSelectedIceClassOnly(question.ice_class_only);
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
                preserveScroll: true,
                onSuccess: () => setApplicabilityModalOpen(false),
            }
        );
    };

    // Bulk Move (Task 2.3)
    const handleBulkMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedQuestionIds.length === 0 || !targetGroupId) return;

        router.post(
            '/admin/questions/bulk-move',
            {
                question_ids: selectedQuestionIds,
                target_group_id: Number(targetGroupId),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBulkMoveModalOpen(false);
                    setSelectedQuestionIds([]);
                    setTargetGroupId('');
                },
            }
        );
    };

    // Bulk Toggle Group (Task 2.3)
    const handleBulkToggleGroup = (group: FormGroupData, enable: boolean) => {
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

    const handleDeleteGroup = (group: FormGroupData) => {
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

    const handleDeleteQuestion = (question: FormQuestionData) => {
        if (confirm('Are you sure you want to delete this question?')) {
            router.delete(`/admin/questions/${question.id}`, { preserveScroll: true });
        }
    };

    if (isPhotoForm) {
        return (
            <>
                <Head title={`Photo Form: ${form.code}`} />
                <StandalonePhotoEditor
                    form={form}
                    photoFormState={photoFormState}
                    setPhotoFormState={setPhotoFormState}
                    isSavingPhoto={isSavingPhoto}
                    onSavePhotoSchema={handleSavePhotoSchema}
                />
            </>
        );
    }

    const activeChapter =
        typeof activeNavChapterId === 'number'
            ? chapters.find((c) => c.id === activeNavChapterId) || chapters[0]
            : null;

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
                            <Badge variant="default">
                                {form.code} v{form.template_version}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                (Paper {form.form_version})
                            </span>
                        </div>
                        <Heading
                            title={form.name}
                            description="Superadmin template editor: live changes update future reports immediately."
                        />
                    </div>

                    <div className="flex items-center gap-2 self-start flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={expandAll}
                            className="flex items-center gap-1.5 text-xs"
                        >
                            <ChevronsUpDown className="size-3.5" />
                            <span>Expand All</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={collapseAll}
                            className="flex items-center gap-1.5 text-xs"
                        >
                            <ChevronsDownUp className="size-3.5" />
                            <span>Collapse All</span>
                        </Button>
                        {selectedQuestionIds.length > 0 && (
                            <Button
                                variant="secondary"
                                onClick={() => setBulkMoveModalOpen(true)}
                                className="flex items-center gap-1.5"
                            >
                                <ArrowRightLeft className="size-4" />
                                <span>Move {selectedQuestionIds.length} Selected Question(s)</span>
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="flex items-center gap-1.5">
                                    <Plus className="size-4" />
                                    <span>Add Chapter</span>
                                    <ChevronDown className="size-3.5 ml-0.5 opacity-70" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={openAddChapter} className="cursor-pointer">
                                    <Plus className="size-4 mr-2" />
                                    <span>Questions Chapter</span>
                                </DropdownMenuItem>
                                {!isPhotoForm && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            const updated = { ...summaryFormState, enabled: true };
                                            setSummaryFormState(updated);
                                            handleSelectTab('summary');
                                            router.put(
                                                `/admin/forms/${form.id}/summary-schema`,
                                                { summary_schema: updated as any },
                                                { preserveScroll: true }
                                            );
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <FileText className="size-4 mr-2" />
                                        <span>Summary Chapter</span>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => {
                                        const updated = { ...photoFormState, enabled: true };
                                        setPhotoFormState(updated);
                                        handleSelectTab('photo');
                                        router.put(
                                            `/admin/forms/${form.id}/photo-schema`,
                                            { photo_schema: updated as any },
                                            { preserveScroll: true }
                                        );
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Camera className="size-4 mr-2" />
                                    <span>Attach Photo Form</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* 2-Column Split: Sticky Table of Chapters Sidebar (Left) + Chapter Tree (Right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Left Sticky Table of Chapters Sidebar */}
                    <FormChapterSidebar
                        chapters={chapters}
                        isPhotoForm={isPhotoForm}
                        summaryFormState={summaryFormState}
                        photoFormState={photoFormState}
                        activeNavChapterId={activeNavChapterId}
                        onSelectTab={handleSelectTab}
                        getAllGroupQuestionIds={getAllGroupQuestionIds}
                    />

                    {/* Right Main Column: Active Chapter / Tab View */}
                    <div className="flex-1 min-w-0 space-y-6">
                        {activeNavChapterId === 'summary' && !isPhotoForm && (
                            <SummarySchemaEditor
                                summaryFormState={summaryFormState}
                                setSummaryFormState={setSummaryFormState}
                                isSavingSummary={isSavingSummary}
                                onSaveSummarySchema={handleSaveSummarySchema}
                                onRemoveSummaryChapter={handleRemoveSummaryChapter}
                                collapsed={summaryChapterCollapsed}
                                onToggleCollapse={() =>
                                    setSummaryChapterCollapsed((prev) => !prev)
                                }
                                prevTab={prevTab}
                                nextTab={nextTab}
                                onSelectTab={handleSelectTab}
                            />
                        )}

                        {activeNavChapterId === 'photo' && (
                            <PhotoSchemaEditor
                                isPhotoForm={isPhotoForm}
                                formName={form.name}
                                photoFormState={photoFormState}
                                setPhotoFormState={setPhotoFormState}
                                availablePhotoForms={available_photo_forms}
                                isSavingPhoto={isSavingPhoto}
                                onSavePhotoSchema={handleSavePhotoSchema}
                                onRemovePhotoChapter={handleRemovePhotoChapter}
                                collapsed={photoChapterCollapsed}
                                onToggleCollapse={() =>
                                    setPhotoChapterCollapsed((prev) => !prev)
                                }
                                prevTab={prevTab}
                                nextTab={nextTab}
                                onSelectTab={handleSelectTab}
                            />
                        )}

                        {typeof activeNavChapterId === 'number' &&
                            (activeChapter ? (
                                <ChapterEditorCard
                                    key={activeChapter.id}
                                    chapter={activeChapter}
                                    vesselTypes={vessel_types}
                                    selectedQuestionIds={selectedQuestionIds}
                                    isCollapsed={Boolean(collapsedChapters[activeChapter.id])}
                                    onToggleCollapse={() =>
                                        toggleChapterCollapse(activeChapter.id)
                                    }
                                    onSelectAllInGroup={selectAllInGroup}
                                    onToggleGroup={handleToggleGroup}
                                    onBulkToggleGroup={handleBulkToggleGroup}
                                    onReorderGroup={handleReorderGroup}
                                    onOpenGroupApplicability={openGroupApplicability}
                                    onOpenHistory={openHistory}
                                    onOpenEditGroup={openEditGroup}
                                    onDeleteGroup={handleDeleteGroup}
                                    onOpenAddSubgroup={openAddSubgroup}
                                    onOpenAddQuestion={openAddQuestion}
                                    collapsedSubgroups={collapsedSubgroups}
                                    onToggleSubgroupCollapse={toggleSubgroupCollapse}
                                    expandedGuidance={expandedGuidance}
                                    onToggleGuidance={toggleGuidance}
                                    onToggleSelectQuestion={toggleSelectQuestion}
                                    onOpenEditQuestion={openEditQuestion}
                                    onOpenQuestionApplicability={openQuestionApplicability}
                                    onReorderQuestion={handleReorderQuestion}
                                    onToggleQuestion={handleToggleQuestion}
                                    onDuplicateQuestion={handleDuplicateQuestion}
                                    onDeleteQuestion={handleDeleteQuestion}
                                    prevTab={prevTab}
                                    nextTab={nextTab}
                                    onSelectTab={handleSelectTab}
                                />
                            ) : (
                                <Card className="p-8 text-center border-dashed">
                                    <p className="text-sm text-muted-foreground">
                                        No chapters available in this template.
                                    </p>
                                    <Button onClick={openAddChapter} className="mt-4">
                                        <Plus className="size-4 mr-1.5" /> Add Chapter / Section
                                    </Button>
                                </Card>
                            ))}
                    </div>
                </div>
            </div>

            {/* Modal Dialogs */}
            <GroupModalDialog
                open={groupModalOpen}
                onOpenChange={setGroupModalOpen}
                editingGroup={editingGroup}
                parentId={groupParentId}
                formId={form.id}
                suggestedChapterNo={String(chapters.length + 1)}
            />

            <QuestionModalDialog
                open={questionModalOpen}
                onOpenChange={setQuestionModalOpen}
                editingQuestion={editingQuestion}
                groupId={questionGroupId}
            />

            <ApplicabilityModalDialog
                open={applicabilityModalOpen}
                onOpenChange={setApplicabilityModalOpen}
                target={applicabilityTarget}
                vesselTypes={vessel_types}
                selectedVesselTypes={selectedVesselTypes}
                onSelectedVesselTypesChange={setSelectedVesselTypes}
                selectedIceClassOnly={selectedIceClassOnly}
                onSelectedIceClassOnlyChange={setSelectedIceClassOnly}
                onSubmit={handleSaveApplicability}
            />

            <BulkMoveModalDialog
                open={bulkMoveModalOpen}
                onOpenChange={setBulkMoveModalOpen}
                selectedCount={selectedQuestionIds.length}
                groupsList={groupsList}
                targetGroupId={targetGroupId}
                onTargetGroupIdChange={setTargetGroupId}
                onSubmit={handleBulkMove}
            />

            <HistoryModalDialog
                open={historyModalOpen}
                onOpenChange={setHistoryModalOpen}
                title={historyTitle}
                loading={historyLoading}
                items={historyItems}
            />
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
