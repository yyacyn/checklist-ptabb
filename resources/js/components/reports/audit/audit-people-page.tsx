import React, { useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    UserCheck,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RowsBlock, type ColumnConfig } from '@/components/reports/rows-block';
import { AuditPageNav } from '@/components/reports/audit/audit-page-nav';
import { csrfHeaders } from '@/lib/autosave-queue';
import type { ReportData } from '@/types';

export const AUDIT_ROLE_OPTIONS = [
    { value: 'Lead auditor', label: 'Lead Auditor' },
    { value: 'Auditor', label: 'Auditor (Audit Team)' },
    { value: 'Auditee', label: 'Auditee (Vessel Crew)' },
];

export interface AuditPeoplePageProps {
    report: ReportData;
    isEditable: boolean;
    onChapterSwitch: (chapterId: number) => void;
}

export function AuditPeoplePage({
    report,
    isEditable,
    onChapterSwitch,
}: AuditPeoplePageProps) {
    const auditPeopleDataset = report.datasets?.find((d) => d.dataset_key === 'audit_people');
    const initialRows = auditPeopleDataset?.rows && auditPeopleDataset.rows.length > 0
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

    const [rows, setRows] = useState<Array<Record<string, any>>>(initialRows);

    const hasLeadAuditor = rows.some(
        (r) => (r.role || '').toLowerCase() === 'lead auditor' || (r.role || '').toLowerCase() === 'lead_auditor'
    );

    const syncLeadAuditorField = async (currentRows: Array<Record<string, any>>) => {
        const lead = currentRows.find(
            (r) => (r.role || '').toLowerCase() === 'lead auditor' || (r.role || '').toLowerCase() === 'lead_auditor'
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

    const handleRowsChange = (newRows: Array<Record<string, any>>) => {
        setRows(newRows);
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

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Navigation Bar */}
            <AuditPageNav activeChapterId={-102} onChapterSwitch={onChapterSwitch} />

            {/* Lead Auditor Status Alert */}
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

            {/* Main Repeating Rows Block for People */}
            <RowsBlock
                reportId={report.id}
                datasetKey="audit_people"
                columns={peopleColumns}
                initialRows={rows}
                initialRowVersion={auditPeopleDataset?.row_version || 1}
                title="Audit Team & Vessel Crew Register"
                description="List all auditors participating in the audit and vessel officers/crew members interviewed."
                icon={Users}
                isEditable={isEditable}
                allowReorder={true}
                addButtonLabel="Add Person"
                emptyMessage="No persons listed in the audit register. Click Add Person to register audit team members and auditees."
                minRows={1}
                onChange={handleRowsChange}
            />

            {/* Bottom Step Navigation */}
            <div className="flex items-center justify-between pt-4 pb-8">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChapterSwitch(-101)}
                    className="flex items-center gap-2"
                >
                    <ChevronLeft className="size-4" />
                    <span>Back: Page 1 — Audit Details</span>
                </Button>

                <Button
                    type="button"
                    onClick={() => onChapterSwitch(-103)}
                    className="flex items-center gap-2"
                >
                    <span>Next: Page 3 — Previous Audit</span>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
