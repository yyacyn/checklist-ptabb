import {
    Anchor,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleDashed,
    FileText,
    Info,
    ShieldAlert,
    Ship,
    UserCheck,
    Users,
} from 'lucide-react';
import React from 'react';
import { QuestionAnswerCard } from '@/components/question-answer-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/question-utils';
import type {
    AnswerData,
    ChapterData,
    ConflictData,
    PhotoCategoryItem,
    PhotoRecord,
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
    nextChapter?: { id: number; title: string; chapter_no?: string | null } | null;
    onChapterSwitch: (chapterId: number) => void;
    onToggleGuidance: (questionId: number) => void;
    onSelectAnswer: (questionId: number, val: string) => void;
    onSaveExtraValue: (questionId: number, val: string) => void;
    onAcceptServerAnswer: (questionId: number, srv: ConflictData['server_answer']) => void;
    onOverwriteAnswer: (questionId: number, srvVer: number) => void;
    filterQuestion: (q: ChapterData['questions'][0]) => boolean;
    reportPhotos?: PhotoRecord[];
    onPhotosUpdated?: (photos: PhotoRecord[]) => void;
    photoCategories?: PhotoCategoryItem[];
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
    reportPhotos,
    onPhotosUpdated,
    photoCategories,
}: GeneralInfoSectionProps) {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="border-b pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-mono">
                        Chapter 1
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                        Particulars & Attendance
                    </Badge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    General Information & Particulars
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    Verified vessel particulars, PSC & drydock milestones, operational status, and
                    attendance verification.
                </p>
            </div>

            {/* Vessel Core Particulars Card */}
            <Card className="border-2 border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Ship className="size-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Vessel Particulars</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            Auto-Populated from Registry
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Base particulars snapshot locked to this inspection report.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Vessel Name</span>
                        <div className="font-semibold text-foreground text-sm">{report.vessel_name}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">IMO Number</span>
                        <div className="font-mono text-foreground">{report.vessel_imo || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Flag State</span>
                        <div className="text-foreground">{report.vessel_flag || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Vessel Type</span>
                        <div className="text-foreground">{report.vessel_type?.name || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Gross Tonnage (GT)</span>
                        <div className="font-mono text-foreground">
                            {report.vessel_gt ? `${Number(report.vessel_gt).toLocaleString()} GT` : '—'}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Year Built</span>
                        <div className="text-foreground">{report.vessel_built || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Ice Class</span>
                        <div>
                            {report.vessel_ice_class ? (
                                <Badge variant="secondary" className="text-[10px]">
                                    Ice Class Verified
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">Standard Hull (Non-Ice)</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Report Reference</span>
                        <div className="font-mono font-semibold text-foreground">
                            {report.reference_number}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Inspection Date</span>
                        <div className="text-foreground">{formatDate(report.report_date)}</div>
                    </div>
                </CardContent>
            </Card>

            {/* Port & Sailing Particulars Card */}
            <Card className="border-2 border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Anchor className="size-4 text-primary" />
                        <CardTitle className="text-sm font-semibold">
                            Inspection Port & Sailing Details
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Inspection Port / Place</span>
                        <div className="font-medium text-foreground">{report.port || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Inspector / Auditor</span>
                        <div className="font-medium text-foreground">{report.inspected_by || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Sailing with Vessel</span>
                        <div className="flex items-center gap-1.5">
                            {report.sailing_with_vessel ? (
                                <Badge variant="default" className="text-[10px]">
                                    Yes (Voyage Attendance)
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px]">
                                    No (In Port Only)
                                </Badge>
                            )}
                        </div>
                    </div>
                    {report.sailing_with_vessel && (
                        <>
                            <div className="space-y-1">
                                <span className="text-muted-foreground font-medium">Sailing From</span>
                                <div className="text-foreground">{report.sailing_from || '—'}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-muted-foreground font-medium">Sailing To</span>
                                <div className="text-foreground">{report.sailing_to || '—'}</div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* PSC & Drydock Milestones Card */}
            <Card className="border-2 border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="size-4 text-primary" />
                        <CardTitle className="text-sm font-semibold">
                            Port State Control & Drydock History
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Last PSC Port</span>
                        <div className="text-foreground">{report.psc_last_port || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Last PSC Date</span>
                        <div className="text-foreground">{formatDate(report.psc_last_date) || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">PSC Detained / Deficiencies</span>
                        <div>
                            {report.psc_detained_or_deficiencies === true ? (
                                <Badge variant="destructive" className="text-[10px]">
                                    Yes (Deficiencies Recorded)
                                </Badge>
                            ) : report.psc_detained_or_deficiencies === false ? (
                                <Badge variant="secondary" className="text-[10px] text-emerald-600">
                                    Clean / Nil Deficiencies
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Drydock (Last / Next)</span>
                        <div className="text-foreground">
                            {formatDate(report.drydock_last_date) || '—'} /{' '}
                            {formatDate(report.drydock_next_date) || '—'}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Key Shipboard Personnel (Task 3.1) */}
            <Card className="border-2 border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Users className="size-4 text-primary" />
                        <CardTitle className="text-sm font-semibold">Key Shipboard Officers</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Master</span>
                        <div className="font-medium text-foreground">{report.master_name || '—'}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Chief Engineer</span>
                        <div className="font-medium text-foreground">
                            {report.chief_engineer_name || '—'}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-muted-foreground font-medium">Chief Officer</span>
                        <div className="font-medium text-foreground">
                            {report.chief_officer_name || '—'}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Operations Being Carried Out During Inspection */}
            <Card className="border-2 border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">
                                Operations Witnessed During Inspection
                            </CardTitle>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                            {(report.operations || []).length} active
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-2">
                        {INSPECTION_OPERATIONS.map((op) => {
                            const isSelected = (report.operations || []).includes(op);
                            return (
                                <Badge
                                    key={op}
                                    variant={isSelected ? 'default' : 'outline'}
                                    className={`text-xs py-1 px-2.5 transition-colors ${
                                        isSelected
                                            ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                                            : 'text-muted-foreground opacity-60'
                                    }`}
                                >
                                    {isSelected ? (
                                        <Check className="size-3 mr-1" />
                                    ) : (
                                        <CircleDashed className="size-3 mr-1" />
                                    )}
                                    {op}
                                </Badge>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Attendance & Verification Questions (Subgroup under Chapter 1) */}
            {attendanceSubgroup && attendanceSubgroup.questions && (
                <div className="space-y-3 pt-2">
                    <div className="border-b pb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UserCheck className="size-4 text-primary" />
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-foreground">
                                {attendanceSubgroup.title}
                            </h3>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                            {attendanceSubgroup.questions.length} Items
                        </Badge>
                    </div>

                    <div className="space-y-3">
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
                                reportPhotos={reportPhotos}
                                onPhotosUpdated={onPhotosUpdated}
                                photoCategories={photoCategories}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Next Chapter Navigation */}
            {nextChapter && (
                <div className="flex justify-end pt-2 pb-4">
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
