import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Award,
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    HelpCircle,
    Info,
    MessageSquare,
    Plus,
    ShieldAlert,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    UserCheck,
    Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { RowsBlock, type ColumnConfig } from '@/components/reports/rows-block';
import { SaveStatusIndicator, SaveStatus } from '@/components/reports/save-status-indicator';
import { csrfHeaders, generateClientSaveId } from '@/lib/autosave-queue';
import type {
    AuditeeEvaluationRow,
    AuditPersonRow,
    EvaluationCriterionData,
    ReportData,
} from '@/types';

export const SCORE_LABELS: Record<number, { label: string; short: string; color: string; desc: string }> = {
    5: {
        label: '5 - Excellent',
        short: 'Excellent',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400',
        desc: 'SMS conformance is outstanding and maintained much higher than usually expected.',
    },
    4: {
        label: '4 - Above Expectations',
        short: 'Above Exp.',
        color: 'text-blue-700 bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400',
        desc: 'SMS conformance is high and significantly better than normally scored acceptable.',
    },
    3: {
        label: '3 - Satisfactory',
        short: 'Satisfactory',
        color: 'text-teal-700 bg-teal-50 border-teal-300 dark:bg-teal-950/40 dark:text-teal-400',
        desc: 'SMS conformance is in line with normal expectation and satisfactory.',
    },
    2: {
        label: '2 - Fair',
        short: 'Fair',
        color: 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400',
        desc: 'SMS conformance is below expectations; trainable to satisfactory level with proper training.',
    },
    1: {
        label: '1 - Unsatisfactory',
        short: 'Unsatisfactory',
        color: 'text-rose-700 bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400',
        desc: 'Capacity is inadequate in audited area(s); improvement uncertain even with additional training.',
    },
};

export const DEFAULT_EVAL_CRITERIA: EvaluationCriterionData[] = [
    {
        criterion_key: 'sms_knowledge',
        label: 'Evaluate the awareness/knowledge of auditee with the SMS and Company policies.',
        sort_order: 1,
    },
    {
        criterion_key: 'safety_emergency_equipment',
        label: 'Evaluate auditee awareness in safety and use of LSA/FFE/security/emergency eq.',
        sort_order: 2,
    },
    {
        criterion_key: 'international_regulations',
        label: 'Evaluate auditee awareness in the international regulations.',
        sort_order: 3,
    },
    {
        criterion_key: 'familiarisation',
        label: 'Evaluate auditee familiarization during his service onboard.',
        sort_order: 4,
    },
    {
        criterion_key: 'environmental_protection',
        label: 'Evaluate auditee awareness in topics related to protection of the environment.',
        sort_order: 5,
    },
    {
        criterion_key: 'emergency_procedures',
        label: 'Evaluate auditee familiarization with vessel emergency procedures.',
        sort_order: 6,
    },
    {
        criterion_key: 'continuous_improvement',
        label: 'Evaluate the support of auditee to the continuous improvement process.',
        sort_order: 7,
    },
];

export const COMMON_RANKS = [
    'Master',
    'Chief Engineer',
    'Chief Officer',
    'Second Engineer',
    'Second Officer',
    'Third Engineer',
    'Third Officer',
    'Fourth Engineer',
    'Bosun',
    'Able Seaman (AB)',
    'Ordinary Seaman (OS)',
    'Oiler',
    'Wiper',
    'Chief Cook',
    'Messman',
];

export const STATUS_OPTIONS = [
    { value: 'Satisfactory', label: 'Satisfactory' },
    { value: 'Above Expectations', label: 'Above Expectations' },
    { value: 'Excellent', label: 'Excellent' },
    { value: 'Fair', label: 'Fair' },
    { value: 'Unsatisfactory', label: 'Unsatisfactory' },
];

