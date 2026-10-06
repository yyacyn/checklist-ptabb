import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Clock, FileText, Ship } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Question {
    id: number;
    question_text: string;
    guidance: string | null;
    input_type: string;
    is_applicable: boolean;
    inapplicable_reason: string | null;
}

interface Subgroup {
    id: number;
    title: string;
    is_applicable: boolean;
    questions: Question[];
}

interface Chapter {
    id: number;
    title: string;
    chapter_no: string | null;
    is_applicable: boolean;
    inapplicable_reason: string | null;
    questions: Question[];
    subgroups: Subgroup[];
}

interface ReportData {
    id: number;
    report_type: 'inspection' | 'audit';
    reference_number: string;
    status: string;
    template_version: number;
    vessel_name: string;
    vessel_imo: string | null;
    vessel_flag: string | null;
    vessel_gt: string | null;
    vessel_built: number | null;
    vessel_ice_class: boolean;
    report_date: string;
    master_name: string | null;
    chief_engineer_name: string | null;
    chief_officer_name: string | null;
    form: {
        id: number;
        code: string;
        name: string;
        answer_set: string;
    };
    vessel_type?: {
        id: number;
        name: string;
    } | null;
    groups: Chapter[];
}

interface Props {
    report: ReportData;
}

export default function ReportShowPlaceholder({ report }: Props) {
    const totalQuestions = report.groups.reduce((acc, g) => {
        const direct = (g.questions || []).length;
        const sub = (g.subgroups || []).reduce((sAcc, sg) => sAcc + (sg.questions || []).length, 0);
        return acc + direct + sub;
    }, 0);

    const applicableQuestions = report.groups.reduce((acc, g) => {
        const direct = (g.questions || []).filter((q) => q.is_applicable).length;
        const sub = (g.subgroups || []).reduce(
            (sAcc, sg) => sAcc + (sg.questions || []).filter((q) => q.is_applicable).length,
            0
        );
        return acc + direct + sub;
    }, 0);

    return (
        <>
            <Head title={`Report ${report.reference_number}`} />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                                <Link href="/reports">
                                    <ArrowLeft className="size-4 mr-1" /> Reports
                                </Link>
                            </Button>
                            <span className="text-muted-foreground">•</span>
                            <Badge variant="outline" className="font-mono font-bold">
                                {report.reference_number}
                            </Badge>
                            <Badge variant="secondary">Template v{report.template_version}</Badge>
                            <Badge variant="default" className="capitalize">
                                {report.status}
                            </Badge>
                        </div>
                        <Heading
                            title={`${report.vessel_name} — ${report.form.name}`}
                            description={`Snapshot frozen on ${report.report_date}. ${applicableQuestions} applicable items ready for data entry.`}
                        />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Vessel Particulars</CardDescription>
                            <CardTitle className="text-base font-semibold">{report.vessel_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-0.5">
                            <div>Type: {report.vessel_type?.name || 'All Types'}</div>
                            <div>IMO: {report.vessel_imo || '—'}</div>
                            <div>Ice Class: {report.vessel_ice_class ? 'Yes' : 'No'}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Snapshot Catalogue</CardDescription>
                            <CardTitle className="text-base font-semibold">{report.groups.length} Chapters</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-0.5">
                            <div>Total items: {totalQuestions}</div>
                            <div>Applicable: {applicableQuestions}</div>
                            <div>Locked NA: {totalQuestions - applicableQuestions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Inspection Officers</CardDescription>
                            <CardTitle className="text-base font-semibold">
                                {report.master_name || 'Crew Onboard'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-0.5">
                            <div>C/E: {report.chief_engineer_name || '—'}</div>
                            <div>C/O: {report.chief_officer_name || '—'}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs text-primary font-medium">Task 3.1 Status</CardDescription>
                            <CardTitle className="text-base font-semibold text-primary flex items-center gap-1.5">
                                <CheckCircle2 className="size-4" /> Snapshot Created
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            Next: Task 3.2 (single-chapter filling interface with autosave engine).
                        </CardContent>
                    </Card>
                </div>

                {/* Chapter Snapshot Preview List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Frozen Chapters in this Report</CardTitle>
                        <CardDescription>
                            Copied directly into this report. Editing superadmin templates will not alter this audit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {report.groups.map((group) => {
                                const qCount =
                                    (group.questions || []).length +
                                    (group.subgroups || []).reduce(
                                        (acc, sg) => acc + (sg.questions || []).length,
                                        0
                                    );

                                return (
                                    <div
                                        key={group.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            {group.chapter_no && (
                                                <span className="font-mono font-semibold text-sm">
                                                    {group.chapter_no}.
                                                </span>
                                            )}
                                            <span className="font-medium text-sm text-foreground">
                                                {group.title}
                                            </span>
                                            {!group.is_applicable && (
                                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                                    {group.inapplicable_reason || 'Inapplicable'}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {group.subgroups?.length > 0 && `${group.subgroups.length} subgroups • `}
                                            {qCount} questions
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ReportShowPlaceholder.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reports & Audits', href: '/reports' },
    ],
};
