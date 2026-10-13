import {
    AlertCircle,
    Check,
    ChevronRight,
    FileCheck,
    Info,
    Loader2,
    Ship,
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

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistChanges = async (nextState: typeof info) => {
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

    const updateField = (field: keyof typeof info, val: any, debounce = true) => {
        const next = { ...info, [field]: val };
        setInfo(next);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!debounce) {
            persistChanges(next);
        } else {
            debounceTimer.current = setTimeout(() => {
                persistChanges(next);
            }, 1200);
        }
    };

    const toggleOperation = (op: string) => {
        const nextOps = info.operations.includes(op)
            ? info.operations.filter((o) => o !== op)
            : [...info.operations, op];
        updateField('operations', nextOps, false);
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
                        General Information & Particulars
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Vessel particulars, senior officers, PSC records, dry dock dates, and operational status (Form D-062).
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

            {/* 1. Vessel Particulars Overview Card */}
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
                            <Label htmlFor="gi_report_date" className="text-xs">Date of Inspection *</Label>
                            <Input
                                id="gi_report_date"
                                type="date"
                                value={info.report_date}
                                disabled={!isEditable}
                                onChange={(e) => updateField('report_date', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_port" className="text-xs">Port / Location</Label>
                            <Input
                                id="gi_port"
                                value={info.port}
                                disabled={!isEditable}
                                placeholder="e.g. Bojonegara, Merak"
                                onChange={(e) => updateField('port', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_inspected_by" className="text-xs">Inspected By</Label>
                            <Input
                                id="gi_inspected_by"
                                value={info.inspected_by}
                                disabled={!isEditable}
                                placeholder="e.g. Rendy"
                                onChange={(e) => updateField('inspected_by', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 pt-2">
                        <div className="space-y-1">
                            <Label htmlFor="gi_master" className="text-xs">Master</Label>
                            <Input
                                id="gi_master"
                                value={info.master_name}
                                disabled={!isEditable}
                                placeholder="Capt. Name"
                                onChange={(e) => updateField('master_name', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_ce" className="text-xs">Chief Engineer</Label>
                            <Input
                                id="gi_ce"
                                value={info.chief_engineer_name}
                                disabled={!isEditable}
                                placeholder="C/E Name"
                                onChange={(e) => updateField('chief_engineer_name', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_co" className="text-xs">Chief Officer</Label>
                            <Input
                                id="gi_co"
                                value={info.chief_officer_name}
                                disabled={!isEditable}
                                placeholder="C/O Name"
                                onChange={(e) => updateField('chief_officer_name', e.target.value)}
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
                                onChange={(e) => updateField('sailing_with_vessel', e.target.checked, false)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="gi_sailing_toggle" className="cursor-pointer text-xs font-semibold">
                                Sailing with Vessel during inspection
                            </Label>
                        </div>

                        {info.sailing_with_vessel && (
                            <div className="grid gap-4 md:grid-cols-2 pt-1 pl-6">
                                <div className="space-y-1">
                                    <Label htmlFor="gi_sailing_from" className="text-xs">Sailing From</Label>
                                    <Input
                                        id="gi_sailing_from"
                                        value={info.sailing_from}
                                        disabled={!isEditable}
                                        placeholder="e.g. Merak"
                                        onChange={(e) => updateField('sailing_from', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="gi_sailing_to" className="text-xs">Sailing To</Label>
                                    <Input
                                        id="gi_sailing_to"
                                        value={info.sailing_to}
                                        disabled={!isEditable}
                                        placeholder="e.g. Batam"
                                        onChange={(e) => updateField('sailing_to', e.target.value)}
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
                            <Label htmlFor="gi_psc_port" className="text-xs">Port of Last PSC Inspection</Label>
                            <Input
                                id="gi_psc_port"
                                value={info.psc_last_port}
                                disabled={!isEditable}
                                placeholder="e.g. Tanjung Priok"
                                onChange={(e) => updateField('psc_last_port', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_psc_date" className="text-xs">Date of Last PSC Inspection</Label>
                            <Input
                                id="gi_psc_date"
                                type="date"
                                value={info.psc_last_date}
                                disabled={!isEditable}
                                onChange={(e) => updateField('psc_last_date', e.target.value)}
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
                            onChange={(e) => updateField('psc_detained_or_deficiencies', e.target.checked, false)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="gi_psc_detained" className="cursor-pointer text-xs font-medium text-muted-foreground">
                            Vessel was detained or deficiencies were identified during last PSC (verify close out)
                        </Label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 pt-3 border-t">
                        <div className="space-y-1">
                            <Label htmlFor="gi_dd_last" className="text-xs">Date of Last Dry Dock</Label>
                            <Input
                                id="gi_dd_last"
                                type="date"
                                value={info.drydock_last_date}
                                disabled={!isEditable}
                                onChange={(e) => updateField('drydock_last_date', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="gi_dd_next" className="text-xs">Next Dry Dock Date</Label>
                            <Input
                                id="gi_dd_next"
                                type="date"
                                value={info.drydock_next_date}
                                disabled={!isEditable}
                                onChange={(e) => updateField('drydock_next_date', e.target.value)}
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
                                    onClick={() => toggleOperation(op)}
                                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                        isSelected
                                            ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                                            : 'border-border hover:bg-muted/60 text-muted-foreground'
                                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                    <span className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50'
                                    }`}>
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
            {attendanceSubgroup && attendanceSubgroup.questions && attendanceSubgroup.questions.length > 0 && (
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

            {/* Next Chapter Navigation */}
            {nextChapter && (
                <div className="flex justify-end pt-1 pb-4">
                    <Button
                        type="button"
                        onClick={() => onChapterSwitch(nextChapter.id)}
                        className="flex items-center gap-2 font-medium"
                    >
                        <span>
                            Next: {nextChapter.chapter_no ? `Chapter ${nextChapter.chapter_no} - ${nextChapter.title}` : nextChapter.title}
                        </span>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
