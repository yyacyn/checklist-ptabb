import React, { useState } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileText,
    History,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldsBlock, type FieldConfig } from '@/components/reports/fields-block';
import { AuditPageNav } from '@/components/reports/audit/audit-page-nav';
import { formatDate } from '@/lib/question-utils';
import type { ReportData } from '@/types';

export interface AuditPreviousPageProps {
    report: ReportData;
    isEditable: boolean;
    firstChecklistChapterId?: number;
    onChapterSwitch: (chapterId: number) => void;
}

export function AuditPreviousPage({
    report,
    isEditable,
    firstChecklistChapterId,
    onChapterSwitch,
}: AuditPreviousPageProps) {
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
            placeholder: 'Detail the current status of corrective action plans (CAP), closed non-conformities, and any outstanding items verified during this audit...',
            description: 'Auditor verification regarding the rectification and closeout of findings from the prior audit.',
        },
    ];

    const initialValues = {
        previous_audit_date: summary.previous_audit_date || '',
        previous_ncr_count: summary.previous_ncr_count ?? 0,
        previous_observation_count: summary.previous_observation_count ?? 0,
        closeout_notes: summary.closeout_notes || '',
    };

    const handleValuesChange = (newValues: Record<string, any>) => {
        setKpiValues({
            previous_audit_date: newValues.previous_audit_date || '',
            previous_ncr_count: newValues.previous_ncr_count ?? 0,
            previous_observation_count: newValues.previous_observation_count ?? 0,
        });
    };

    const nextTargetChapterId = firstChecklistChapterId ?? (report.groups[0]?.id ?? 0);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Navigation Bar */}
            <AuditPageNav activeChapterId={-103} onChapterSwitch={onChapterSwitch} />

            {/* Quick Stat Highlights */}
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
                            <ShieldAlert className="size-4" />
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
                            <ShieldCheck className="size-4" />
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

            {/* Previous Audit Fields Block */}
            <FieldsBlock
                reportId={report.id}
                title="Follow-up from Previous Audit"
                description="Record findings from the prior vessel audit and document status of corrective action close-outs."
                icon={History}
                fields={previousAuditFields}
                values={initialValues}
                isEditable={isEditable}
                columns={3}
                onValuesChange={handleValuesChange}
            />

            {/* Bottom Step Navigation */}
            <div className="flex items-center justify-between pt-4 pb-8">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChapterSwitch(-102)}
                    className="flex items-center gap-2"
                >
                    <ChevronLeft className="size-4" />
                    <span>Back: Page 2 — People & Crew</span>
                </Button>

                <Button
                    type="button"
                    onClick={() => onChapterSwitch(nextTargetChapterId)}
                    className="flex items-center gap-2"
                >
                    <span>Next: Checklist Questions</span>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