export const EXECUTION_LOG_COLUMNS: ColumnConfig[] = [
    {
        key: 'person_or_function',
        label: 'Person / Function',
        type: 'text',
        placeholder: 'e.g. Master & C/O or Opening Meeting',
        width: 'w-48 sm:w-60',
    },
    {
        key: 'date',
        label: 'Date',
        type: 'date',
        width: 'w-36',
    },
    {
        key: 'start_time',
        label: 'Start Time',
        type: 'time',
        width: 'w-28',
    },
    {
        key: 'end_time',
        label: 'End Time',
        type: 'time',
        width: 'w-28',
    },
    {
        key: 'topics',
        label: 'Scope / Topics Audited',
        type: 'textarea',
        placeholder: 'e.g. SMS Review, Bridge Procedures, Navigation Records',
    },
];

export interface AuditEvaluationPageProps {
    report: ReportData;
    isEditable: boolean;
    onChapterSwitch: (chapterId: number) => void;
}

export function AuditEvaluationPage({
    report,
    isEditable,
    onChapterSwitch,
}: AuditEvaluationPageProps) {
    // 1. Criteria: from summary_data or default
    const criteria: EvaluationCriterionData[] = useMemo(() => {
        const fromSummary = report.summary_data?.evaluation_criteria;
        if (fromSummary && Array.isArray(fromSummary) && fromSummary.length > 0) {
            return fromSummary;
        }
        return DEFAULT_EVAL_CRITERIA;
    }, [report.summary_data?.evaluation_criteria]);

    // 2. People list for quick crew matching
    const peopleAuditees: AuditPersonRow[] = useMemo(() => {
        const peopleDataset = report.datasets?.find((d) => d.dataset_key === 'audit_people');
        const rows = (peopleDataset?.rows || []) as AuditPersonRow[];
        return rows.filter((p) => (p.role || '').toLowerCase() === 'auditee');
    }, [report.datasets]);

    // 3. Initial evaluation rows
    const evalDataset = report.datasets?.find((d) => d.dataset_key === 'audit_evaluation');
    const initialRows: AuditeeEvaluationRow[] = useMemo(() => {
        const existingRows = (evalDataset?.rows || []) as AuditeeEvaluationRow[];
        if (existingRows.length > 0) {
            return existingRows;
        }

        const res: AuditeeEvaluationRow[] = [];

        // Seed from report Master/C/E
        if (report.master_name) {
            res.push({
                name: report.master_name,
                rank: 'Master',
                scores: {},
                overall_status: 'Satisfactory',
                sort_order: 1,
            });
        }
        if (report.chief_engineer_name) {
            res.push({
                name: report.chief_engineer_name,
                rank: 'Chief Engineer',
                scores: {},
                overall_status: 'Satisfactory',
                sort_order: 2,
            });
        }

        if (res.length === 0) {
            res.push({
                name: '',
                rank: 'Master',
                scores: {},
                overall_status: 'Satisfactory',
                sort_order: 1,
            });
        }

        return res;
    }, [evalDataset?.rows, report.master_name, report.chief_engineer_name]);

    const [rows, setRows] = useState<AuditeeEvaluationRow[]>(initialRows);
    const [rowVersion, setRowVersion] = useState<number>(evalDataset?.row_version || 1);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [showLegend, setShowLegend] = useState(true);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowsRef = useRef<AuditeeEvaluationRow[]>(rows);
    rowsRef.current = rows;
    const rowVersionRef = useRef<number>(rowVersion);
    rowVersionRef.current = rowVersion;

    // Debounced autosave
    const triggerSave = useCallback(
        (updatedRows: AuditeeEvaluationRow[]) => {
            if (!isEditable) return;

            setSaveStatus('saving');
            setErrorMessage(undefined);

            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            debounceTimer.current = setTimeout(async () => {
                const clientSaveId = generateClientSaveId();
                const baseVer = rowVersionRef.current;

                try {
                    const res = await fetch(`/reports/${report.id}/datasets/audit_evaluation`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            ...csrfHeaders(),
                        },
                        body: JSON.stringify({
                            rows: updatedRows,
                            base_row_version: baseVer,
                            client_save_id: clientSaveId,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json().catch(() => ({}));
                        const newVer = data?.dataset?.row_version || baseVer + 1;
                        setRowVersion(newVer);
                        rowVersionRef.current = newVer;
                        setSaveStatus('saved');
                        setTimeout(() => {
                            setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
                        }, 2500);
                    } else if (res.status === 409) {
                        setSaveStatus('conflict');
                        setErrorMessage('Conflict detected: evaluation was modified by another save.');
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        setSaveStatus('error');
                        setErrorMessage(errData?.message || 'Failed to save evaluation.');
                    }
                } catch {
                    setSaveStatus('error');
                    setErrorMessage('Network error while saving evaluation.');
                }
            }, 800);
        },
        [isEditable, report.id]
    );

    // 4. Execution log dataset
    const executionLogDataset = report.datasets?.find((d) => d.dataset_key === 'audit_execution_log');
    const defaultExecutionRows = useMemo(() => {
        if (executionLogDataset?.rows && executionLogDataset.rows.length > 0) {
            return executionLogDataset.rows as Array<Record<string, any>>;
        }
        return [
            {
                person_or_function: 'Opening Meeting & SMS Review',
                date: report.report_date || '',
                start_time: '09:00',
                end_time: '10:00',
                topics: 'Opening meeting with Master and senior officers. Scope and schedule confirmation.',
                sort_order: 1,
            },
        ];
    }, [executionLogDataset?.rows, report.report_date]);

    // 5. Auditor general comments state & debounced autosave
    const [positiveComments, setPositiveComments] = useState<string>(
        report.summary_data?.positive_comments ??
            (report.summary_data as Record<string, any> | undefined)?.summary_auditors_comments_positive ??
            ''
    );
    const [negativeComments, setNegativeComments] = useState<string>(
        report.summary_data?.negative_comments ??
            (report.summary_data as Record<string, any> | undefined)?.summary_auditors_comments_negative ??
            ''
    );
    const [commentsSaveStatus, setCommentsSaveStatus] = useState<SaveStatus>('idle');
    const [commentsError, setCommentsError] = useState<string | undefined>(undefined);
    const commentsDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerCommentsSave = useCallback(
        (pos: string, neg: string) => {
            if (!isEditable) return;
            setCommentsSaveStatus('saving');
            setCommentsError(undefined);

            if (commentsDebounceTimer.current) {
                clearTimeout(commentsDebounceTimer.current);
            }

            commentsDebounceTimer.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/reports/${report.id}/fields`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            ...csrfHeaders(),
                        },
                        body: JSON.stringify({
                            fields: {
                                positive_comments: pos,
                                negative_comments: neg,
                            },
                        }),
                    });

                    if (res.ok) {
                        setCommentsSaveStatus('saved');
                        setTimeout(() => {
                            setCommentsSaveStatus((s) => (s === 'saved' ? 'idle' : s));
                        }, 2500);
                    } else {
                        setCommentsSaveStatus('error');
                        setCommentsError('Failed to save auditor general comments.');
                    }
                } catch {
                    setCommentsSaveStatus('error');
                    setCommentsError('Network error while saving comments.');
                }
            }, 800);
        },
        [isEditable, report.id]
    );

    const handlePositiveChange = (val: string) => {
        setPositiveComments(val);
        triggerCommentsSave(val, negativeComments);
    };

    const handleNegativeChange = (val: string) => {
        setNegativeComments(val);
        triggerCommentsSave(positiveComments, val);
    };

    // Row modifiers
    const handleUpdateRowField = (index: number, field: keyof AuditeeEvaluationRow, val: any) => {
        const next = [...rows];
        next[index] = { ...next[index], [field]: val };
        setRows(next);
        triggerSave(next);
    };

    const handleScoreSelect = (auditeeIndex: number, criterionKey: string, score: number) => {
        if (!isEditable) return;
        const next = [...rows];
        const currentScores = { ...(next[auditeeIndex].scores || {}) };
        if (currentScores[criterionKey] === score) {
            delete currentScores[criterionKey];
        } else {
            currentScores[criterionKey] = score;
        }
        next[auditeeIndex] = { ...next[auditeeIndex], scores: currentScores };
        setRows(next);
        triggerSave(next);
    };

    const handleAddAuditee = () => {
        if (!isEditable) return;
        const next: AuditeeEvaluationRow[] = [
            ...rows,
            {
                name: '',
                rank: 'Officer/Crew',
                scores: {},
                overall_status: 'Satisfactory',
                sort_order: rows.length + 1,
            },
        ];
        setRows(next);
        triggerSave(next);
    };

    const handleRemoveAuditee = (index: number) => {
        if (!isEditable || rows.length <= 4) return;
        const next = rows.filter((_, i) => i !== index);
        setRows(next);
        triggerSave(next);
    };

    const handleSelectPerson = (index: number, person: AuditPersonRow) => {
        handleUpdateRowField(index, 'name', person.name);
        if (person.rank) {
            handleUpdateRowField(index, 'rank', person.rank);
        }
    };

    // Calculate score summary for an auditee
    const getAuditeeStats = (auditee: AuditeeEvaluationRow) => {
        const scores = Object.values(auditee.scores || {}).filter((s) => typeof s === 'number' && s >= 1 && s <= 5);
        if (scores.length === 0) return null;
        const sum = scores.reduce((a, b) => a + b, 0);
        const avg = (sum / scores.length).toFixed(1);
        return { count: scores.length, total: criteria.length, avg };
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="flex items-start justify-between gap-4 border-b pb-4 flex-wrap">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                            Part 4
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
                            Form B-008 Assessment
                        </Badge>
                        <Badge
                            variant="outline"
                            className="text-xs font-medium bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                            <ShieldAlert className="size-3 mr-1 inline" />
                            Confidential
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Auditee Evaluation (Crew SMS & Safety Scoring)
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Confidential assessment of crew SMS awareness, familiarisation, and emergency preparedness.
                        At least four auditees must be evaluated.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <SaveStatusIndicator status={saveStatus} errorMessage={errorMessage} />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLegend(!showLegend)}
                        className="text-xs h-8 text-muted-foreground"
                    >
                        <Info className="size-3.5 mr-1" />
                        {showLegend ? 'Hide Legend' : 'Show Legend'}
                    </Button>
                </div>
            </div>

            {/* Scoring Definitions Guide */}
            {showLegend && (
                <Card className="bg-muted/30 border-dashed overflow-hidden">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <Award className="size-4 text-primary" />
                            <span>1 to 5 Scoring Criteria Guide</span>
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                            Each criterion evaluates individual competency and SMS execution on board.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            {[5, 4, 3, 2, 1].map((score) => {
                                const info = SCORE_LABELS[score];
                                return (
                                    <div
                                        key={score}
                                        className={`p-2.5 rounded-md border text-xs space-y-1 ${info.color}`}
                                    >
                                        <div className="font-bold flex items-center justify-between text-xs">
                                            <span>{info.short}</span>
                                            <span className="font-mono text-[11px] font-black">{score}</span>
                                        </div>
                                        <p className="text-[10px] leading-snug opacity-90">{info.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Auditee Evaluation Cards */}
            <div className="space-y-6">
                {rows.map((auditee, index) => {
                    const stats = getAuditeeStats(auditee);

                    return (
                        <Card
                            key={index}
                            className="border-2 border-border/80 shadow-xs hover:border-primary/40 transition-colors bg-card overflow-hidden"
                        >
                            <CardHeader className="bg-muted/20 border-b p-4 pb-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-7 rounded-md bg-primary text-primary-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                            #{index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                <span>
                                                    {auditee.name ? auditee.name : `Auditee #${index + 1}`}
                                                </span>
                                                {auditee.rank && (
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        ({auditee.rank})
                                                    </span>
                                                )}
                                            </CardTitle>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {stats && (
                                            <Badge
                                                variant="outline"
                                                className="text-xs font-semibold font-mono bg-background"
                                            >
                                                Avg Score: {stats.avg} / 5 ({stats.count}/{stats.total})
                                            </Badge>
                                        )}

                                        {isEditable && rows.length > 1 && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleRemoveAuditee(index)}
                                                className="h-7 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                                                title="Remove this auditee"
                                            >
                                                <Trash2 className="size-3.5 mr-1" />
                                                <span>Remove</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Auditee Particulars Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
                                    {/* Name Input & Quick Select (Takes 6 of 12 cols) */}
                                    <div className="sm:col-span-6 space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground block">
                                            Auditee Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <Input
                                                value={auditee.name || ''}
                                                disabled={!isEditable}
                                                onChange={(e) => handleUpdateRowField(index, 'name', e.target.value)}
                                                placeholder="e.g. Capt. John Smith"
                                                className="h-8 text-xs flex-1 min-w-0"
                                            />
                                            {isEditable && peopleAuditees.length > 0 && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                                            title="Pick from crew list"
                                                        >
                                                            <Users className="size-3.5" />
                                                            <span className="sr-only">Pick crew member</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 max-h-60 overflow-y-auto">
                                                        <DropdownMenuLabel className="text-xs">Select Crew Member</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {peopleAuditees.map((p, pIdx) => (
                                                            <DropdownMenuItem
                                                                key={pIdx}
                                                                onClick={() => handleSelectPerson(index, p)}
                                                                className="cursor-pointer text-xs flex flex-col items-start gap-0.5"
                                                            >
                                                                <span className="font-medium text-foreground">{p.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{p.rank}</span>
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rank / Position Input (Takes 3 of 12 cols - smaller) */}
                                    <div className="sm:col-span-3 space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground block">
                                            Rank / Position
                                        </label>
                                        <Input
                                            value={auditee.rank || ''}
                                            disabled={!isEditable}
                                            list={`ranks-list-${index}`}
                                            onChange={(e) => handleUpdateRowField(index, 'rank', e.target.value)}
                                            placeholder="e.g. Master"
                                            className="h-8 text-xs"
                                        />
                                        <datalist id={`ranks-list-${index}`}>
                                            {COMMON_RANKS.map((r) => (
                                                <option key={r} value={r} />
                                            ))}
                                        </datalist>
                                    </div>

                                    {/* Overall Status (Takes 3 of 12 cols) */}
                                    <div className="sm:col-span-3 space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground block">
                                            Overall Status
                                        </label>
                                        <select
                                            value={auditee.overall_status || 'Satisfactory'}
                                            disabled={!isEditable}
                                            onChange={(e) =>
                                                handleUpdateRowField(index, 'overall_status', e.target.value)
                                            }
                                            className="h-8 text-xs w-full rounded-md border border-input bg-background px-2 font-medium"
                                        >
                                            {STATUS_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0 divide-y divide-border/60">
                                {criteria.map((crit, critIdx) => {
                                    const currentScore = auditee.scores?.[crit.criterion_key];

                                    return (
                                        <div
                                            key={crit.criterion_key}
                                            className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                                        >
                                            <div className="space-y-0.5 sm:max-w-xl">
                                                <div className="text-xs font-semibold text-foreground flex items-baseline gap-1.5">
                                                    <span className="font-mono text-muted-foreground shrink-0">
                                                        {critIdx + 1}.
                                                    </span>
                                                    <span>{crit.label}</span>
                                                </div>
                                            </div>

                                            {/* 1-5 Score Radio Selector */}
                                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                                {[1, 2, 3, 4, 5].map((score) => {
                                                    const isSelected = currentScore === score;
                                                    const def = SCORE_LABELS[score];

                                                    return (
                                                        <button
                                                            key={score}
                                                            type="button"
                                                            disabled={!isEditable}
                                                            onClick={() =>
                                                                handleScoreSelect(index, crit.criterion_key, score)
                                                            }
                                                            title={def.desc}
                                                            className={`size-8 rounded font-mono text-xs font-bold transition-all flex items-center justify-center border ${
                                                                isSelected
                                                                    ? `${def.color} shadow-xs scale-105 ring-2 ring-primary/40`
                                                                    : 'bg-background hover:bg-muted text-muted-foreground border-input'
                                                            } ${!isEditable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                        >
                                                            {score}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Remarks & Evaluation Comments Row */}
                                <div className="p-3 sm:px-4 bg-muted/10 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <label className="text-[11px] font-medium text-muted-foreground shrink-0">
                                        Remarks / Evaluation Notes
                                    </label>
                                    <Input
                                        value={auditee.comments || ''}
                                        disabled={!isEditable}
                                        onChange={(e) => handleUpdateRowField(index, 'comments', e.target.value)}
                                        placeholder="Specific observations, strengths, or training recommendations..."
                                        className="h-8 text-xs max-w-xl bg-background"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Bottom Actions for Auditee Evaluation */}
            <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
                {isEditable && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddAuditee}
                        className="flex items-center gap-1.5 h-8 text-xs font-semibold"
                    >
                        <Plus className="size-3.5" />
                        <span>Add Another Auditee</span>
                    </Button>
                )}

                <span className="text-xs text-muted-foreground font-mono">
                    Total Evaluated: {rows.length}
                </span>
            </div>

            {/* Section 2: Audit Execution Timetable Log */}
            <div className="space-y-3 pt-6 border-t">
                <RowsBlock
                    reportId={report.id}
                    datasetKey="audit_execution_log"
                    columns={EXECUTION_LOG_COLUMNS}
                    initialRows={defaultExecutionRows}
                    initialRowVersion={executionLogDataset?.row_version || 1}
                    title="Audit Execution Timetable Log"
                    description="Chronological log of meetings, interviews, on-board verifications, and areas audited."
                    icon={Clock}
                    isEditable={isEditable}
                    allowReorder={true}
                    addButtonLabel="Add Execution Entry"
                    emptyMessage="No audit execution sessions logged yet. Click Add Execution Entry to record meetings and audit areas."
                    minRows={1}
                    renderRow={({
                        row,
                        rowIndex,
                        updateCell,
                        removeRow,
                        moveRowUp,
                        moveRowDown,
                        canMoveUp,
                        canMoveDown,
                        canRemove,
                        isEditable: editable,
                        handleBlur,
                    }) => (
                        <div className="p-3.5 sm:p-4 rounded-lg border border-border/80 bg-muted/15 hover:bg-muted/25 transition-colors shadow-2xs space-y-3">
                            {/* Session Header Strip: Badge, Time summary pill, Up/Down reorder, Delete */}
                            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border/60">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold font-mono">
                                        {rowIndex + 1}
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">
                                        Session #{rowIndex + 1}
                                    </span>
                                    {row.start_time && row.end_time && (
                                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-5 bg-background">
                                            {row.start_time} - {row.end_time}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!editable || !canMoveUp}
                                        onClick={moveRowUp}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                        title="Move session up"
                                    >
                                        <ArrowUp className="size-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!editable || !canMoveDown}
                                        onClick={moveRowDown}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                        title="Move session down"
                                    >
                                        <ArrowDown className="size-3.5" />
                                    </Button>

                                    {editable && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={!canRemove}
                                            onClick={removeRow}
                                            className="h-7 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs ml-1 disabled:opacity-30"
                                            title="Delete this session entry"
                                        >
                                            <Trash2 className="size-3.5 mr-1" />
                                            <span>Delete</span>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Inputs Grid: Person/Function, Date, Start Time, End Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                                <div className="sm:col-span-2 lg:col-span-5 space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Users className="size-3 text-muted-foreground/80" />
                                        <span>Person / Function / Meeting</span>
                                    </label>
                                    <Input
                                        value={row.person_or_function || ''}
                                        disabled={!editable}
                                        placeholder="e.g. Master & C/O or Opening Meeting"
                                        onChange={(e) => updateCell('person_or_function', e.target.value)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs bg-background"
                                    />
                                </div>

                                <div className="lg:col-span-3 space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="size-3 text-muted-foreground/80" />
                                        <span>Date</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={row.date || ''}
                                        disabled={!editable}
                                        onChange={(e) => updateCell('date', e.target.value, true)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs bg-background"
                                    />
                                </div>

                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="size-3 text-muted-foreground/80" />
                                        <span>Start Time</span>
                                    </label>
                                    <Input
                                        type="time"
                                        value={row.start_time || ''}
                                        disabled={!editable}
                                        onChange={(e) => updateCell('start_time', e.target.value, true)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs font-mono bg-background"
                                    />
                                </div>

                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="size-3 text-muted-foreground/80" />
                                        <span>End Time</span>
                                    </label>
                                    <Input
                                        type="time"
                                        value={row.end_time || ''}
                                        disabled={!editable}
                                        onChange={(e) => updateCell('end_time', e.target.value, true)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs font-mono bg-background"
                                    />
                                </div>
                            </div>

                            {/* Scope / Topics Audited (Full Width with Textarea) */}
                            <div className="space-y-1 pt-0.5">
                                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="size-3 text-muted-foreground/80" />
                                    <span>Scope / Topics Audited & Areas Verified</span>
                                </label>
                                <textarea
                                    value={row.topics || ''}
                                    disabled={!editable}
                                    rows={2}
                                    placeholder="e.g. SMS Review, Bridge Procedures, Navigation Records, ECDIS check, Passage Planning, Drills verification..."
                                    onChange={(e) => updateCell('topics', e.target.value)}
                                    onBlur={handleBlur}
                                    className="w-full text-xs rounded-md border border-input bg-background p-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[58px] leading-relaxed"
                                />
                            </div>
                        </div>
                    )}
                />
            </div>

            {/* Section 3: Auditor(s) General Comments */}
            <Card className="border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="bg-muted/20 border-b p-4 sm:p-5 pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <MessageSquare className="size-4 text-primary" />
                                <span>Auditor(s) General Comments</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Overall impressions, commendations, and key areas requiring attention or improvement.
                            </CardDescription>
                        </div>
                        <SaveStatusIndicator status={commentsSaveStatus} errorMessage={commentsError} />
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Positive Comments */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="size-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <ThumbsUp className="size-3" />
                            </div>
                            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                Positive Comments / Commendable Observations
                            </label>
                        </div>
                        <textarea
                            value={positiveComments}
                            onChange={(e) => handlePositiveChange(e.target.value)}
                            disabled={!isEditable}
                            rows={4}
                            placeholder="Enter commendable observations, best practices noted, crew cooperation, or areas of outstanding performance..."
                            className="w-full text-xs rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        />
                    </div>

                    {/* Negative Comments */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="size-5 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                <ThumbsDown className="size-3" />
                            </div>
                            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                Negative Comments / Areas for Improvement
                            </label>
                        </div>
                        <textarea
                            value={negativeComments}
                            onChange={(e) => handleNegativeChange(e.target.value)}
                            disabled={!isEditable}
                            rows={4}
                            placeholder="Enter negative observations, recurring deficiencies, systemic weaknesses, or areas requiring corrective follow-up..."
                            className="w-full text-xs rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Page Navigation Controls */}
            <div className="flex justify-between items-center pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChapterSwitch(-100)}
                    className="flex items-center gap-2"
                >
                    <ChevronLeft className="size-4" />
                    <span>Back: Vessel&apos;s Audit Report</span>
                </Button>

                <Button
                    type="button"
                    variant="default"
                    onClick={() => window.open(`/reports/${report.id}/pdf`, '_blank')}
                    className="flex items-center gap-2"
                >
                    <span>Preview Generated PDF</span>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
