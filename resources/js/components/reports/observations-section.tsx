import {
    AlertTriangle,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Edit2,
    FileCheck,
    FileText,
    HelpCircle,
    Info,
    Loader2,
    Plus,
    RotateCcw,
    ShieldAlert,
    Trash2,
    Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { csrfHeaders } from '@/lib/autosave-queue';
import type {
    ChapterData,
    FindingData,
    ReportData,
    SummarySchema,
    SummarySchemaTextField,
} from '@/types';

export const D062_RATING_CATEGORIES: { key: string; label: string; chapter: string }[] = [
    { key: 'navigation', label: 'Navigation & Bridge Procedures', chapter: 'Chapter 2' },
    { key: 'safety_management', label: 'Safety Management & ISM', chapter: 'Chapter 3' },
    { key: 'crew_management', label: 'Crew Management & STCW', chapter: 'Chapter 4' },
    { key: 'machinery_spaces', label: 'Machinery Spaces & Engineering', chapter: 'Chapter 5' },
    { key: 'cargo_ballast', label: 'Cargo, Ballast & Operations', chapter: 'Chapter 6' },
    { key: 'pollution_prevention', label: 'Pollution Prevention (MARPOL)', chapter: 'Chapter 7' },
    { key: 'structural_condition', label: 'Hull, Decks & Structural Condition', chapter: 'Chapter 8' },
    { key: 'mooring_towing', label: 'Mooring, Anchoring & Towing', chapter: 'Chapter 9' },
    { key: 'security', label: 'Ship Security (ISPS)', chapter: 'Chapter 10' },
    { key: 'health_hygiene', label: 'Health, Hygiene & MLC', chapter: 'Chapter 11' },
    { key: 'radio_gmdss', label: 'Radio, GMDSS & Communication', chapter: 'Chapter 12' },
];

export interface ObservationsSectionProps {
    report: ReportData;
    isEditable: boolean;
    findings: FindingData[];
    chapterStats: Record<
        number,
        { total: number; applicable: number; answered: number; noCount: number; nsCount: number }
    >;
    onAddFinding: (data: Partial<FindingData>) => Promise<void>;
    onUpdateFinding: (id: number, data: Partial<FindingData>) => Promise<void>;
    onDeleteFinding: (id: number) => Promise<void>;
    prevChapter?: { id: number; title: string; chapter_no?: string | null } | null;
    nextChapter?: { id: number; title: string; chapter_no?: string | null } | null;
    onChapterSwitch: (chapterId: number) => void;
}

export function ObservationsSection({
    report,
    isEditable,
    findings,
    chapterStats,
    onAddFinding,
    onUpdateFinding,
    onDeleteFinding,
    prevChapter,
    nextChapter,
    onChapterSwitch,
}: ObservationsSectionProps) {
    const isB008 = report.form.code === 'B-008';
    const isD062 = report.form.code === 'D-062';

    const schema: SummarySchema = report.form.summary_schema || {
        enabled: true,
        title: isB008 ? 'Audit Summary & NCRs' : 'Summary & Observations',
        has_ratings_matrix: isD062,
        rating_options: [
            { value: 'very_good', label: 'Very Good', color: 'emerald' },
            { value: 'satisfactory', label: 'Satisfactory', color: 'blue' },
            { value: 'unsatisfactory', label: 'Unsatisfactory', color: 'rose' },
        ],
        has_findings_register: true,
    };

    const hasRatingsMatrix = schema.has_ratings_matrix ?? isD062;
    const hasFindingsRegister = schema.has_findings_register !== false;
    const ratingOptions = schema.rating_options || [
        { value: 'very_good', label: 'Very Good', color: 'emerald' },
        { value: 'satisfactory', label: 'Satisfactory', color: 'blue' },
        { value: 'unsatisfactory', label: 'Unsatisfactory', color: 'rose' },
    ];

    const [ratings, setRatings] = useState<Record<string, string>>(() => {
        return (report.summary_ratings as Record<string, string>) || {};
    });
    const [ratingsSaving, setRatingsSaving] = useState(false);
    const [ratingsSaved, setRatingsSaved] = useState(false);

    const handleRatingSelect = async (categoryKey: string, val: string) => {
        if (!isEditable) return;
        const next = { ...ratings, [categoryKey]: val };
        setRatings(next);
        setRatingsSaving(true);
        setRatingsSaved(false);

        try {
            const res = await fetch(`/reports/${report.id}/summary-ratings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ ratings: next }),
            });
            if (res.ok) {
                setRatingsSaved(true);
                setTimeout(() => setRatingsSaved(false), 2000);
            }
        } catch {
            // Ignore transient VSAT save errors
        } finally {
            setRatingsSaving(false);
        }
    };

    const defaultTextFields: SummarySchemaTextField[] = isB008
        ? [
              {
                  key: 'summary_safety_meetings',
                  label: 'Safety Meetings & Drill Performance',
                  placeholder: 'Review of safety committee meetings, drills carried out...',
                  rows: 3,
                  span: 'half' as const,
              },
              {
                  key: 'summary_participants',
                  label: 'Key Personnel Met & Audit Participants',
                  placeholder: 'List of master, chief engineer, officers and crew involved...',
                  rows: 3,
                  span: 'half' as const,
              },
              {
                  key: 'summary_concept_understanding',
                  label: 'Understanding of Safety Management System Concepts',
                  placeholder: 'Evaluation of crew familiarity with safety procedures and company policies...',
                  rows: 3,
                  span: 'full' as const,
              },
              {
                  key: 'summary_training_needs',
                  label: 'Identified Training Needs & Corrective Guidance',
                  placeholder: 'Recommended shipboard and shore-based training requirements...',
                  rows: 3,
                  span: 'full' as const,
              },
          ]
        : [
              {
                  key: 'summary_comments_no',
                  label: 'Summary of Negative Responses ("No" and "NS" Answers)',
                  placeholder: 'Summarize overarching themes from negative answers or operational deficiencies...',
                  rows: 4,
                  span: 'full' as const,
                  description:
                      'Provide an overarching summary explaining non-conformities, negative responses, and unobserved items.',
              },
          ];

    const textFields = schema.text_fields && schema.text_fields.length > 0 ? schema.text_fields : defaultTextFields;

    const [summaryTexts, setSummaryTexts] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        textFields.forEach((tf) => {
            const valFromData = (report.summary_data as Record<string, string> | null)?.[tf.key];
            const valFromColumn = (report as unknown as Record<string, unknown>)[tf.key];
            initial[tf.key] =
                typeof valFromData === 'string'
                    ? valFromData
                    : typeof valFromColumn === 'string'
                    ? (valFromColumn as string)
                    : '';
        });
        return initial;
    });

    const [textSaving, setTextSaving] = useState<Record<string, boolean>>({});
    const [textSaved, setTextSaved] = useState<Record<string, boolean>>({});
    const textDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const lastSavedTexts = useRef<Record<string, string>>({});

    const saveSummaryField = async (key: string, val: string) => {
        if (!isEditable) return;
        setTextSaving((prev) => ({ ...prev, [key]: true }));

        try {
            const res = await fetch(`/reports/${report.id}/summary-text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ key, value: val }),
            });
            if (res.ok) {
                setTextSaved((prev) => ({ ...prev, [key]: true }));
                setTimeout(() => {
                    setTextSaved((prev) => ({ ...prev, [key]: false }));
                }, 2000);
            }
        } catch {
            // Ignore transient VSAT save errors
        } finally {
            setTextSaving((prev) => ({ ...prev, [key]: false }));
        }
    };

    const handleTextChange = (key: string, val: string) => {
        setSummaryTexts((prev) => ({ ...prev, [key]: val }));
        if (textDebounceTimers.current[key]) {
            clearTimeout(textDebounceTimers.current[key]);
        }
        textDebounceTimers.current[key] = setTimeout(() => {
            if (val !== (lastSavedTexts.current[key] ?? '')) {
                lastSavedTexts.current[key] = val;
                saveSummaryField(key, val);
            }
        }, 1500);
    };

    const flushField = useCallback(
        (key: string) => {
            if (textDebounceTimers.current[key]) {
                clearTimeout(textDebounceTimers.current[key]);
            }
            const val = summaryTexts[key] ?? '';
            if (val !== (lastSavedTexts.current[key] ?? '')) {
                lastSavedTexts.current[key] = val;
                saveSummaryField(key, val);
            }
        },
        [summaryTexts]
    );

    // Findings Register Modal State (Task 4.2)
    const [findingModalOpen, setFindingModalOpen] = useState(false);
    const [editingFinding, setEditingFinding] = useState<FindingData | null>(null);
    const [findingFormData, setFindingFormData] = useState<Partial<FindingData>>({
        finding_kind: isB008 ? 'non_conformity' : 'observation',
        risk: 'medium',
        description: '',
        viq_paragraph: '',
        job_order_no: '',
        target_date: '',
        finding_status: 'open',
    });
    const [isSavingFinding, setIsSavingFinding] = useState(false);

    const handleOpenAddFinding = () => {
        setEditingFinding(null);
        setFindingFormData({
            finding_kind: isB008 ? 'non_conformity' : 'observation',
            risk: 'medium',
            description: '',
            viq_paragraph: '',
            job_order_no: '',
            target_date: '',
            finding_status: 'open',
        });
        setFindingModalOpen(true);
    };

    const handleOpenEditFinding = (finding: FindingData) => {
        setEditingFinding(finding);
        setFindingFormData({
            finding_kind: finding.finding_kind,
            risk: finding.risk || 'medium',
            description: finding.description,
            viq_paragraph: finding.viq_paragraph || '',
            job_order_no: finding.job_order_no || '',
            target_date: finding.target_date ? finding.target_date.split('T')[0] : '',
            finding_status: finding.finding_status || 'open',
        });
        setFindingModalOpen(true);
    };

    const handleSaveFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!findingFormData.description || !findingFormData.description.trim()) return;

        setIsSavingFinding(true);
        try {
            if (editingFinding) {
                await onUpdateFinding(editingFinding.id, findingFormData);
            } else {
                await onAddFinding(findingFormData);
            }
            setFindingModalOpen(false);
        } finally {
            setIsSavingFinding(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header Banner */}
            <div className="border-b pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-mono">
                        Summary
                    </Badge>
                    <Badge
                        variant="secondary"
                        className="text-xs font-semibold uppercase tracking-wider"
                    >
                        {isB008 ? 'Form B-008 Executive' : 'Inspection Evaluation'}
                    </Badge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {schema.title || 'Summary & Observations'}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    {isB008
                        ? 'Executive audit evaluation, meeting records, crew SMS understanding, and non-conformities.'
                        : 'Superintendent ratings matrix, overall negative response synthesis, and observation register.'}
                </p>
            </div>

            {/* Ratings Matrix (Form D-062, Task 4.1) */}
            {hasRatingsMatrix && (
                <Card className="border-2 border-border/80 shadow-xs bg-card">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="size-4 text-primary" />
                                <CardTitle className="text-sm font-semibold">
                                    Overall Departmental & Operational Ratings
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                {ratingsSaving && (
                                    <span className="text-amber-500 animate-pulse flex items-center gap-1 text-[11px]">
                                        <Loader2 className="size-3 animate-spin" /> Saving ratings...
                                    </span>
                                )}
                                {ratingsSaved && (
                                    <span className="text-emerald-600 flex items-center gap-1 text-[11px]">
                                        <Check className="size-3" /> Ratings saved
                                    </span>
                                )}
                            </div>
                        </div>
                        <CardDescription className="text-xs">
                            Select an overall evaluation grade for each core operational area of the vessel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 p-0">
                        <div className="divide-y">
                            {D062_RATING_CATEGORIES.map((cat) => {
                                const currentRating = ratings[cat.key];

                                return (
                                    <div
                                        key={cat.key}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-muted/10 transition-colors gap-2"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-mono text-muted-foreground"
                                                >
                                                    {cat.chapter}
                                                </Badge>
                                                <span className="text-xs font-semibold text-foreground">
                                                    {cat.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Grade Segmented Buttons */}
                                        <div className="inline-flex rounded-md border p-0.5 bg-muted/30 self-start sm:self-auto shrink-0">
                                            {ratingOptions.map((opt) => {
                                                const isSelected = currentRating === opt.value;
                                                const activeClass =
                                                    opt.value === 'very_good'
                                                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                                        : opt.value === 'satisfactory'
                                                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                                                        : 'bg-rose-600 text-white shadow-xs font-bold';

                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        disabled={!isEditable}
                                                        onClick={() => handleRatingSelect(cat.key, opt.value)}
                                                        className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                                                            isSelected
                                                                ? activeClass
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dynamic Summary Textareas (Task 4.1) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {textFields.map((tf) => {
                    const isFull = tf.span === 'full';
                    const isSaving = textSaving[tf.key];
                    const isSaved = textSaved[tf.key];

                    return (
                        <Card
                            key={tf.key}
                            className={`border-2 border-border/80 shadow-xs bg-card ${
                                isFull ? 'md:col-span-2' : ''
                            }`}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <FileText className="size-4 text-primary" />
                                        <span>{tf.label}</span>
                                    </CardTitle>
                                    <div className="text-xs">
                                        {isSaving && (
                                            <span className="text-amber-500 animate-pulse flex items-center gap-1 text-[11px]">
                                                <Loader2 className="size-3 animate-spin" /> Saving...
                                            </span>
                                        )}
                                        {isSaved && (
                                            <span className="text-emerald-600 flex items-center gap-1 text-[11px]">
                                                <Check className="size-3" /> Saved
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {tf.description && (
                                    <CardDescription className="text-xs">
                                        {tf.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    rows={tf.rows || 3}
                                    value={summaryTexts[tf.key] || ''}
                                    disabled={!isEditable}
                                    onChange={(e) => handleTextChange(tf.key, e.target.value)}
                                    onBlur={() => flushField(tf.key)}
                                    placeholder={tf.placeholder}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Findings & Observations Register (Task 4.2) */}
            {hasFindingsRegister && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b pb-3">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-foreground">
                                    {isB008
                                        ? 'Non-Conformities & Observations Register'
                                        : 'Observations Register'}
                                </h3>
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {findings.length} total
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Formally documented findings requiring shipboard or shore-side corrective
                                action.
                            </p>
                        </div>

                        {isEditable && (
                            <Button
                                size="sm"
                                onClick={handleOpenAddFinding}
                                className="flex items-center gap-1.5 h-8 text-xs font-semibold"
                            >
                                <Plus className="size-3.5" />
                                <span>{isB008 ? 'Add NCR / Observation' : 'Add Observation'}</span>
                            </Button>
                        )}
                    </div>

                    {findings.length === 0 ? (
                        <Card className="border border-dashed p-8 text-center text-muted-foreground bg-muted/10 space-y-2">
                            <FileCheck className="size-8 mx-auto text-muted-foreground/60" />
                            <p className="text-sm font-medium">No findings recorded for this report.</p>
                            <p className="text-xs max-w-sm mx-auto">
                                All items verified in order, or findings have not yet been registered. Click
                                "Add Observation" to record a formal deficiency.
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {findings.map((f, index) => {
                                return (
                                    <Card
                                        key={f.id}
                                        className="border-2 border-border/80 shadow-xs hover:border-primary/40 transition-colors bg-card"
                                    >
                                        <CardContent className="p-4 space-y-3">
                                            {/* Top Finding Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-xs font-mono text-muted-foreground">
                                                        #{index + 1}
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            f.finding_kind === 'non_conformity'
                                                                ? 'destructive'
                                                                : 'default'
                                                        }
                                                        className="text-[10px] uppercase font-bold"
                                                    >
                                                        {f.finding_kind === 'non_conformity'
                                                            ? 'Non-Conformity'
                                                            : 'Observation'}
                                                    </Badge>

                                                    {f.risk && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] font-semibold uppercase ${
                                                                f.risk === 'high'
                                                                    ? 'text-rose-600 border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30'
                                                                    : f.risk === 'medium'
                                                                    ? 'text-amber-600 border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30'
                                                                    : 'text-emerald-600 border-emerald-300 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30'
                                                            }`}
                                                        >
                                                            {f.risk} Risk
                                                        </Badge>
                                                    )}

                                                    {f.viq_paragraph && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[10px] font-mono"
                                                        >
                                                            Ref: {f.viq_paragraph}
                                                        </Badge>
                                                    )}

                                                    {f.job_order_no && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] font-mono text-muted-foreground"
                                                        >
                                                            Job Order: {f.job_order_no}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                {isEditable && (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleOpenEditFinding(f)}
                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                            title="Edit finding details"
                                                        >
                                                            <Edit2 className="size-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => onDeleteFinding(f.id)}
                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                            title="Delete finding"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Finding Description Text */}
                                            <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-line pl-1 border-l-2 border-primary/40">
                                                {f.description}
                                            </p>

                                            {/* Target Date & Status Info */}
                                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                                                {f.target_date && (
                                                    <div>
                                                        <span className="font-medium">Target Date:</span>{' '}
                                                        <span className="font-mono text-foreground">
                                                            {f.target_date.split('T')[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="font-medium">Status:</span>{' '}
                                                    <span className="capitalize font-semibold text-foreground">
                                                        {f.finding_status || 'Open'}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Add / Edit Finding Dialog */}
            <Dialog open={findingModalOpen} onOpenChange={setFindingModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingFinding ? 'Edit Deficiency / Finding' : 'Add New Deficiency / Finding'}
                        </DialogTitle>
                        <DialogDescription>
                            Enter details and classifications for this observation or non-conformity.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveFinding} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Finding Kind</Label>
                                <select
                                    value={findingFormData.finding_kind}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            finding_kind: e.target.value as 'observation' | 'non_conformity',
                                        }))
                                    }
                                    className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
                                >
                                    <option value="observation">Observation</option>
                                    <option value="non_conformity">Non-Conformity (NCR)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Risk Level</Label>
                                <select
                                    value={findingFormData.risk || 'medium'}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            risk: e.target.value as 'high' | 'medium' | 'low',
                                        }))
                                    }
                                    className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
                                >
                                    <option value="low">Low Risk</option>
                                    <option value="medium">Medium Risk</option>
                                    <option value="high">High Risk</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">
                                Description & Condition Observed{' '}
                                <span className="text-rose-500">*</span>
                            </Label>
                            <textarea
                                rows={4}
                                required
                                value={findingFormData.description || ''}
                                onChange={(e) =>
                                    setFindingFormData((prev) => ({ ...prev, description: e.target.value }))
                                }
                                placeholder="Describe factual condition observed, location, equipment involved, and safety implication..."
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">VIQ / Code Reference</Label>
                                <Input
                                    value={findingFormData.viq_paragraph || ''}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            viq_paragraph: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. 5.12 or SMS-04"
                                    className="h-8 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Job Order / Action No</Label>
                                <Input
                                    value={findingFormData.job_order_no || ''}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            job_order_no: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. PMS-4421"
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Target Rectification Date</Label>
                                <Input
                                    type="date"
                                    value={findingFormData.target_date || ''}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            target_date: e.target.value,
                                        }))
                                    }
                                    className="h-8 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Finding Status</Label>
                                <select
                                    value={findingFormData.finding_status || 'open'}
                                    onChange={(e) =>
                                        setFindingFormData((prev) => ({
                                            ...prev,
                                            finding_status: e.target.value,
                                        }))
                                    }
                                    className="h-8 text-xs w-full rounded-md border border-input bg-background px-2"
                                >
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="closed">Rectified / Closed</option>
                                </select>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFindingModalOpen(false)}
                                disabled={isSavingFinding}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSavingFinding}>
                                {isSavingFinding ? 'Saving...' : 'Save Finding'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>



            {/* Previous Chapter Navigation */}
            {prevChapter && (
                <div className="flex justify-between pt-2 pb-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onChapterSwitch(prevChapter.id)}
                        className="flex items-center gap-2"
                    >
                        <ChevronLeft className="size-4" />
                        <span>
                            Prev:{' '}
                            {prevChapter.chapter_no
                                ? `Chapter ${prevChapter.chapter_no} - ${prevChapter.title}`
                                : prevChapter.title}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
}
