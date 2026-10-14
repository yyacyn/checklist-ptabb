import React, { useState } from 'react';
import {
    Briefcase,
    Calendar,
    Check,
    ChevronRight,
    Compass,
    Plus,
    Ship,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldsBlock, type FieldConfig } from '@/components/reports/fields-block';
import { AuditPageNav } from '@/components/reports/audit/audit-page-nav';
import { csrfHeaders } from '@/lib/autosave-queue';
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

export interface AuditDetailsPageProps {
    report: ReportData;
    isEditable: boolean;
    onChapterSwitch: (chapterId: number) => void;
}

export function AuditDetailsPage({
    report,
    isEditable,
    onChapterSwitch,
}: AuditDetailsPageProps) {
    // Activities state
    const [activities, setActivities] = useState<string[]>(
        report.summary_data?.activities_audited && report.summary_data.activities_audited.length > 0
            ? report.summary_data.activities_audited
            : ['Bridge', 'Deck', 'Engine']
    );
    const [newActivityInput, setNewActivityInput] = useState('');

    // Operations state
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
        audit_end_date: report.summary_data?.audit_end_date || (report.report_date ? report.report_date.split('T')[0] : ''),
        port: report.port || '',
        lead_auditor: report.summary_data?.lead_auditor || report.inspected_by || '',
        master_name: report.master_name || '',
        chief_engineer_name: report.chief_engineer_name || '',
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Navigation Bar */}
            <AuditPageNav activeChapterId={-101} onChapterSwitch={onChapterSwitch} />

            {/* Vessel Particulars Header Card */}
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

            {/* Audit Details & Schedule */}
            <FieldsBlock
                reportId={report.id}
                title="Audit Details & Particulars"
                description="Specify audit classification, execution dates, lead auditor, and port location."
                icon={Calendar}
                fields={auditFieldConfigs}
                values={initialFieldValues}
                isEditable={isEditable}
                columns={2}
            />

            {/* Audited Activities & Scope */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Briefcase className="size-4 text-primary" />
                        <span>Audited Activities & Scope</span>
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

            {/* Operations at Time of Audit */}
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

            {/* Bottom Step Navigation */}
            <div className="flex justify-end pt-4 pb-8">
                <Button
                    type="button"
                    onClick={() => onChapterSwitch(-102)}
                    className="flex items-center gap-2"
                >
                    <span>Next: Page 2 — People & Crew</span>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
