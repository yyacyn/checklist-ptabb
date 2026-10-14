import React, { useState } from 'react';
import {
    AlertCircle,
    Briefcase,
    Calendar,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Compass,
    History,
    Plus,
    ShieldAlert,
    Ship,
    Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FieldsBlock, type FieldConfig } from '@/components/reports/fields-block';
import { RowsBlock, type ColumnConfig } from '@/components/reports/rows-block';
import { csrfHeaders } from '@/lib/autosave-queue';
import { formatDate } from '@/lib/question-utils';
import type { ReportData } from '@/types';

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

export const AUDIT_ROLE_OPTIONS = [
    { value: 'Lead auditor', label: 'Lead Auditor' },
    { value: 'Auditor', label: 'Auditor (Audit Team)' },
    { value: 'Auditee', label: 'Auditee (Vessel Crew)' },
];

export interface AuditReportSectionProps {
    report: ReportData;
    isEditable: boolean;
    onChapterSwitch?: (chapterId: number) => void;
}

export function AuditReportSection({
    report,
    isEditable,
    onChapterSwitch,
}: AuditReportSectionProps) {
    // -------------------------------------------------------------
    // 1. Audit Details & Activities State
    // -------------------------------------------------------------
    const [activities, setActivities] = useState<string[]>(
        report.summary_data?.activities_audited && report.summary_data.activities_audited.length > 0
            ? report.summary_data.activities_audited
            : ['Bridge', 'Deck', 'Engine']
    );
    const [newActivityInput, setNewActivityInput] = useState('');
    const [operations, setOperations] = useState<string[]>(report.operations || []);

    const saveFieldSync = async (fieldPayload: Record<string, any>) => {
        if (!isEditable) return;
        try {
            await fetch(`/reports/${report.id}/fields`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ fields: fieldPayload }),
            });
        } catch (err) {
            console.error('Failed to save field sync:', err);
        }
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
        saveFieldSync({ activities_audited: next });
    };

    const handleRemoveActivity = (index: number) => {
        const next = activities.filter((_, i) => i !== index);
        setActivities(next);
        saveFieldSync({ activities_audited: next });
    };

    const toggleOperation = (op: string) => {
        const next = operations.includes(op)
            ? operations.filter((o) => o !== op)
            : [...operations, op];
        setOperations(next);
        saveFieldSync({ operations: next });
    };

    const auditFieldConfigs: FieldConfig[] = [
        {
            name: 'audit_type',
            label: 'Audit Type',
            type: 'select',
            options: AUDIT_TYPES,
            description: 'Classification of this audit per SMS requirements.',
            required: true,
            colSpan: 1,
        },
        {
            name: 'audit_type_other',
            label: 'Other Audit Type Specification',
            type: 'text',
            placeholder: 'Specify if audit type is D',
            description: 'Required only when audit type is "Other".',
            colSpan: 1,
        },
        {
            name: 'report_date',
            label: 'Audit Start Date',
            type: 'date',
            required: true,
            colSpan: 1,
        },
        {
            name: 'audit_end_date',
            label: 'Audit End Date',
            type: 'date',
            required: true,
            colSpan: 1,
        },
        {
            name: 'port',
            label: 'Port / Location',
            type: 'text',
            placeholder: 'e.g. Bojonegara, At Sea, Singapore',
            colSpan: 1,
        },
        {
            name: 'lead_auditor',
            label: 'Lead Auditor Name',
            type: 'text',
            placeholder: 'e.g. Capt. Senior Auditor',
            description: 'Primary lead auditor coordinating the audit.',
            colSpan: 1,
        },
        {
            name: 'master_name',
            label: 'Master (Captain)',
            type: 'text',
            placeholder: 'Capt. Name',
            colSpan: 1,
        },
        {
            name: 'chief_engineer_name',
            label: 'Chief Engineer',
            type: 'text',
            placeholder: 'C/E Name',
            colSpan: 1,
        },
    ];

    const initialFieldValues = {
        audit_type: report.summary_data?.audit_type || 'A',
        audit_type_other: report.summary_data?.audit_type_other || '',
        report_date: report.report_date ? report.report_date.split('T')[0] : '',
        audit_end_date:
            report.summary_data?.audit_end_date ||
            (report.report_date ? report.report_date.split('T')[0] : ''),
        port: report.port || '',
        lead_auditor: report.summary_data?.lead_auditor || report.inspected_by || '',
        master_name: report.master_name || '',
        chief_engineer_name: report.chief_engineer_name || '',
    };

    // -------------------------------------------------------------
    // 2. People & Crew State
    // -------------------------------------------------------------
    const auditPeopleDataset = report.datasets?.find((d) => d.dataset_key === 'audit_people');
    const initialPeopleRows =
        auditPeopleDataset?.rows && auditPeopleDataset.rows.length > 0
            ? auditPeopleDataset.rows
            : [
                  {
                      name: report.inspected_by || '',
                      rank: 'Lead Auditor',
                      role: 'Lead auditor',
                      sort_order: 1,
                  },
                  {
                      name: report.master_name || '',
                      rank: 'Master',
                      role: 'Auditee',
                      sort_order: 2,
                  },
                  {
                      name: report.chief_engineer_name || '',
                      rank: 'Chief Engineer',
                      role: 'Auditee',
                      sort_order: 3,
                  },
              ];

    const [peopleRows, setPeopleRows] = useState<Array<Record<string, any>>>(initialPeopleRows);

    const hasLeadAuditor = peopleRows.some(
        (r) =>
            (r.role || '').toLowerCase() === 'lead auditor' ||
            (r.role || '').toLowerCase() === 'lead_auditor'
    );

    const syncLeadAuditorField = async (currentRows: Array<Record<string, any>>) => {
        const lead = currentRows.find(
            (r) =>
                (r.role || '').toLowerCase() === 'lead auditor' ||
                (r.role || '').toLowerCase() === 'lead_auditor'
        );
        if (lead && lead.name && isEditable) {
            try {
                await fetch(`/reports/${report.id}/fields`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...csrfHeaders(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        fields: {
                            lead_auditor: lead.name,
                        },
                    }),
                });
            } catch (err) {
                console.error('Failed to sync lead auditor name:', err);
            }
        }
    };

    const handlePeopleRowsChange = (newRows: Array<Record<string, any>>) => {
        setPeopleRows(newRows);
        syncLeadAuditorField(newRows);
    };

    const peopleColumns: ColumnConfig[] = [
        {
            key: 'name',
            label: 'Full Name',
            type: 'text',
            placeholder: 'e.g. Capt. John Smith',
            width: 'w-1/3',
        },
        {
            key: 'rank',
            label: 'Rank / Position',
            type: 'text',
            placeholder: 'e.g. Lead Auditor, Master, Chief Officer',
            width: 'w-1/3',
        },
        {
            key: 'role',
            label: 'Audit Role',
            type: 'select',
            options: AUDIT_ROLE_OPTIONS,
            defaultValue: 'Auditee',
            width: 'w-1/3',
        },
    ];

    // -------------------------------------------------------------
    // 3. Previous Audit Follow-up State
    // -------------------------------------------------------------
    const summary = report.summary_data || {};
    const [kpiValues, setKpiValues] = useState({
        previous_audit_date: summary.previous_audit_date || '',
        previous_ncr_count: summary.previous_ncr_count ?? 0,
        previous_observation_count: summary.previous_observation_count ?? 0,
    });

    const previousAuditFields: FieldConfig[] = [
        {
            name: 'previous_audit_date',
            label: 'Date of Previous Audit',
            type: 'date',
            description: 'Date when the last internal or external audit was executed on this vessel.',
            colSpan: 1,
        },
        {
            name: 'previous_ncr_count',
            label: 'Previous Non-Conformities (NCRs)',
            type: 'number',
            min: 0,
            step: 1,
            placeholder: '0',
            description: 'Total number of Non-Conformities (NCs) identified during the previous audit.',
            colSpan: 1,
        },
        {
            name: 'previous_observation_count',
            label: 'Previous Observations',
            type: 'number',
            min: 0,
            step: 1,
            placeholder: '0',
            description: 'Total number of observations recorded during the previous audit.',
            colSpan: 1,
        },
        {
            name: 'closeout_notes',
            label: 'Close-out Verification Notes',
            type: 'textarea',
            rows: 5,
            colSpan: 12,
            placeholder:
                'Detail the current status of corrective action plans (CAP), closed non-conformities, and any outstanding items verified during this audit...',
            description:
                'Auditor verification regarding the rectification and closeout of findings from the prior audit.',
        },
    ];

    const initialPreviousValues = {
        previous_audit_date: summary.previous_audit_date || '',
        previous_ncr_count: summary.previous_ncr_count ?? 0,
        previous_observation_count: summary.previous_observation_count ?? 0,
        closeout_notes: summary.closeout_notes || '',
    };

    const handlePreviousValuesChange = (newValues: Record<string, any>) => {
        setKpiValues({
            previous_audit_date: newValues.previous_audit_date || '',
            previous_ncr_count: newValues.previous_ncr_count ?? 0,
            previous_observation_count: newValues.previous_observation_count ?? 0,
        });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header Title */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Vessel Internal Audit Report
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Vessel particulars, audit scope, dates, operations, auditor/auditee register, and previous audit follow-up (Form B-008).
                </p>
            </div>

            {/* 1. Vessel's Particulars */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Ship className="size-4 text-primary" />
                        <span>Vessel&apos;s Particulars</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Base vessel data snapshot taken during report creation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
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
                            <span className="text-muted-foreground block text-[11px]">Ice Class</span>
                            <Badge variant={report.vessel_ice_class ? 'default' : 'outline'} className="text-[10px] mt-0.5">
                                {report.vessel_ice_class ? 'Yes (Ice Class)' : 'No'}
                            </Badge>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Audit Reference No.</span>
                            <span className="font-mono text-foreground font-semibold">{report.reference_number}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Operation at Time of Audit */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Compass className="size-4 text-primary" />
                        <span>Operation at Time of Audit</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Select all shipboard operations in progress during the audit execution.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {AUDIT_OPERATIONS.map((op) => {
                            const isSelected = operations.includes(op);
                            return (
                                <button
                                    key={op}
                                    type="button"
                                    disabled={!isEditable}
                                    onClick={() => toggleOperation(op)}
                                    className={`p-2 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
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

            {/* 3. Audit Details & Schedule */}
            <FieldsBlock
                reportId={report.id}
                title="Audit Details & Schedule"
                description="Specify audit classification, execution dates, lead auditor, Master, and Chief Engineer."
                icon={Calendar}
                fields={auditFieldConfigs}
                values={initialFieldValues}
                isEditable={isEditable}
                columns={2}
            />

            {/* 4. Activities Audited */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Briefcase className="size-4 text-primary" />
                        <span>Activities Audited</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Standard operational areas audited. Add or remove operational areas covered during this audit.
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
                                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                                        title="Remove activity"
                                    >
                                        &times;
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>

                    {isEditable && (
                        <div className="flex items-center gap-2 pt-1 max-w-md">
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

            {/* 5. Audit Team & Vessel Crew Register (People) */}
            <div className="space-y-3">
                {hasLeadAuditor ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <span>
                                <strong>Audit Team Requirement Met:</strong> Lead auditor is specified.
                            </span>
                        </div>
                        <span className="text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-200">
                            Lead Auditor Assigned
                        </span>
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4 text-amber-600 shrink-0" />
                            <span>
                                <strong>Action Required:</strong> At least one person must have the role &quot;Lead Auditor&quot; before this audit can be submitted.
                            </span>
                        </div>
                        <span className="text-[11px] font-medium bg-amber-200/80 dark:bg-amber-800 px-2 py-0.5 rounded text-amber-900 dark:text-amber-100">
                            Required
                        </span>
                    </div>
                )}

                <RowsBlock
                    reportId={report.id}
                    datasetKey="audit_people"
                    columns={peopleColumns}
                    initialRows={peopleRows}
                    initialRowVersion={auditPeopleDataset?.row_version || 1}
                    title="Audit Team & Vessel Crew Register"
                    description="List all auditors participating in the audit and vessel officers/crew members interviewed."
                    icon={Users}
                    isEditable={isEditable}
                    allowReorder={true}
                    addButtonLabel="Add Person"
                    emptyMessage="No persons listed in the audit register. Click Add Person to register audit team members and auditees."
                    minRows={1}
                    onChange={handlePeopleRowsChange}
                />
            </div>

            {/* 6. Follow-up from Previous Audit */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card className="bg-card">
                        <CardContent className="p-3.5 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Calendar className="size-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[11px] text-muted-foreground block">
                                    Previous Audit Date
                                </span>
                                <span className="text-sm font-semibold text-foreground truncate block">
                                    {kpiValues.previous_audit_date
                                        ? formatDate(kpiValues.previous_audit_date)
                                        : 'Not Specified'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card">
                        <CardContent className="p-3.5 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                                <AlertCircle className="size-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[11px] text-muted-foreground block">
                                    Prior Non-Conformities (NCs)
                                </span>
                                <span className="text-sm font-semibold text-foreground truncate block">
                                    {kpiValues.previous_ncr_count} finding{kpiValues.previous_ncr_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card">
                        <CardContent className="p-3.5 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[11px] text-muted-foreground block">
                                    Prior Observations
                                </span>
                                <span className="text-sm font-semibold text-foreground truncate block">
                                    {kpiValues.previous_observation_count} observation{kpiValues.previous_observation_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <FieldsBlock
                    reportId={report.id}
                    title="Follow-up from Previous Audit"
                    description="Record findings from the prior vessel audit and document status of corrective action close-outs."
                    icon={History}
                    fields={previousAuditFields}
                    values={initialPreviousValues}
                    isEditable={isEditable}
                    columns={3}
                    onValuesChange={handlePreviousValuesChange}
                />
            </div>

            {/* 7. Current Audit Results (Form B-008, AUD-9) */}
            {(() => {
                const currentFindings = report.findings || [];
                const currentNcrCount = currentFindings.filter((f) => f.finding_kind === 'non_conformity').length;
                const currentObsCount = currentFindings.filter((f) => f.finding_kind === 'observation').length;

                return (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                    <ShieldAlert className="size-4 text-primary" />
                                    <span>Audit Results (Current Audit)</span>
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    Summary of non-conformities and observations raised during this audit.
                                </p>
                            </div>
                            {onChapterSwitch && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onChapterSwitch(-999)}
                                    className="text-xs h-8 flex items-center gap-1.5"
                                >
                                    <span>Open Findings Register</span>
                                    <ChevronRight className="size-3.5" />
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-card border-2 border-rose-200 dark:border-rose-950/60 shadow-xs">
                                <CardContent className="p-3.5 flex items-center gap-3">
                                    <div className="size-9 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                                        <AlertCircle className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                            Number of Non-Conformities (NCs)
                                        </span>
                                        <span className="text-2xl font-bold text-foreground">
                                            {currentNcrCount}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-2 border-amber-200 dark:border-amber-950/60 shadow-xs">
                                <CardContent className="p-3.5 flex items-center gap-3">
                                    <div className="size-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                            Number of Observations
                                        </span>
                                        <span className="text-2xl font-bold text-foreground">
                                            {currentObsCount}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                );
            })()}

            {/* Bottom Navigation */}
            {onChapterSwitch && (
                <div className="flex justify-between items-center pt-4 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onChapterSwitch(-999)}
                        className="flex items-center gap-1.5"
                    >
                        <ChevronLeft className="size-4" />
                        <span>Back: Summary &amp; Findings</span>
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        onClick={() => onChapterSwitch(-104)}
                        className="flex items-center gap-1.5"
                    >
                        <span>Next: Evaluation &amp; Execution</span>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
