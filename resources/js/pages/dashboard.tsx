import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Camera,
    CheckCircle2,
    Clock,
    FileCheck2,
    FileText,
    Layers,
    Plus,
    PlusCircle,
    Shield,
    Ship,
    Users,
} from 'lucide-react';
import React from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';

interface RecentReportItem {
    id: number;
    reference_number: string;
    vessel_name: string;
    status: 'draft' | 'submitted';
    report_date: string;
    form?: {
        id: number;
        title: string;
        code: string;
    };
}

interface DashboardProps {
    stats?: {
        total_reports: number;
        draft_reports: number;
        submitted_reports: number;
        open_findings: number;
    };
    recent_reports?: RecentReportItem[];
}

export default function Dashboard({ stats, recent_reports = [] }: DashboardProps) {
    const page = usePage();
    const user = (page.props as any).auth?.user;

    const totalReports = stats?.total_reports ?? 0;
    const draftReports = stats?.draft_reports ?? 0;
    const submittedReports = stats?.submitted_reports ?? 0;
    const openFindings = stats?.open_findings ?? 0;

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6 max-w-full mx-auto w-full">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-semibold gap-1">
                                {user?.role === 'vessel' ? (
                                    <>
                                        <Ship className="size-3" /> Vessel
                                    </>
                                ) : user?.role === 'superadmin' ? (
                                    <>
                                        <Shield className="size-3" /> Admin
                                    </>
                                ) : (
                                    <>
                                        <Users className="size-3" /> Corporate
                                    </>
                                )}
                            </Badge>
                            {user?.vessel_name && (
                                <Badge variant="secondary" className="text-xs font-medium">
                                    {user.vessel_name}
                                </Badge>
                            )}
                        </div>
                        <Heading
                            title="Dashboard"
                            description="Overview of vessel inspection checklists, open findings, and fleet operations."
                        />
                    </div>

                    <Button asChild className="flex items-center gap-1.5 self-start shadow-xs">
                        <Link href="/reports/create">
                            <Plus className="size-4" />
                            <span>New Inspection</span>
                        </Link>
                    </Button>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Reports
                            </CardTitle>
                            <FileCheck2 className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalReports}</div>
                            <p className="text-xs text-muted-foreground mt-1">Inspection checklists</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Completed / Submitted
                            </CardTitle>
                            <CheckCircle2 className="size-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{submittedReports}</div>
                            <p className="text-xs text-muted-foreground mt-1">Verified & finalized</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                In Progress (Drafts)
                            </CardTitle>
                            <Clock className="size-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{draftReports}</div>
                            <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Open Findings
                            </CardTitle>
                            <AlertCircle className="size-4 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{openFindings}</div>
                            <p className="text-xs text-muted-foreground mt-1">Chapter 15 observations</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Move / Quick Navigation Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold tracking-tight">Quick Move</h3>
                            <p className="text-xs text-muted-foreground">
                                Direct shortcuts to primary inspection workflows and fleet records.
                            </p>
                        </div>
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            Shortcuts
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Link
                            href="/reports"
                            className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                        >
                            <div className="flex items-start justify-between">
                                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                                    <FileText className="size-5" />
                                </div>
                                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </div>
                            <div className="mt-3">
                                <div className="font-semibold text-sm text-foreground">Inspection Reports</div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Browse, filter, and export completed or draft checklist reports.
                                </p>
                            </div>
                        </Link>

                        <Link
                            href="/reports/create"
                            className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                        >
                            <div className="flex items-start justify-between">
                                <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                                    <PlusCircle className="size-5" />
                                </div>
                                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </div>
                            <div className="mt-3">
                                <div className="font-semibold text-sm text-foreground">New Inspection</div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Start a new D-062 or B-008 vessel checklist inspection.
                                </p>
                            </div>
                        </Link>

                        <Link
                            href="/findings"
                            className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                        >
                            <div className="flex items-start justify-between">
                                <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="size-5" />
                                </div>
                                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </div>
                            <div className="mt-3">
                                <div className="font-semibold text-sm text-foreground">Defects & Findings</div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Review Chapter 15 findings, corrective actions, and deadlines.
                                </p>
                            </div>
                        </Link>


                        {(user?.role === 'superadmin' || user?.role === 'corporate') && (
                            <Link
                                href="/admin/forms"
                                className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-400">
                                        <Layers className="size-5" />
                                    </div>
                                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                                </div>
                                <div className="mt-3">
                                    <div className="font-semibold text-sm text-foreground">Checklist Forms</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Configure D-062 & B-008 templates, sections, and question rules.
                                    </p>
                                </div>
                            </Link>
                        )}

                        {user?.role === 'superadmin' && (
                            <Link
                                href="/admin/users"
                                className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="rounded-lg bg-sky-500/10 p-2.5 text-sky-600 dark:text-sky-400">
                                        <Users className="size-5" />
                                    </div>
                                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                                </div>
                                <div className="mt-3">
                                    <div className="font-semibold text-sm text-foreground">Accounts & Vessels</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Manage corporate users, vessel logins, and vessel classifications.
                                    </p>
                                </div>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Recent Activity / Reports */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold tracking-tight">Recent Reports</h3>
                            <p className="text-xs text-muted-foreground">
                                Latest vessel inspection activity and submissions.
                            </p>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="text-xs">
                            <Link href="/reports" className="flex items-center gap-1">
                                <span>View all</span>
                                <ArrowRight className="size-3.5" />
                            </Link>
                        </Button>
                    </div>

                    <Card className="shadow-xs overflow-hidden">
                        {recent_reports.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <FileCheck2 className="size-8 text-muted-foreground/40" />
                                    <p className="font-medium text-sm text-foreground">No inspection reports yet</p>
                                    <p className="text-xs max-w-sm">
                                        Get started by launching a new D-062 Tug Boat or B-008 Oil Barge checklist inspection.
                                    </p>
                                    <Button asChild size="sm" className="mt-2 text-xs">
                                        <Link href="/reports/create">Start First Inspection</Link>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3">Report Number</th>
                                            <th className="px-4 py-3">Vessel</th>
                                            <th className="px-4 py-3">Form</th>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recent_reports.map((report) => (
                                            <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium">
                                                    <Link
                                                        href={`/reports/${report.id}`}
                                                        className="hover:underline text-foreground"
                                                    >
                                                        {report.reference_number || `#${report.id}`}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-foreground">
                                                    {report.vessel_name}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {report.form?.code || 'Checklist'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {report.report_date}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {report.status === 'submitted' ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs"
                                                        >
                                                            Submitted
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground text-xs">
                                                            Draft
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                                        <Link href={`/reports/${report.id}`}>
                                                            Open
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
