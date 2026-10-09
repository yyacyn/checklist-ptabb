import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowRightLeft,
    ArrowUp,
    Calendar,
    Camera,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
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
    HelpCircle,
    History,
    MoreHorizontal,
    Paperclip,
    Plus,
    Save,
    Square,
    Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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

export interface SummarySchemaRatingOption {
    value: string;
    label: string;
}

export interface SummarySchemaTextField {
    key: string;
    label: string;
    placeholder?: string;
    rows?: number;
    span?: 'full' | 'half';
}

export interface SummarySchema {
    enabled: boolean;
    title: string;
    has_ratings_matrix?: boolean;
    rating_options?: SummarySchemaRatingOption[];
    text_fields?: SummarySchemaTextField[];
    has_findings_register?: boolean;
}

export interface PhotoFormItem {
    id: string;
    title: string;
    description?: string;
}

export interface PhotoSchema {
    enabled: boolean;
    title?: string;
    description?: string;
    attached_form_id?: number | null;
    items?: PhotoFormItem[];
}

export interface PhotoFormOption {
    id: number;
    code: string;
    name: string;
}

export interface PhotoCategoryOption {
    id: number;
    name: string;
    code: string;
}

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
    available_photo_forms?: PhotoFormOption[];
    photo_categories?: PhotoCategoryOption[];
}

export function parseQuestionInputType(inputType: string) {
    const raw = (inputType || 'none').toLowerCase().trim();
    if (raw === 'none') {
        return { hasChoices: true, hasText: false, hasDate: false, hasFile: false };
    }
    const tokens = raw.split(',').map((t) => t.trim());
    const isPureOnly = tokens.some((t) => t.endsWith('_only'));
    const hasChoices = !isPureOnly && !tokens.includes('no_choices');

    return {
        hasChoices,
        hasText: tokens.includes('text') || tokens.includes('text_only'),
        hasDate: tokens.includes('date') || tokens.includes('date_only'),
        hasFile: tokens.includes('file') || tokens.includes('file_only'),
    };
}

