import {
    AlertCircle,
    Briefcase,
    Calendar,
    Check,
    ChevronRight,
    FileCheck,
    Info,
    Loader2,
    Plus,
    Ship,
    Trash2,
    UserCheck,
    Users,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { QuestionAnswerCard } from '@/components/question-answer-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { csrfHeaders } from '@/lib/autosave-queue';
import { formatDate } from '@/lib/question-utils';
import type {
    AnswerData,
    AuditPersonRow,
    ChapterData,
    ConflictData,
    QuestionData,
    ReportData,
} from '@/types';

export const INSPECTION_OPERATIONS = [
    'Loading',
    'Discharging',
    'Bunkering',
    'Deballasting',
    'Ballasting',
    'River transit',
    'IGS in operation',
    'Major repairs/ Drydock',
    'COW in progress',
    'Repairs under way',
    'STS operations',
    'Idle',
    'At anchor',
    'At sea/Sailing',
    'Other',
];

export const AUDIT_OPERATIONS = [
    'Loading',
    'Discharging',
    'Bunkering',
    'Repairs afloat',
    'Deballasting',
    'Ballasting',
    'Idle',
    'River transit',
    'At anchor',
    'At sea/Sailing',
    'Drydock',
];

export const AUDIT_TYPES = [
    { value: 'A', label: 'A - Internal Audit' },
    { value: 'B', label: 'B - Independent Audit' },
    { value: 'C', label: 'C - Unscheduled Audit' },
    { value: 'D', label: 'D - Other (Specify)' },
];

export interface GeneralInfoSectionProps {
    report: ReportData;
    isEditable: boolean;
    attendanceSubgroup?: ChapterData['subgroups'][0];
    answers: Record<number, AnswerData>;
    isB008: boolean;
    answerChoices: { value: string; label: string; color: string }[];
    expandedGuidance: Record<number, boolean>;
    saveStatuses: Record<number, string>;
    conflicts: Record<number, ConflictData>;
    nextChapter?: { id: number; title: string; chapter_no?: string | null; sort_order?: number } | null;
    onChapterSwitch: (chapterId: number) => void;
    onToggleGuidance: (questionId: number) => void;
    onSelectAnswer: (questionId: number, val: string) => void;
    onSaveExtraValue: (questionId: number, val: string) => void;
    onAcceptServerAnswer: (questionId: number, srv: ConflictData['server_answer']) => void;
    onOverwriteAnswer: (questionId: number, srvVer: number) => void;
    filterQuestion: (q: QuestionData) => boolean;
}

export function GeneralInfoSection({
    report,
    isEditable,
    attendanceSubgroup,
    answers,
    isB008,
    answerChoices,
    expandedGuidance,
    saveStatuses,
    conflicts,
    nextChapter,
    onChapterSwitch,
    onToggleGuidance,
    onSelectAnswer,
    onSaveExtraValue,
    onAcceptServerAnswer,
    onOverwriteAnswer,
    filterQuestion,
}: GeneralInfoSectionProps) {
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ==========================================
    // D-062 Inspection State
    // ==========================================
    const [info, setInfo] = useState({
        report_date: formatDate(report.report_date),
        port: report.port || '',
        inspected_by: report.inspected_by || '',
        master_name: report.master_name || '',
        chief_engineer_name: report.chief_engineer_name || '',
        chief_officer_name: report.chief_officer_name || '',
        sailing_with_vessel: Boolean(report.sailing_with_vessel),
        sailing_from: report.sailing_from || '',
        sailing_to: report.sailing_to || '',
        psc_last_port: report.psc_last_port || '',
        psc_last_date: formatDate(report.psc_last_date),
        psc_detained_or_deficiencies: Boolean(report.psc_detained_or_deficiencies),
        drydock_last_date: formatDate(report.drydock_last_date),
        drydock_next_date: formatDate(report.drydock_next_date),
        operations: (report.operations || []) as string[],
    });

    const persistInspectionChanges = async (nextState: typeof info) => {
        if (!isEditable) return;
        setSaveStatus('saving');
        try {
            const res = await fetch(`/reports/${report.id}/general-info`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(nextState),
            });

            if (res.ok) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2500);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        }
    };

    const updateInspectionField = (field: keyof typeof info, val: any, debounce = true) => {
        const next = { ...info, [field]: val };
        setInfo(next);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!debounce) {
            persistInspectionChanges(next);
        } else {
            debounceTimer.current = setTimeout(() => {
                persistInspectionChanges(next);
            }, 1200);
        }
    };

    const toggleInspectionOperation = (op: string) => {
        const nextOps = info.operations.includes(op)
            ? info.operations.filter((o) => o !== op)
            : [...info.operations, op];
        updateInspectionField('operations', nextOps, false);
    };

    // ==========================================
    // B-008 Audit Set-up State (SRS 14.4, Task 7.2)
    // ==========================================
    const [auditState, setAuditState] = useState({
        report_date: formatDate(report.report_date),
        port: report.port || '',
        master_name: report.master_name || '',
        chief_engineer_name: report.chief_engineer_name || '',
        start_date: formatDate(report.report_date),
        end_date: formatDate(report.summary_data?.audit_end_date || report.report_date),
        audit_type: report.summary_data?.audit_type || 'A',
        audit_type_other: report.summary_data?.audit_type_other || '',
        lead_auditor: report.summary_data?.lead_auditor || report.inspected_by || '',
        operations: (report.operations || []) as string[],
    });

    const [activities, setActivities] = useState<string[]>(
        report.summary_data?.activities_audited && report.summary_data.activities_audited.length > 0
            ? report.summary_data.activities_audited
            : ['Bridge', 'Deck', 'Engine']
    );
    const [newActivityInput, setNewActivityInput] = useState('');

    const auditPeopleDataset = report.datasets?.find((d) => d.dataset_key === 'audit_people');
    const initialPeople: AuditPersonRow[] = auditPeopleDataset?.rows ?? [];

    const initialAuditors = initialPeople.filter((p) =>
        (p.role || '').toLowerCase().includes('auditor')
    );
    const initialAuditees = initialPeople.filter(
        (p) => !(p.role || '').toLowerCase().includes('auditor')
    );

    const [auditors, setAuditors] = useState<AuditPersonRow[]>(
        initialAuditors.length > 0
            ? initialAuditors
            : [
                  {
                      name: report.inspected_by || '',
                      rank: 'Lead Auditor',
                      role: 'Lead auditor',
                      sort_order: 1,
                  },
              ]
    );

    const [auditees, setAuditees] = useState<AuditPersonRow[]>(
        initialAuditees.length > 0
            ? initialAuditees
            : [
                  {
                      name: report.master_name || '',
                      rank: 'Master',
                      role: 'Auditee',
                      sort_order: 1,
                  },
                  {
                      name: report.chief_engineer_name || '',
                      rank: 'Chief Engineer',
                      role: 'Auditee',
                      sort_order: 2,
                  },
              ]
    );

    const persistAuditSetup = async (
        nextAuditState: typeof auditState,
        nextActivities: string[],
        nextAuditors: AuditPersonRow[],
        nextAuditees: AuditPersonRow[]
    ) => {
        if (!isEditable) return;
        setSaveStatus('saving');
        try {
            // 1. Update scalar fields & report columns via PUT /reports/{id}/fields
            const fieldsPromise = fetch(`/reports/${report.id}/fields`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    fields: {
                        report_date: nextAuditState.start_date || nextAuditState.report_date,
                        port: nextAuditState.port,
                        master_name: nextAuditState.master_name,
                        chief_engineer_name: nextAuditState.chief_engineer_name,
                        operations: nextAuditState.operations,
                        audit_type: nextAuditState.audit_type,
                        audit_type_other: nextAuditState.audit_type_other,
                        audit_end_date: nextAuditState.end_date,
                        lead_auditor: nextAuditState.lead_auditor,
                        activities_audited: nextActivities,
                    },
                }),
            });

            // 2. Update people dataset via PUT /reports/{id}/datasets/audit_people
            const combinedPeople = [
                ...nextAuditors.map((a, i) => ({
                    name: a.name,
                    rank: a.rank,
                    role: a.role || 'Auditor',
                    sort_order: i + 1,
                })),
                ...nextAuditees.map((a, i) => ({
                    name: a.name,
                    rank: a.rank,
                    role: 'Auditee',
                    sort_order: nextAuditors.length + i + 1,
                })),
            ];

            const datasetPromise = fetch(`/reports/${report.id}/datasets/audit_people`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ rows: combinedPeople }),
            });

            const [fieldsRes, datasetRes] = await Promise.all([fieldsPromise, datasetPromise]);

            if (fieldsRes.ok && datasetRes.ok) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2500);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        }
    };

    const triggerAuditAutosave = (
        nextAuditState = auditState,
        nextActivities = activities,
        nextAuditors = auditors,
        nextAuditees = auditees,
        debounce = true
    ) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!debounce) {
            persistAuditSetup(nextAuditState, nextActivities, nextAuditors, nextAuditees);
        } else {
            debounceTimer.current = setTimeout(() => {
                persistAuditSetup(nextAuditState, nextActivities, nextAuditors, nextAuditees);
            }, 1200);
        }
    };

    const updateAuditField = (field: keyof typeof auditState, val: any, debounce = true) => {
        const next = { ...auditState, [field]: val };
        setAuditState(next);
        triggerAuditAutosave(next, activities, auditors, auditees, debounce);
    };

    const toggleAuditOperation = (op: string) => {
        const nextOps = auditState.operations.includes(op)
            ? auditState.operations.filter((o) => o !== op)
            : [...auditState.operations, op];
        const next = { ...auditState, operations: nextOps };
        setAuditState(next);
        triggerAuditAutosave(next, activities, auditors, auditees, false);
    };

    const handleAddActivity = () => {
        const trimmed = newActivityInput.trim();
        if (!trimmed) return;
        if (activities.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
            setNewActivityInput('');
            return;
        }
        const next = [...activities, trimmed];
        setActivities(next);
        setNewActivityInput('');
        triggerAuditAutosave(auditState, next, auditors, auditees, false);
    };

    const handleRemoveActivity = (index: number) => {
        const next = activities.filter((_, i) => i !== index);
        setActivities(next);
        triggerAuditAutosave(auditState, next, auditors, auditees, false);
    };

    const handleAddAuditor = () => {
        const next: AuditPersonRow[] = [
            ...auditors,
            {
                name: '',
                rank: 'Auditor',
                role: auditors.length === 0 ? 'Lead auditor' : 'Auditor',
                sort_order: auditors.length + 1,
            },
        ];
        setAuditors(next);
        triggerAuditAutosave(auditState, activities, next, auditees, false);
    };

    const handleUpdateAuditor = (index: number, field: keyof AuditPersonRow | 'is_lead', val: any) => {
        const next = auditors.map((auditor, i) => {
            if (i !== index) {
                // If setting this auditor as lead, unset others
                if (field === 'is_lead' && val === true) {
                    return { ...auditor, role: 'Auditor' };
                }
                return auditor;
            }
            if (field === 'is_lead') {
                return { ...auditor, role: val ? 'Lead auditor' : 'Auditor' };
            }
            return { ...auditor, [field]: val };
        });
        setAuditors(next);

        // Keep lead_auditor in auditState in sync if lead auditor name changes
        let nextAudit = auditState;
        const current = next[index];
        const isLead = current.role === 'Lead auditor';
        if (field === 'is_lead' && val === true) {
            nextAudit = { ...auditState, lead_auditor: current.name };
            setAuditState(nextAudit);
        } else if (field === 'name' && isLead) {
            nextAudit = { ...auditState, lead_auditor: val };
            setAuditState(nextAudit);
        }

        triggerAuditAutosave(nextAudit, activities, next, auditees, true);
    };

    const handleRemoveAuditor = (index: number) => {
        const next = auditors.filter((_, i) => i !== index);
        setAuditors(next);
        triggerAuditAutosave(auditState, activities, next, auditees, false);
    };

    const handleAddAuditee = () => {
        const next: AuditPersonRow[] = [
            ...auditees,
            {
                name: '',
                rank: 'Officer',
                role: 'Auditee',
                sort_order: auditees.length + 1,
            },
        ];
        setAuditees(next);
        triggerAuditAutosave(auditState, activities, auditors, next, false);
    };

    const handleUpdateAuditee = (index: number, field: keyof AuditPersonRow, val: any) => {
        const next = auditees.map((auditee, i) => (i === index ? { ...auditee, [field]: val } : auditee));
        setAuditees(next);
        triggerAuditAutosave(auditState, activities, auditors, next, true);
    };

    const handleRemoveAuditee = (index: number) => {
        const next = auditees.filter((_, i) => i !== index);
        setAuditees(next);
        triggerAuditAutosave(auditState, activities, auditors, next, false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="border-b pb-4 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-mono">
                            Chapter 1
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-mono">
                            {report.form.code}
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {isB008 ? 'Internal Audit Set-up & Particulars' : 'General Information & Particulars'}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isB008
                            ? 'Vessel particulars, audit scope, dates, auditors, auditees, and operations.'
                            : 'Vessel particulars, senior officers, PSC records, dry dock dates, and operational status.'}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {saveStatus === 'saving' && (
                        <span className="text-xs text-amber-500 flex items-center gap-1.5 font-medium">
                            <Loader2 className="size-3.5 animate-spin" /> Saving...
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                            <Check className="size-3.5" /> All saved
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                            <AlertCircle className="size-3.5" /> Save failed
                        </span>
                    )}
                </div>
            </div>

            {/* 1. Vessel Particulars Overview Card (Shared by D-062 and B-008) */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Ship className="size-4 text-primary" />
                        <span>Vessel Particulars</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Base vessel data snapshot taken during report creation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Ship Name</span>
                            <span className="font-semibold text-foreground text-sm">{report.vessel_name}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">IMO Number</span>
                            <span className="font-medium text-foreground">{report.vessel_imo || '—'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Vessel Type</span>
                            <span className="font-medium text-foreground">{report.vessel_type?.name || '—'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Flag State</span>
                            <span className="font-medium text-foreground">{report.vessel_flag || '—'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Gross Tonnage (GT)</span>
                            <span className="font-medium text-foreground">{report.vessel_gt || '—'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Year Built</span>
                            <span className="font-medium text-foreground">{report.vessel_built || '—'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Ice Class Notation</span>
                            <Badge variant={report.vessel_ice_class ? 'default' : 'outline'} className="text-[10px] mt-0.5">
                                {report.vessel_ice_class ? 'Yes (Ice Class)' : 'No'}
                            </Badge>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Reference No.</span>
                            <span className="font-mono text-foreground font-semibold">{report.reference_number}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ============================================================== */}
            {/* B-008 INTERNAL AUDIT SET-UP (Task 7.1, AUD-2, AUD-3)           */}
            {/* ============================================================== */}
            {isB008 ? (
                <>
                    {/* 2. Audit Details & Schedule */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Calendar className="size-4 text-primary" />
                                <span>Audit Scope, Type & Dates</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Specify audit classification, execution dates, lead auditor, and port location.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Audit Type Selector */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Audit Type</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {AUDIT_TYPES.map((type) => {
                                        const isSelected = auditState.audit_type === type.value;
                                        return (
                                            <button
                                                key={type.value}
                                                type="button"
                                                disabled={!isEditable}
                                                onClick={() => updateAuditField('audit_type', type.value, false)}
                                                className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                                    isSelected
                                                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                                                        : 'border-border hover:bg-muted/60 text-muted-foreground'
                                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                                            >
                                                <span
                                                    className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                        isSelected
                                                            ? 'bg-primary border-primary text-primary-foreground'
                                                            : 'border-muted-foreground/50'
                                                    }`}
                                                >
                                                    {isSelected && <Check className="size-2.5" />}
                                                </span>
                                                <span className="truncate">{type.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {auditState.audit_type === 'D' && (
                                    <div className="pt-2">
                                        <Label htmlFor="audit_type_other" className="text-xs text-muted-foreground">
                                            Specify Other Audit Type *
                                        </Label>
                                        <Input
                                            id="audit_type_other"
                                            value={auditState.audit_type_other}
                                            disabled={!isEditable}
                                            placeholder="e.g. Navigation Special Audit"
                                            onChange={(e) => updateAuditField('audit_type_other', e.target.value)}
                                            className="h-8 text-xs mt-1"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Audit Dates & Location */}
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-1">
                                <div className="space-y-1">
                                    <Label htmlFor="audit_start_date" className="text-xs">
                                        Audit Start Date *
                                    </Label>
                                    <Input
                                        id="audit_start_date"
                                        type="date"
                                        value={auditState.start_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateAuditField('start_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="audit_end_date" className="text-xs">
                                        Audit End Date *
                                    </Label>
                                    <Input
                                        id="audit_end_date"
                                        type="date"
                                        value={auditState.end_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateAuditField('end_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="audit_port" className="text-xs">
                                        Audit Port / Location
                                    </Label>
                                    <Input
                                        id="audit_port"
                                        value={auditState.port}
                                        disabled={!isEditable}
                                        placeholder="e.g. Singapore, At Sea"
                                        onChange={(e) => updateAuditField('port', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="audit_lead_auditor" className="text-xs">
                                        Lead Auditor
                                    </Label>
                                    <Input
                                        id="audit_lead_auditor"
                                        value={auditState.lead_auditor}
                                        disabled={!isEditable}
                                        placeholder="e.g. Capt. Rendy"
                                        onChange={(e) => updateAuditField('lead_auditor', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            {/* Vessel Leadership */}
                            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                                <div className="space-y-1">
                                    <Label htmlFor="audit_master" className="text-xs">
                                        Master (Vessel Command)
                                    </Label>
                                    <Input
                                        id="audit_master"
                                        value={auditState.master_name}
                                        disabled={!isEditable}
                                        placeholder="Capt. Name"
                                        onChange={(e) => updateAuditField('master_name', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="audit_ce" className="text-xs">
                                        Chief Engineer
                                    </Label>
                                    <Input
                                        id="audit_ce"
                                        value={auditState.chief_engineer_name}
                                        disabled={!isEditable}
                                        placeholder="C/E Name"
                                        onChange={(e) => updateAuditField('chief_engineer_name', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Audited Activities */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Briefcase className="size-4 text-primary" />
                                <span>Audited Activities & Scope</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Standard activities include Bridge, Deck, and Engine. Add any additional operational areas audited.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {activities.map((act, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border"
                                    >
                                        <span>{act}</span>
                                        {isEditable && activities.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveActivity(idx)}
                                                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                                title="Remove activity"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>

                            {isEditable && (
                                <div className="flex items-center gap-2 pt-2 max-w-md">
                                    <Input
                                        value={newActivityInput}
                                        placeholder="e.g. Cargo Operations, Galley, Mooring"
                                        onChange={(e) => setNewActivityInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddActivity();
                                            }
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddActivity}
                                        className="h-8 text-xs shrink-0 flex items-center gap-1"
                                    >
                                        <Plus className="size-3.5" />
                                        <span>Add Activity</span>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 4. Audit Team & Auditees (AUD-3) */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Auditors Card */}
                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <UserCheck className="size-4 text-primary" />
                                        <span>Audit Team (Auditors)</span>
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Auditors participating in this internal audit.
                                    </CardDescription>
                                </div>
                                {isEditable && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddAuditor}
                                        className="h-7 text-xs flex items-center gap-1"
                                    >
                                        <Plus className="size-3" />
                                        <span>Add Auditor</span>
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {auditors.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-2 text-center">
                                        No auditors listed. Click "+ Add Auditor" to add audit team members.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {auditors.map((auditor, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2.5 rounded-lg border bg-muted/10 space-y-2"
                                            >
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Name</Label>
                                                        <Input
                                                            value={auditor.name}
                                                            disabled={!isEditable}
                                                            placeholder="Auditor Name"
                                                            onChange={(e) =>
                                                                handleUpdateAuditor(idx, 'name', e.target.value)
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Rank / Position</Label>
                                                        <Input
                                                            value={auditor.rank}
                                                            disabled={!isEditable}
                                                            placeholder="e.g. Lead Auditor, Superintendent"
                                                            onChange={(e) =>
                                                                handleUpdateAuditor(idx, 'rank', e.target.value)
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                                        <input
                                                            type="checkbox"
                                                            checked={auditor.role === 'Lead auditor'}
                                                            disabled={!isEditable}
                                                            onChange={(e) =>
                                                                handleUpdateAuditor(idx, 'is_lead', e.target.checked)
                                                            }
                                                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                        />
                                                        <span className="text-[11px] font-medium text-foreground">
                                                            Lead Auditor
                                                        </span>
                                                    </label>

                                                    {isEditable && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveAuditor(idx)}
                                                            className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                                                            title="Delete auditor"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Auditees Card */}
                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Users className="size-4 text-primary" />
                                        <span>Auditees (Vessel Crew)</span>
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Crew members interviewed during the audit.
                                    </CardDescription>
                                </div>
                                {isEditable && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddAuditee}
                                        className="h-7 text-xs flex items-center gap-1"
                                    >
                                        <Plus className="size-3" />
                                        <span>Add Auditee</span>
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {auditees.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-2 text-center">
                                        No auditees listed. Click "+ Add Auditee" to record interviewed crew.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {auditees.map((auditee, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2.5 rounded-lg border bg-muted/10 flex items-center gap-2"
                                            >
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Name</Label>
                                                        <Input
                                                            value={auditee.name}
                                                            disabled={!isEditable}
                                                            placeholder="Crew Name"
                                                            onChange={(e) =>
                                                                handleUpdateAuditee(idx, 'name', e.target.value)
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Rank</Label>
                                                        <Input
                                                            value={auditee.rank}
                                                            disabled={!isEditable}
                                                            placeholder="e.g. Master, Chief Officer, Bosun"
                                                            onChange={(e) =>
                                                                handleUpdateAuditee(idx, 'rank', e.target.value)
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                </div>

                                                {isEditable && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveAuditee(idx)}
                                                        className="h-6 px-1.5 text-muted-foreground hover:text-destructive shrink-0 mt-3"
                                                        title="Delete auditee"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* 5. Operation at Time of Audit */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                <span>Operation at Time of Audit</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Select all operational activities occurring during the audit (Form B-008 Chapter 1).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {AUDIT_OPERATIONS.map((op) => {
                                    const isSelected = auditState.operations.includes(op);
                                    return (
                                        <button
                                            key={op}
                                            type="button"
                                            disabled={!isEditable}
                                            onClick={() => toggleAuditOperation(op)}
                                            className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                                                    : 'border-border hover:bg-muted/60 text-muted-foreground'
                                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                                        >
                                            <span
                                                className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-primary border-primary text-primary-foreground'
                                                        : 'border-muted-foreground/50'
                                                }`}
                                            >
                                                {isSelected && <Check className="size-2.5" />}
                                            </span>
                                            <span className="truncate">{op}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                /* ============================================================== */
                /* D-062 INSPECTION GENERAL INFORMATION PARTICULARS               */
                /* ============================================================== */
                <>
                    {/* 2. Inspection & Senior Officers Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                <span>Inspection & Senior Officer Particulars</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Editable text and date fields for attendance and crew leadership.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-1">
                                    <Label htmlFor="gi_report_date" className="text-xs">
                                        Date of Inspection *
                                    </Label>
                                    <Input
                                        id="gi_report_date"
                                        type="date"
                                        value={info.report_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateInspectionField('report_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_port" className="text-xs">
                                        Port / Location
                                    </Label>
                                    <Input
                                        id="gi_port"
                                        value={info.port}
                                        disabled={!isEditable}
                                        placeholder="e.g. Bojonegara, Merak"
                                        onChange={(e) => updateInspectionField('port', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_inspected_by" className="text-xs">
                                        Inspected By
                                    </Label>
                                    <Input
                                        id="gi_inspected_by"
                                        value={info.inspected_by}
                                        disabled={!isEditable}
                                        placeholder="e.g. Rendy"
                                        onChange={(e) => updateInspectionField('inspected_by', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 pt-2">
                                <div className="space-y-1">
                                    <Label htmlFor="gi_master" className="text-xs">
                                        Master
                                    </Label>
                                    <Input
                                        id="gi_master"
                                        value={info.master_name}
                                        disabled={!isEditable}
                                        placeholder="Capt. Name"
                                        onChange={(e) => updateInspectionField('master_name', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_ce" className="text-xs">
                                        Chief Engineer
                                    </Label>
                                    <Input
                                        id="gi_ce"
                                        value={info.chief_engineer_name}
                                        disabled={!isEditable}
                                        placeholder="C/E Name"
                                        onChange={(e) => updateInspectionField('chief_engineer_name', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_co" className="text-xs">
                                        Chief Officer
                                    </Label>
                                    <Input
                                        id="gi_co"
                                        value={info.chief_officer_name}
                                        disabled={!isEditable}
                                        placeholder="C/O Name"
                                        onChange={(e) => updateInspectionField('chief_officer_name', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            {/* Sailing with vessel toggle */}
                            <div className="rounded-lg border p-3 bg-muted/20 space-y-3 mt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="gi_sailing_toggle"
                                        type="checkbox"
                                        checked={info.sailing_with_vessel}
                                        disabled={!isEditable}
                                        onChange={(e) =>
                                            updateInspectionField('sailing_with_vessel', e.target.checked, false)
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor="gi_sailing_toggle" className="cursor-pointer text-xs font-semibold">
                                        Sailing with Vessel during inspection
                                    </Label>
                                </div>

                                {info.sailing_with_vessel && (
                                    <div className="grid gap-4 md:grid-cols-2 pt-1 pl-6">
                                        <div className="space-y-1">
                                            <Label htmlFor="gi_sailing_from" className="text-xs">
                                                Sailing From
                                            </Label>
                                            <Input
                                                id="gi_sailing_from"
                                                value={info.sailing_from}
                                                disabled={!isEditable}
                                                placeholder="e.g. Merak"
                                                onChange={(e) => updateInspectionField('sailing_from', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="gi_sailing_to" className="text-xs">
                                                Sailing To
                                            </Label>
                                            <Input
                                                id="gi_sailing_to"
                                                value={info.sailing_to}
                                                disabled={!isEditable}
                                                placeholder="e.g. Batam"
                                                onChange={(e) => updateInspectionField('sailing_to', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Port State Control (PSC) & Dry Dock Particulars */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <FileCheck className="size-4 text-primary" />
                                <span>Port State Control (PSC) & Dry Dock Dates</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Last PSC inspection results and scheduled drydocking.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="gi_psc_port" className="text-xs">
                                        Port of Last PSC Inspection
                                    </Label>
                                    <Input
                                        id="gi_psc_port"
                                        value={info.psc_last_port}
                                        disabled={!isEditable}
                                        placeholder="e.g. Tanjung Priok"
                                        onChange={(e) => updateInspectionField('psc_last_port', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_psc_date" className="text-xs">
                                        Date of Last PSC Inspection
                                    </Label>
                                    <Input
                                        id="gi_psc_date"
                                        type="date"
                                        value={info.psc_last_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateInspectionField('psc_last_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="gi_psc_detained"
                                    type="checkbox"
                                    checked={info.psc_detained_or_deficiencies}
                                    disabled={!isEditable}
                                    onChange={(e) =>
                                        updateInspectionField('psc_detained_or_deficiencies', e.target.checked, false)
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label
                                    htmlFor="gi_psc_detained"
                                    className="cursor-pointer text-xs font-medium text-muted-foreground"
                                >
                                    Vessel was detained or deficiencies were identified during last PSC (verify close out)
                                </Label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 pt-3 border-t">
                                <div className="space-y-1">
                                    <Label htmlFor="gi_dd_last" className="text-xs">
                                        Date of Last Dry Dock
                                    </Label>
                                    <Input
                                        id="gi_dd_last"
                                        type="date"
                                        value={info.drydock_last_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateInspectionField('drydock_last_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="gi_dd_next" className="text-xs">
                                        Next Dry Dock Date
                                    </Label>
                                    <Input
                                        id="gi_dd_next"
                                        type="date"
                                        value={info.drydock_next_date}
                                        disabled={!isEditable}
                                        onChange={(e) => updateInspectionField('drydock_next_date', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 4. Operations at the time of inspection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                <span>Operations at the Time of Inspection</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Select all operational activities occurring during attendance (Form D-062 Chapter 1).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                                {INSPECTION_OPERATIONS.map((op) => {
                                    const isSelected = info.operations.includes(op);
                                    return (
                                        <button
                                            key={op}
                                            type="button"
                                            disabled={!isEditable}
                                            onClick={() => toggleInspectionOperation(op)}
                                            className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                                                    : 'border-border hover:bg-muted/60 text-muted-foreground'
                                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                                        >
                                            <span
                                                className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-primary border-primary text-primary-foreground'
                                                        : 'border-muted-foreground/50'
                                                }`}
                                            >
                                                {isSelected && <Check className="size-2.5" />}
                                            </span>
                                            <span className="truncate">{op}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 5. Other Attendance-Related Activities (if available in Chapter 1) */}
                    {attendanceSubgroup &&
                        attendanceSubgroup.questions &&
                        attendanceSubgroup.questions.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Info className="size-4 text-primary" />
                                            <span>{attendanceSubgroup.title}</span>
                                        </CardTitle>
                                        {!attendanceSubgroup.is_applicable && (
                                            <Badge variant="outline" className="text-[10px] text-amber-600">
                                                Inapplicable
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="text-xs">
                                        Verify safety meetings, drills, training, and audits conducted during attendance.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {attendanceSubgroup.questions.filter(filterQuestion).map((q) => (
                                        <QuestionAnswerCard
                                            key={q.id}
                                            reportId={report.id}
                                            question={q}
                                            currentAnswer={answers[q.id]}
                                            isB008={isB008}
                                            answerChoices={answerChoices}
                                            isExpandedGuidance={Boolean(expandedGuidance[q.id])}
                                            saveStatus={saveStatuses[q.id]}
                                            isEditable={isEditable}
                                            onToggleGuidance={() => onToggleGuidance(q.id)}
                                            onSelectAnswer={(val) => onSelectAnswer(q.id, val)}
                                            onSaveExtraValue={(val) => onSaveExtraValue(q.id, val)}
                                            conflict={conflicts[q.id]}
                                            onAcceptServerAnswer={(srv) => onAcceptServerAnswer(q.id, srv)}
                                            onOverwriteAnswer={(srvVer) => onOverwriteAnswer(q.id, srvVer)}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                </>
            )}

            {/* Next Chapter Navigation */}
            {nextChapter && (
                <div className="flex justify-end pt-1 pb-4">
                    <Button
                        type="button"
                        onClick={() => onChapterSwitch(nextChapter.id)}
                        className="flex items-center gap-2 font-medium"
                    >
                        <span>
                            Next:{' '}
                            {nextChapter.chapter_no
                                ? `Chapter ${nextChapter.chapter_no} - ${nextChapter.title}`
                                : nextChapter.title}
                        </span>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