export function buildQuestionInputType(flags: {
    hasChoices: boolean;
    hasText: boolean;
    hasDate: boolean;
    hasFile: boolean;
}): string {
    const types: string[] = [];
    if (flags.hasText) types.push('text');
    if (flags.hasDate) types.push('date');
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
    available_photo_forms = [],
    photo_categories = [],
}: Props) {
    const groupsList = all_groups.length > 0 ? all_groups : flat_groups;
    // Group Modal State
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
    const [groupParentId, setGroupParentId] = useState<number | null>(null);

    // Question Modal State
    const [questionModalOpen, setQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
    const [questionGroupId, setQuestionGroupId] = useState<number | null>(null);

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

    const handleAddPhotoItem = () => {
        setPhotoFormState((prev) => {
            const current = prev.items || [];
            return {
                ...prev,
                items: [
                    ...current,
                    {
                        id: String(Date.now()),
                        title: `Photo Item #${current.length + 1}`,
                    },
                ],
            };
        });
    };

    const handleUpdatePhotoItem = (idx: number, field: 'title' | 'description', value: string) => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            if (list[idx]) {
                list[idx] = { ...list[idx], [field]: value };
            }
            return { ...prev, items: list };
        });
    };

    const handleRemovePhotoItem = (idx: number) => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            list.splice(idx, 1);
            return { ...prev, items: list };
        });
    };

    const handleMovePhotoItem = (idx: number, direction: 'up' | 'down') => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= list.length) return prev;
            const temp = list[idx];
            list[idx] = list[targetIdx];
            list[targetIdx] = temp;
            return { ...prev, items: list };
        });
    };

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
        ...(!isPhotoForm && summaryFormState.enabled ? [{ id: 'summary' as const, title: summaryFormState.title || 'Summary & Observations' }] : []),
        ...(photoFormState.enabled || isPhotoForm ? [{ id: 'photo' as const, title: photoFormState.title || 'Photographic Records' }] : []),
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
        setGroupModalOpen(true);
    };

    const openAddSubgroup = (parentId: number) => {
        setEditingGroup(null);
        setGroupParentId(parentId);
        setGroupModalOpen(true);
    };

    const openEditGroup = (group: GroupData) => {
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

    const openEditQuestion = (question: QuestionData) => {
        setEditingQuestion(question);
        setQuestionGroupId(null);
        setQuestionModalOpen(true);
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

    const handleSaveSummarySchema = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
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

    const handleAddRatingOption = () => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: [
                ...(prev.rating_options || []),
                { value: `opt_${Date.now()}`, label: 'New Option' },
            ],
        }));
    };

    const handleRemoveRatingOption = (idx: number) => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: (prev.rating_options || []).filter((_, i) => i !== idx),
        }));
    };

    const handleUpdateRatingOption = (idx: number, field: 'value' | 'label', val: string) => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: (prev.rating_options || []).map((opt, i) =>
                i === idx ? { ...opt, [field]: val } : opt
            ),
        }));
    };

    const handleAddTextField = () => {
        const count = (summaryFormState.text_fields || []).length + 1;
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: [
                ...(prev.text_fields || []),
                {
                    key: `field_${Date.now()}`,
                    label: `${count}. Custom Observation Field`,
                    placeholder: 'Enter comments or observations...',
                    rows: 3,
                    span: 'full',
                },
            ],
        }));
    };

    const handleRemoveTextField = (idx: number) => {
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: (prev.text_fields || []).filter((_, i) => i !== idx),
        }));
    };

    const handleUpdateTextField = (
        idx: number,
        field: keyof SummarySchemaTextField,
        val: any
    ) => {
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: (prev.text_fields || []).map((tf, i) =>
                i === idx ? { ...tf, [field]: val } : tf
            ),
        }));
    };

    const handleMoveTextField = (idx: number, direction: 'up' | 'down') => {
        setSummaryFormState((prev) => {
            const list = [...(prev.text_fields || [])];
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= list.length) return prev;
            const temp = list[idx];
            list[idx] = list[targetIdx];
            list[targetIdx] = temp;
            return { ...prev, text_fields: list };
        });
    };

    if (isPhotoForm) {
        return (
            <>
                <Head title={`Photo Form: ${form.code}`} />

                <div className="flex h-full flex-1 flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center pb-4 border-b">
                        <div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-sm font-bold">
                                    {form.code}
                                </Badge>
                                <Badge variant="secondary">Photo Form</Badge>
                                <span className="text-xs text-muted-foreground">v{form.template_version}</span>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight mt-1">{form.name}</h1>
                            <p className="text-sm text-muted-foreground">Add and manage photo fields for this form.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleSavePhotoSchema}
                                disabled={isSavingPhoto}
                                className="flex items-center gap-1.5"
                            >
                                <Save className="size-4" />
                                <span>{isSavingPhoto ? 'Saving...' : 'Save Changes'}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Form Details */}
                    <Card>
                        <CardHeader className="p-4 bg-muted/20 border-b">
                            <h3 className="font-semibold text-base">Form Details</h3>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="photo_form_title">Form Name / Title</Label>
                                <Input
                                    id="photo_form_title"
                                    value={photoFormState.title || form.name}
                                    onChange={(e) => setPhotoFormState((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g. Photographic Record Form"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="photo_form_desc">Instructions / Notes (Optional)</Label>
                                <textarea
                                    id="photo_form_desc"
                                    value={photoFormState.description || ''}
                                    onChange={(e) => setPhotoFormState((prev) => ({ ...prev, description: e.target.value }))}
                                    rows={2}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    placeholder="Instructions for uploading photos..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Photos List */}
                    <Card>
                        <CardHeader className="p-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Camera className="size-5 text-primary" />
                                <h3 className="font-semibold text-base">Photo Fields</h3>
                                <Badge variant="outline">{(photoFormState.items || []).length} Photos</Badge>
                            </div>
                            <Button size="sm" onClick={handleAddPhotoItem} className="flex items-center gap-1.5">
                                <Plus className="size-4" />
                                <span>Add Photo</span>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {(!photoFormState.items || photoFormState.items.length === 0) ? (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                    <Camera className="size-10 mx-auto text-muted-foreground/50 mb-2" />
                                    <p className="text-sm font-medium">No photo fields yet</p>
                                    <p className="text-xs text-muted-foreground mt-1">Add photo items to define what photos should be taken.</p>
                                    <Button size="sm" onClick={handleAddPhotoItem} className="mt-4">
                                        <Plus className="size-4 mr-1.5" /> Add Photo
                                    </Button>
                                </div>
                            ) : (
                                photoFormState.items.map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        className="flex items-start gap-3 p-3.5 rounded-lg border bg-card shadow-2xs transition-all hover:border-border"
                                    >
                                        <div className="flex items-center justify-center size-8 rounded-md bg-muted text-xs font-bold shrink-0 mt-1">
                                            #{idx + 1}
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Title</Label>
                                                <Input
                                                    value={item.title}
                                                    onChange={(e) => handleUpdatePhotoItem(idx, 'title', e.target.value)}
                                                    placeholder="Photo title (e.g. General View / Overview)"
                                                    className="font-medium"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Guide / Instructions (Optional)</Label>
                                                <Input
                                                    value={item.description || ''}
                                                    onChange={(e) => handleUpdatePhotoItem(idx, 'description', e.target.value)}
                                                    placeholder="Optional guidance for taking this photo"
                                                    className="text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 shrink-0 pt-5">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    disabled={idx === 0}
                                                    onClick={() => handleMovePhotoItem(idx, 'up')}
                                                    title="Move Up"
                                                >
                                                    <ArrowUp className="size-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    disabled={idx === (photoFormState.items?.length || 1) - 1}
                                                    onClick={() => handleMovePhotoItem(idx, 'down')}
                                                    title="Move Down"
                                                >
                                                    <ArrowDown className="size-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleRemovePhotoItem(idx)}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}

                            {(photoFormState.items || []).length > 0 && (
                                <div className="pt-3 flex items-center justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddPhotoItem}
                                        className="flex items-center gap-1.5"
                                    >
                                        <Plus className="size-4" />
                                        <span>Add Photo</span>
                                    </Button>

                                    <Button
                                        type="button"
                                        onClick={handleSavePhotoSchema}
                                        disabled={isSavingPhoto}
                                    >
                                        {isSavingPhoto ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

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
                            <Badge variant="default">{form.code} v{form.template_version}</Badge>
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
                                            router.put(`/admin/forms/${form.id}/summary-schema`, { summary_schema: updated as any }, { preserveScroll: true });
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
                                        router.put(`/admin/forms/${form.id}/photo-schema`, { photo_schema: updated as any }, { preserveScroll: true });
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
                    <aside className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-6 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between px-2 pb-2 border-b border-border/60">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Table of Chapters
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono">
                                {chapters.length + (!isPhotoForm && summaryFormState.enabled ? 1 : 0) + (photoFormState.enabled || isPhotoForm ? 1 : 0)} {isPhotoForm ? 'Sections' : 'Chapters'}
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
                                        onClick={() => handleSelectTab(chapter.id)}
                                        className={`w-full text-left rounded-lg p-2.5 transition-all flex flex-col gap-1 ${
                                            isCurrent
                                                ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                                : 'border border-transparent hover:bg-card/70'
                                        } ${!chapter.is_enabled ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-1.5">
                                            <span className="font-semibold text-xs text-foreground truncate flex-1">
                                                {chapter.chapter_no ? `${chapter.chapter_no}. ` : ''}{chapter.title}
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
                                    onClick={() => handleSelectTab('summary')}
                                    className={`w-full text-left rounded-lg p-2.5 transition-all flex items-center justify-between gap-1.5 ${
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
                            {(photoFormState.enabled || isPhotoForm) && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectTab('photo')}
                                    className={`w-full text-left rounded-lg p-2.5 transition-all flex items-center justify-between gap-1.5 ${
                                        activeNavChapterId === 'photo'
                                            ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                            : 'border border-transparent hover:bg-card/70'
                                    }`}
                                >
                                    <span className="font-semibold text-xs text-foreground truncate flex-1">
                                        {photoFormState.title || (isPhotoForm ? 'Photo Form Settings' : 'Photographic Records')}
                                    </span>
                                </button>
                            )}
                        </div>
                    </aside>

                    {/* Right Main Column: Active Chapter / Tab View */}
                    <div className="flex-1 min-w-0 space-y-6">
                        {typeof activeNavChapterId === 'number' && (() => {
                            const chapter = chapters.find((c) => c.id === activeNavChapterId) || chapters[0];
                            if (!chapter) {
                                return (
                                    <Card className="p-8 text-center border-dashed">
                                        <p className="text-sm text-muted-foreground">No chapters available in this template.</p>
                                        <Button onClick={openAddChapter} className="mt-4">
                                            <Plus className="size-4 mr-1.5" /> Add Chapter / Section
                                        </Button>
                                    </Card>
                                );
                            }

                            const chapterQuestionIds = getAllGroupQuestionIds(chapter);
                            const isChapterAllSelected =
                                chapterQuestionIds.length > 0 &&
                                chapterQuestionIds.every((id) => selectedQuestionIds.includes(id));
                            const isChapterCollapsed = Boolean(collapsedChapters[chapter.id]);

                            return (
                                <Card
                                    key={chapter.id}
                                    id={`chapter-${chapter.id}`}
                                    className={`gap-0 overflow-hidden py-0 shadow-xs ${!chapter.is_enabled ? 'opacity-60 bg-muted/20' : ''}`}
                                >
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

                                <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                                    {prevTab ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSelectTab(prevTab.id)}
                                            className="flex items-center gap-1.5 text-xs font-medium"
                                        >
                                            <ChevronLeft className="size-4" />
                                            <span className="truncate max-w-[200px]">{prevTab.title}</span>
                                        </Button>
                                    ) : <div />}
                                    {nextTab ? (
                                        <Button
                                            type="button"
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleSelectTab(nextTab.id)}
                                            className="flex items-center gap-1.5 text-xs font-medium"
                                        >
                                            <span className="truncate max-w-[200px]">{nextTab.title}</span>
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    ) : <div />}
                                </CardFooter>
                            </Card>
                        );
                    })()}

                    {/* Summary Chapter Card (Standard Forms Only) */}
                    {!isPhotoForm && activeNavChapterId === 'summary' && (
                        <Card
                            id="summary-chapter"
                            className={`gap-0 overflow-hidden py-0 shadow-xs ${!summaryFormState.enabled ? 'opacity-70 bg-muted/20' : 'border-primary/40'}`}
                        >
                        <CardHeader className="border-b bg-muted/40 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => setSummaryChapterCollapsed(!summaryChapterCollapsed)}
                                        className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                                        title={summaryChapterCollapsed ? 'Expand Summary Chapter' : 'Collapse Summary Chapter'}
                                    >
                                        {summaryChapterCollapsed ? (
                                            <ChevronRight className="size-4" />
                                        ) : (
                                            <ChevronDown className="size-4" />
                                        )}
                                    </button>
                                    <h3
                                        className="font-semibold text-lg cursor-pointer select-none flex items-center gap-2"
                                        onClick={() => setSummaryChapterCollapsed(!summaryChapterCollapsed)}
                                    >
                                        <FileText className="size-4.5 text-primary shrink-0" />
                                        <span>{summaryFormState.title || 'Summary & Observations'}</span>
                                    </h3>
                                    <Badge variant="secondary" className="text-xs font-semibold">
                                        Summary Chapter
                                    </Badge>
                                    {summaryFormState.enabled ? (
                                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                                            Enabled
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">
                                            Disabled
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        title={summaryFormState.enabled ? 'Disable Summary Chapter' : 'Enable Summary Chapter'}
                                        onClick={() =>
                                            setSummaryFormState((prev) => ({ ...prev, enabled: !prev.enabled }))
                                        }
                                    >
                                        {summaryFormState.enabled ? <Eye className="size-4 text-emerald-600" /> : <EyeOff className="size-4 text-muted-foreground" />}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleSaveSummarySchema()}
                                        disabled={isSavingSummary}
                                        className="text-xs h-8"
                                    >
                                        {isSavingSummary ? 'Saving...' : 'Save Summary Chapter'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:bg-destructive/10 text-xs h-8"
                                        onClick={handleRemoveSummaryChapter}
                                        disabled={isSavingSummary}
                                        title="Remove Summary Chapter"
                                    >
                                        <Trash2 className="size-4 mr-1" />
                                        <span>Remove Chapter</span>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        {!summaryChapterCollapsed && (
                            <CardContent className="p-4 space-y-6">
                                {/* General Configuration */}
                                <div className="rounded-lg border p-4 space-y-4 bg-background">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="summary_enabled"
                                            checked={summaryFormState.enabled}
                                            onCheckedChange={(checked) =>
                                                setSummaryFormState((prev) => ({ ...prev, enabled: Boolean(checked) }))
                                            }
                                        />
                                        <Label htmlFor="summary_enabled" className="text-sm font-semibold cursor-pointer">
                                            Enable Dedicated Summary Chapter for this Form
                                        </Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        When enabled, this chapter is automatically appended to reports for executive summaries, chapter ratings, and findings registers.
                                    </p>

                                    {summaryFormState.enabled && (
                                        <div className="space-y-2 pt-2 border-t">
                                            <Label htmlFor="summary_title">Summary Chapter Title</Label>
                                            <Input
                                                id="summary_title"
                                                value={summaryFormState.title}
                                                onChange={(e) =>
                                                    setSummaryFormState((prev) => ({ ...prev, title: e.target.value }))
                                                }
                                                placeholder="e.g. Summary & Observations"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {summaryFormState.enabled && (
                                    <>
                                        {/* Ratings Matrix Section */}
                                        <div className="rounded-lg border p-4 space-y-3 bg-background">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="summary_has_ratings"
                                                    checked={Boolean(summaryFormState.has_ratings_matrix)}
                                                    onCheckedChange={(checked) =>
                                                        setSummaryFormState((prev) => ({
                                                            ...prev,
                                                            has_ratings_matrix: Boolean(checked),
                                                        }))
                                                    }
                                                />
                                                <Label htmlFor="summary_has_ratings" className="font-semibold text-sm cursor-pointer">
                                                    Include Chapter Ratings Matrix
                                                </Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Inspectors will evaluate each chapter (e.g. Very Good, Satisfactory, Unsatisfactory) in a summary matrix.
                                            </p>

                                            {summaryFormState.has_ratings_matrix && (
                                                <div className="space-y-3 pt-3 border-t">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs font-semibold uppercase text-muted-foreground">
                                                            Rating Options
                                                        </Label>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            onClick={handleAddRatingOption}
                                                        >
                                                            <Plus className="size-3 mr-1" /> Add Option
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {(summaryFormState.rating_options || []).map((opt, idx) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <Input
                                                                    value={opt.value}
                                                                    onChange={(e) =>
                                                                        handleUpdateRatingOption(idx, 'value', e.target.value)
                                                                    }
                                                                    placeholder="value (e.g. very_good)"
                                                                    className="w-1/3 font-mono text-xs"
                                                                />
                                                                <Input
                                                                    value={opt.label}
                                                                    onChange={(e) =>
                                                                        handleUpdateRatingOption(idx, 'label', e.target.value)
                                                                    }
                                                                    placeholder="Label (e.g. Very Good)"
                                                                    className="flex-1 text-xs"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleRemoveRatingOption(idx)}
                                                                    disabled={(summaryFormState.rating_options || []).length <= 1}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Executive / Custom Text Fields Section */}
                                        <div className="rounded-lg border p-4 space-y-3 bg-background">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label className="font-semibold text-sm">
                                                        Custom Executive & Observation Text Fields
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Configure multi-line observation areas (e.g. "Comments for NO items", "Positive Comments", etc.)
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs shrink-0"
                                                    onClick={handleAddTextField}
                                                >
                                                    <Plus className="size-3.5 mr-1" /> Add Field
                                                </Button>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                {(summaryFormState.text_fields || []).length === 0 && (
                                                    <p className="text-xs text-muted-foreground italic py-2 text-center">
                                                        No custom text fields configured yet. Click "Add Field" to add one.
                                                    </p>
                                                )}
                                                {(summaryFormState.text_fields || []).map((tf, idx) => (
                                                    <div key={idx} className="rounded border bg-muted/20 p-3 space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                                                                <Input
                                                                    value={tf.label}
                                                                    onChange={(e) =>
                                                                        handleUpdateTextField(idx, 'label', e.target.value)
                                                                    }
                                                                    placeholder="Field Label / Title"
                                                                    className="text-xs font-medium"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0"
                                                                    disabled={idx === 0}
                                                                    onClick={() => handleMoveTextField(idx, 'up')}
                                                                    title="Move Up"
                                                                >
                                                                    <ArrowUp className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0"
                                                                    disabled={idx === (summaryFormState.text_fields || []).length - 1}
                                                                    onClick={() => handleMoveTextField(idx, 'down')}
                                                                    title="Move Down"
                                                                >
                                                                    <ArrowDown className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleRemoveTextField(idx)}
                                                                    title="Delete Field"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                                                            <div>
                                                                <Label className="text-[11px] text-muted-foreground">Field Key (Identifier)</Label>
                                                                <Input
                                                                    value={tf.key}
                                                                    onChange={(e) =>
                                                                        handleUpdateTextField(idx, 'key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                                                                    }
                                                                    placeholder="e.g. comments_no"
                                                                    className="text-xs font-mono h-8"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-[11px] text-muted-foreground">Width Layout</Label>
                                                                <Select
                                                                    value={tf.span || 'full'}
                                                                    onValueChange={(val: 'full' | 'half') =>
                                                                        handleUpdateTextField(idx, 'span', val)
                                                                    }
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="full">Full Width (1 Column)</SelectItem>
                                                                        <SelectItem value="half">Half Width (2 Columns)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div>
                                                                <Label className="text-[11px] text-muted-foreground">Default Height (Rows)</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={2}
                                                                    max={12}
                                                                    value={tf.rows || 3}
                                                                    onChange={(e) =>
                                                                        handleUpdateTextField(idx, 'rows', parseInt(e.target.value) || 3)
                                                                    }
                                                                    className="text-xs h-8"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <Label className="text-[11px] text-muted-foreground">Placeholder Guide Text (Optional)</Label>
                                                            <Input
                                                                value={tf.placeholder || ''}
                                                                onChange={(e) =>
                                                                    handleUpdateTextField(idx, 'placeholder', e.target.value)
                                                                }
                                                                placeholder="e.g. Chapter / Item / Observation comments..."
                                                                className="text-xs h-8"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Findings Register Section */}
                                        <div className="rounded-lg border p-4 space-y-2 bg-background">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="summary_has_findings"
                                                    checked={Boolean(summaryFormState.has_findings_register)}
                                                    onCheckedChange={(checked) =>
                                                        setSummaryFormState((prev) => ({
                                                            ...prev,
                                                            has_findings_register: Boolean(checked),
                                                        }))
                                                    }
                                                />
                                                <Label htmlFor="summary_has_findings" className="font-semibold text-sm cursor-pointer">
                                                    Include Summary Findings Register
                                                </Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Automatically compiles negative answers/findings into an executive findings register table with corrective action tracking.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => handleSaveSummarySchema()}
                                        disabled={isSavingSummary}
                                    >
                                        {isSavingSummary ? 'Saving Summary Chapter...' : 'Save Summary Chapter Settings'}
                                    </Button>
                                </div>
                            </CardContent>
                        )}

                        <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                            {prevTab ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectTab(prevTab.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium"
                                >
                                    <ChevronLeft className="size-4" />
                                    <span className="truncate max-w-[200px]">{prevTab.title}</span>
                                </Button>
                            ) : <div />}
                            {nextTab ? (
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSelectTab(nextTab.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium"
                                >
                                    <span className="truncate max-w-[200px]">{nextTab.title}</span>
                                    <ChevronRight className="size-4" />
                                </Button>
                            ) : <div />}
                        </CardFooter>
                    </Card>
                    )}

                    {/* Photo Chapter / Form Card */}
                    {activeNavChapterId === 'photo' && (
                        <Card
                            id="photo-chapter"
                            className={`gap-0 overflow-hidden py-0 shadow-xs ${!photoFormState.enabled && !isPhotoForm ? 'opacity-70 bg-muted/20' : 'border-primary/40'}`}
                        >
                        <CardHeader className="bg-muted/40 p-4 border-b">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => setPhotoChapterCollapsed(!photoChapterCollapsed)}
                                        className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                                        title={photoChapterCollapsed ? 'Expand Photo Settings' : 'Collapse Photo Settings'}
                                    >
                                        {photoChapterCollapsed ? (
                                            <ChevronRight className="size-4" />
                                        ) : (
                                            <ChevronDown className="size-4" />
                                        )}
                                    </button>
                                    <Camera className="size-5 text-primary shrink-0" />
                                    <h3 className="font-semibold text-base text-foreground truncate flex items-center gap-2">
                                        <span>{photoFormState.title || 'Photographic Records'}</span>
                                    </h3>
                                    <Badge variant="secondary" className="text-xs font-semibold">
                                        Photo Form
                                    </Badge>
                                    {photoFormState.enabled ? (
                                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">
                                            Off
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        title={photoFormState.enabled ? 'Disable Photo Section' : 'Enable Photo Section'}
                                        onClick={() =>
                                            setPhotoFormState((prev) => ({ ...prev, enabled: !prev.enabled }))
                                        }
                                    >
                                        {photoFormState.enabled ? <Eye className="size-4 text-emerald-600" /> : <EyeOff className="size-4 text-muted-foreground" />}
                                        <span className="ml-1 text-xs">{photoFormState.enabled ? 'Active' : 'Off'}</span>
                                    </Button>

                                    <Button
                                        size="sm"
                                        onClick={() => handleSavePhotoSchema()}
                                        disabled={isSavingPhoto}
                                        className="text-xs h-8"
                                    >
                                        {isSavingPhoto ? 'Saving...' : 'Save Photo Settings'}
                                    </Button>

                                    {!isPhotoForm && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:bg-destructive/10 text-xs h-8"
                                            onClick={handleRemovePhotoChapter}
                                            disabled={isSavingPhoto}
                                            title="Remove Photo Chapter"
                                        >
                                            <Trash2 className="size-4 mr-1" />
                                            <span>Remove Chapter</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {!photoChapterCollapsed && (
                            <CardContent className="p-5 space-y-6">
                                <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="photo_enabled"
                                            checked={photoFormState.enabled}
                                            onCheckedChange={(checked) =>
                                                setPhotoFormState((prev) => ({ ...prev, enabled: Boolean(checked) }))
                                            }
                                        />
                                        <Label htmlFor="photo_enabled" className="text-sm font-semibold cursor-pointer">
                                            Include Photo Form / Records in this Report
                                        </Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground pl-6">
                                        When enabled, this report will include photo inputs and print photo records in the report.
                                    </p>
                                </div>

                                {photoFormState.enabled && (
                                    <>
                                        <div className="space-y-4 pt-2 border-t">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="photo_title">Section Title</Label>
                                                    <Input
                                                        id="photo_title"
                                                        value={photoFormState.title || ''}
                                                        onChange={(e) =>
                                                            setPhotoFormState((prev) => ({ ...prev, title: e.target.value }))
                                                        }
                                                        placeholder="e.g. Chapter 16 - Photographic Records"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="photo_attach_form">Attach Photo Form Template</Label>
                                                    <Select
                                                        value={photoFormState.attached_form_id ? String(photoFormState.attached_form_id) : 'custom'}
                                                        onValueChange={(val) =>
                                                            setPhotoFormState((prev) => ({
                                                                ...prev,
                                                                attached_form_id: val === 'custom' ? null : Number(val),
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger id="photo_attach_form">
                                                            <SelectValue placeholder="Select a photo form..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="custom">Custom Photo List (Custom to this form)</SelectItem>
                                                            {(available_photo_forms || []).map((pf) => (
                                                                <SelectItem key={pf.id} value={String(pf.id)}>
                                                                    {pf.code} - {pf.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="photo_description">Instructions / Notes (Optional)</Label>
                                                <textarea
                                                    id="photo_description"
                                                    value={photoFormState.description || ''}
                                                    onChange={(e) =>
                                                        setPhotoFormState((prev) => ({ ...prev, description: e.target.value }))
                                                    }
                                                    rows={2}
                                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    placeholder="Instructions for uploading photos..."
                                                />
                                            </div>
                                        </div>

                                        {photoFormState.attached_form_id ? (
                                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">
                                                        Attached Photo Form: {available_photo_forms?.find((pf) => pf.id === photoFormState.attached_form_id)?.name || 'Photo Form'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Photo fields and titles are inherited from this template.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 pt-3 border-t">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-semibold">Photo Fields</Label>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs"
                                                        onClick={handleAddPhotoItem}
                                                    >
                                                        <Plus className="size-3.5 mr-1" /> Add Photo
                                                    </Button>
                                                </div>

                                                <div className="space-y-2">
                                                    {(!photoFormState.items || photoFormState.items.length === 0) ? (
                                                        <p className="text-xs text-muted-foreground italic py-2 text-center">
                                                            No photo fields added yet. Click "Add Photo" to add one.
                                                        </p>
                                                    ) : (
                                                        photoFormState.items.map((item, idx) => (
                                                            <div key={item.id || idx} className="flex items-center gap-2 p-2.5 rounded-md border bg-card">
                                                                <span className="text-xs font-mono text-muted-foreground shrink-0 w-6">#{idx + 1}</span>
                                                                <Input
                                                                    value={item.title}
                                                                    onChange={(e) => handleUpdatePhotoItem(idx, 'title', e.target.value)}
                                                                    placeholder="Photo Title / Label"
                                                                    className="flex-1 text-xs h-8"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0"
                                                                    disabled={idx === 0}
                                                                    onClick={() => handleMovePhotoItem(idx, 'up')}
                                                                    title="Move Up"
                                                                >
                                                                    <ArrowUp className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0"
                                                                    disabled={idx === (photoFormState.items?.length || 1) - 1}
                                                                    onClick={() => handleMovePhotoItem(idx, 'down')}
                                                                    title="Move Down"
                                                                >
                                                                    <ArrowDown className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleRemovePhotoItem(idx)}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => handleSavePhotoSchema()}
                                        disabled={isSavingPhoto}
                                    >
                                        {isSavingPhoto ? 'Saving Photo Settings...' : 'Save Photo Settings'}
                                    </Button>
                                </div>
                            </CardContent>
                        )}

                        <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                            {prevTab ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectTab(prevTab.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium"
                                >
                                    <ChevronLeft className="size-4" />
                                    <span className="truncate max-w-[200px]">{prevTab.title}</span>
                                </Button>
                            ) : <div />}
                            {nextTab ? (
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSelectTab(nextTab.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium"
                                >
                                    <span className="truncate max-w-[200px]">{nextTab.title}</span>
                                    <ChevronRight className="size-4" />
                                </Button>
                            ) : <div />}
                        </CardFooter>
                    </Card>
                    )}
                </div>
            </div>
        </div>

            {/* Isolated Group Modal Dialog */}
            <GroupModalDialog
                open={groupModalOpen}
                onOpenChange={setGroupModalOpen}
                editingGroup={editingGroup}
                parentId={groupParentId}
                formId={form.id}
                suggestedChapterNo={String(chapters.length + 1)}
            />

            {/* Isolated Question Modal Dialog */}
            <QuestionModalDialog
                open={questionModalOpen}
                onOpenChange={setQuestionModalOpen}
                editingQuestion={editingQuestion}
                groupId={questionGroupId}
            />

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

interface GroupModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingGroup: GroupData | null;
    parentId: number | null;
    formId: number;
    suggestedChapterNo?: string;
}

function GroupModalDialog({
    open,
    onOpenChange,
    editingGroup,
    parentId,
    formId,
    suggestedChapterNo,
}: GroupModalDialogProps) {
    const [title, setTitle] = useState('');
    const [chapterNo, setChapterNo] = useState('');
    const [iceClass, setIceClass] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    React.useEffect(() => {
        if (open) {
            if (editingGroup) {
                setTitle(editingGroup.title);
                setChapterNo(editingGroup.chapter_no || '');
                setIceClass(editingGroup.ice_class_only);
            } else {
                setTitle('');
                setChapterNo(parentId ? '' : (suggestedChapterNo || ''));
                setIceClass(false);
            }
        }
    }, [open, editingGroup, parentId, suggestedChapterNo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        if (editingGroup) {
            router.put(`/admin/groups/${editingGroup.id}`, {
                title,
                chapter_no: chapterNo || null,
                ice_class_only: iceClass,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onOpenChange(false);
                },
                onError: () => setSubmitting(false),
            });
        } else {
            router.post(`/admin/forms/${formId}/groups`, {
                title,
                chapter_no: chapterNo || null,
                parent_id: parentId,
                ice_class_only: iceClass,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onOpenChange(false);
                },
                onError: () => setSubmitting(false),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingGroup ? 'Edit Chapter / Subgroup' : parentId ? 'Add Subgroup' : 'Add Chapter'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!parentId && (
                        <div className="space-y-1">
                            <Label htmlFor="dlg_chapter_no">Chapter Number (Optional)</Label>
                            <Input
                                id="dlg_chapter_no"
                                value={chapterNo}
                                onChange={(e) => setChapterNo(e.target.value)}
                                placeholder="e.g. 1, 2, 16 (Optional)"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Leave blank to automatically number chapters in sequence.
                            </p>
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="dlg_group_title">{parentId ? 'Subgroup Title' : 'Chapter Title'}</Label>
                        <Input
                            id="dlg_group_title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={parentId ? 'e.g. Navigational Equipment' : 'e.g. Navigation & Bridge'}
                            required
                            autoFocus
                        />
                    </div>
                    {!parentId && (
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="dlg_ice_class"
                                checked={iceClass}
                                onChange={(e) => setIceClass(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="dlg_ice_class" className="cursor-pointer text-xs">
                                Ice Class Only (Only applies to vessels with ice class notation)
                            </Label>
                        </div>
                    )}
                    <DialogFooter className="pt-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface QuestionModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingQuestion: QuestionData | null;
    groupId: number | null;
}

function QuestionModalDialog({
    open,
    onOpenChange,
    editingQuestion,
    groupId,
}: QuestionModalDialogProps) {
    const [questionText, setQuestionText] = useState('');
    const [questionGuidance, setQuestionGuidance] = useState('');
    const [hasChoices, setHasChoices] = useState(true);
    const [hasText, setHasText] = useState(false);
    const [hasDate, setHasDate] = useState(false);
    const [hasFile, setHasFile] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    React.useEffect(() => {
        if (open) {
            if (editingQuestion) {
                setQuestionText(editingQuestion.question_text);
                setQuestionGuidance(editingQuestion.guidance || '');
                const flags = parseQuestionInputType(editingQuestion.input_type);
                setHasChoices(flags.hasChoices);
                setHasText(flags.hasText);
                setHasDate(flags.hasDate);
                setHasFile(flags.hasFile);
            } else {
                setQuestionText('');
                setQuestionGuidance('');
                setHasChoices(true);
                setHasText(false);
                setHasDate(false);
                setHasFile(false);
            }
        }
    }, [open, editingQuestion]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const inputType = buildQuestionInputType({
            hasChoices,
            hasText,
            hasDate,
            hasFile,
        });

        if (editingQuestion) {
            router.put(`/admin/questions/${editingQuestion.id}`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: inputType,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onOpenChange(false);
                },
                onError: () => setSubmitting(false),
            });
        } else if (groupId) {
            router.post(`/admin/groups/${groupId}/questions`, {
                question_text: questionText,
                guidance: questionGuidance || null,
                input_type: inputType,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onOpenChange(false);
                },
                onError: () => setSubmitting(false),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="dlg_q_text">Question Text</Label>
                        <textarea
                            id="dlg_q_text"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={3}
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Enter the question text..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="dlg_q_guidance">Guidance Text / Bracketed Help (Optional)</Label>
                        <textarea
                            id="dlg_q_guidance"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={2}
                            value={questionGuidance}
                            onChange={(e) => setQuestionGuidance(e.target.value)}
                            placeholder="Expandable help text for the inspector"
                        />
                    </div>

                    {/* Response & Input Capabilities */}
                    <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
                        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                            Response & Input Capabilities
                        </Label>

                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5 pb-2.5 border-b">
                                <input
                                    type="checkbox"
                                    id="dlg_chk_choices"
                                    checked={hasChoices}
                                    onChange={(e) => setHasChoices(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <Label htmlFor="dlg_chk_choices" className="cursor-pointer text-sm font-semibold">
                                    Standard Choices (Yes / No / NS / NA buttons)
                                </Label>
                            </div>

                            <Label className="text-xs text-muted-foreground font-medium block pt-0.5">
                                Input Fields (Check all that apply)
                            </Label>

                            <div className="space-y-2 pl-0.5">
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_text"
                                        checked={hasText}
                                        onChange={(e) => setHasText(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label htmlFor="dlg_chk_text" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>Text / Remarks Input (notes, explanation)</span>
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_date"
                                        checked={hasDate}
                                        onChange={(e) => setHasDate(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label htmlFor="dlg_chk_date" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>Date Input (calendar date picker)</span>
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_file"
                                        checked={hasFile}
                                        onChange={(e) => setHasFile(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label htmlFor="dlg_chk_file" className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5">
                                        <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>File / Attachment Input (document scan, certificate, photo)</span>
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Question'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
