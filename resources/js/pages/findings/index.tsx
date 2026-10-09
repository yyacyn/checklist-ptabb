import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ExternalLink,
    Filter,
    RotateCcw,
    Search,
    ShieldAlert,
    Ship,
} from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface FindingItem {
    id: number;
    report_id: number;
    report_reference: string;
    report_status: string;
    report_date: string;
    vessel_name: string;
    form_code: string;
    form_name: string;
    chapter_label: string | null;
    finding_kind: 'observation' | 'non_conformity';
    risk: 'high' | 'medium' | 'low' | null;
    severity: string | null;
    description: string;
    viq_paragraph: string | null;
    job_order_no: string | null;
    target_date: string | null;
    finding_status: string;
    created_at: string;
}

interface PaginationProps {
    data: FindingItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface StatsProps {
    total: number;
    open: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
}

interface FormCodeOption {
    code: string;
    name: string;
}

interface Props {
    findings: PaginationProps;
    stats: StatsProps;
    known_vessels: string[];
    form_codes: FormCodeOption[];
    filters: {
        search: string;
        vessel_name: string;
        risk: string;
        finding_status: string;
        finding_kind: string;
        form_code: string;
        date_from: string;
        date_to: string;
    };
    user_role: string;
}

function getRiskBadge(risk: string | null) {
    switch (risk) {
        case 'high':
            return (
                <Badge className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
                    High Risk
                </Badge>
            );
        case 'medium':
            return (
                <Badge className="bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700">
                    Medium Risk
                </Badge>
            );
        case 'low':
            return (
                <Badge className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                    Low Risk
                </Badge>
            );
        default:
            return <Badge variant="outline">Unrated</Badge>;
    }
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'open':
            return <Badge variant="destructive">Open</Badge>;
        case 'action_submitted':
            return <Badge variant="outline" className="border-amber-500 text-amber-500">Action Submitted</Badge>;
        case 'verified':
            return <Badge variant="outline" className="border-blue-500 text-blue-500">Verified</Badge>;
        case 'closed':
            return <Badge variant="outline" className="border-green-600 text-green-600">Closed</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function FindingsIndex({
    findings,
    stats,
    known_vessels,
    form_codes,
    filters,
    user_role,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [vesselName, setVesselName] = useState(filters.vessel_name || '');
    const [risk, setRisk] = useState(filters.risk || 'all');
    const [findingStatus, setFindingStatus] = useState(filters.finding_status || 'all');
    const [formCode, setFormCode] = useState(filters.form_code || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const handleFilter = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        router.get(
            '/findings',
            {
                search: search || undefined,
                vessel_name: vesselName && vesselName !== 'all' ? vesselName : undefined,
                risk: risk && risk !== 'all' ? risk : undefined,
                finding_status: findingStatus && findingStatus !== 'all' ? findingStatus : undefined,
                form_code: formCode && formCode !== 'all' ? formCode : undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleReset = () => {
        setSearch('');
        setVesselName('');
        setRisk('all');
        setFindingStatus('all');
        setFormCode('all');
        setDateFrom('');
        setDateTo('');

        router.get('/findings', {}, { preserveState: true });
    };

    const isFiltered =
        Boolean(search) ||
        (Boolean(vesselName) && vesselName !== 'all') ||
        (Boolean(risk) && risk !== 'all') ||
        (Boolean(findingStatus) && findingStatus !== 'all') ||
        (Boolean(formCode) && formCode !== 'all') ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    return (
        <>
            <Head title="Findings & Observations Register" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <Heading
                            title="Findings & Observations Register"
                            description="Centralized tracking for observations and non-conformities across reports (FND-2)."
                        />
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-5">
                    <Card className="bg-card shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                                Total Findings
                            </CardTitle>
                            <ShieldAlert className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">Recorded fleet observations</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card shadow-xs border-red-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">
                                High Risk
                            </CardTitle>
                            <AlertOctagon className="size-4 text-red-600 dark:text-red-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {stats.high_risk}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Immediate priority</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card shadow-xs border-amber-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">
                                Medium Risk
                            </CardTitle>
                            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {stats.medium_risk}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Medium priority actions</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card shadow-xs border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
                                Low Risk
                            </CardTitle>
                            <AlertCircle className="size-4 text-blue-600 dark:text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {stats.low_risk}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Routine monitoring</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card shadow-xs border-orange-500/20 col-span-2 sm:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase">
                                Open Status
                            </CardTitle>
                            <Clock className="size-4 text-orange-600 dark:text-orange-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {stats.open}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Pending close-out</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter Toolbar */}
                <Card className="p-4 bg-card shadow-xs">
                    <form onSubmit={handleFilter} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Search */}
                            <div className="space-y-1">
                                <Label htmlFor="search-filter" className="text-xs">Search Keywords</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                    <Input
                                        id="search-filter"
                                        placeholder="Description, VIQ, JO #, Ref..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            {/* Vessel Filter (if corporate / superadmin) */}
                            {user_role !== 'vessel' ? (
                                <div className="space-y-1">
                                    <Label className="text-xs">Vessel</Label>
                                    <Select value={vesselName || 'all'} onValueChange={(val) => setVesselName(val === 'all' ? '' : val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Vessels" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Vessels</SelectItem>
                                            {known_vessels.map((v) => (
                                                <SelectItem key={v} value={v}>
                                                    {v}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Label className="text-xs">Assigned Vessel</Label>
                                    <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
                                        <Ship className="size-3.5 mr-2 text-muted-foreground" />
                                        {known_vessels[0] || 'My Vessel'}
                                    </div>
                                </div>
                            )}

                            {/* Risk Filter */}
                            <div className="space-y-1">
                                <Label className="text-xs">Risk Level</Label>
                                <Select value={risk} onValueChange={setRisk}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Risks" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Risks</SelectItem>
                                        <SelectItem value="high">High Risk</SelectItem>
                                        <SelectItem value="medium">Medium Risk</SelectItem>
                                        <SelectItem value="low">Low Risk</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Finding Status */}
                            <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <Select value={findingStatus} onValueChange={setFindingStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="action_submitted">Action Submitted</SelectItem>
                                        <SelectItem value="verified">Verified</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Secondary Row: Form Code, Date Range, Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-end justify-between gap-3 pt-2 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
                                {/* Form Code */}
                                <div className="space-y-1">
                                    <Label className="text-xs">Form Code</Label>
                                    <Select value={formCode} onValueChange={setFormCode}>
                                        <SelectTrigger className="w-full sm:w-44">
                                            <SelectValue placeholder="All Forms" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Forms</SelectItem>
                                            {form_codes.map((fc) => (
                                                <SelectItem key={fc.code} value={fc.code}>
                                                    {fc.code} - {fc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Date From */}
                                <div className="space-y-1">
                                    <Label htmlFor="date-from" className="text-xs">Date From</Label>
                                    <Input
                                        id="date-from"
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full sm:w-36"
                                    />
                                </div>

                                {/* Date To */}
                                <div className="space-y-1">
                                    <Label htmlFor="date-to" className="text-xs">Date To</Label>
                                    <Input
                                        id="date-to"
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full sm:w-36"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                {isFiltered && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleReset}
                                        className="flex items-center gap-1 text-xs"
                                    >
                                        <RotateCcw className="size-3.5" />
                                        Reset
                                    </Button>
                                )}
                                <Button type="submit" size="sm" className="flex items-center gap-1.5">
                                    <Filter className="size-3.5" />
                                    Filter Findings
                                </Button>
                            </div>
                        </div>
                    </form>
                </Card>

                {/* Findings Table */}
                {findings.data.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <CheckCircle2 className="size-12 text-muted-foreground/60 mb-3" />
                        <h3 className="font-semibold text-lg text-foreground">No findings match your criteria</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            {isFiltered
                                ? 'Try adjusting your search filters or resetting them to view all findings.'
                                : 'No observations or non-conformity findings recorded.'}
                        </p>
                        {isFiltered && (
                            <Button variant="outline" size="sm" onClick={handleReset} className="mt-4">
                                Clear Filters
                            </Button>
                        )}
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3">Report / Vessel</th>
                                        <th className="px-4 py-3">Chapter & VIQ</th>
                                        <th className="px-4 py-3">Finding Description</th>
                                        <th className="px-4 py-3">Job Order #</th>
                                        <th className="px-4 py-3">Target Date</th>
                                        <th className="px-4 py-3">Risk Level</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {findings.data.map((finding) => (
                                        <tr key={finding.id} className="hover:bg-muted/30 transition-colors">
                                            {/* Report & Vessel */}
                                            <td className="px-4 py-3 align-top">
                                                <div className="font-medium text-foreground">
                                                    <Link
                                                        href={`/reports/${finding.report_id}`}
                                                        className="hover:underline text-primary inline-flex items-center gap-1"
                                                    >
                                                        {finding.report_reference || `Report #${finding.report_id}`}
                                                    </Link>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                    <Ship className="size-3" />
                                                    <span>{finding.vessel_name}</span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                                                    {finding.form_code} • {finding.report_date}
                                                </div>
                                            </td>

                                            {/* Chapter & VIQ */}
                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                <div className="font-medium text-xs text-foreground">
                                                    {finding.chapter_label || 'General'}
                                                </div>
                                                {finding.viq_paragraph && (
                                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                                        VIQ §{finding.viq_paragraph}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td className="px-4 py-3 align-top max-w-md">
                                                <p className="text-xs text-foreground line-clamp-3 whitespace-pre-wrap">
                                                    {finding.description}
                                                </p>
                                                {finding.severity && (
                                                    <div className="text-[11px] text-muted-foreground mt-1">
                                                        Severity: <span className="font-medium">{finding.severity}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Job Order # */}
                                            <td className="px-4 py-3 align-top whitespace-nowrap text-xs">
                                                {finding.job_order_no ? (
                                                    <span className="font-mono font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                                                        {finding.job_order_no}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Target Date */}
                                            <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-muted-foreground">
                                                {finding.target_date || '—'}
                                            </td>

                                            {/* Risk Level */}
                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                {getRiskBadge(finding.risk)}
                                            </td>

                                            {/* Finding Status */}
                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                {getStatusBadge(finding.finding_status)}
                                            </td>

                                            {/* Action */}
                                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                                                <Button size="sm" variant="ghost" asChild className="h-8 gap-1 text-xs">
                                                    <Link href={`/reports/${finding.report_id}`}>
                                                        <span>View Report</span>
                                                        <ExternalLink className="size-3.5" />
                                                    </Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                            <div>
                                {findings.total > 0 ? (
                                    <span>
                                        Showing <span className="font-medium text-foreground">{findings.from || 1}</span> to{' '}
                                        <span className="font-medium text-foreground">{findings.to || findings.data.length}</span> of{' '}
                                        <span className="font-medium text-foreground">{findings.total}</span> findings
                                    </span>
                                ) : (
                                    <span>No findings</span>
                                )}
                            </div>

                            {findings.last_page > 1 && (
                                <div className="flex items-center gap-2">
                                    {findings.prev_page_url ? (
                                        <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                                            <Link href={findings.prev_page_url} preserveState>
                                                Previous
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                                            Previous
                                        </Button>
                                    )}

                                    <span className="text-xs">
                                        Page {findings.current_page} of {findings.last_page}
                                    </span>

                                    {findings.next_page_url ? (
                                        <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                                            <Link href={findings.next_page_url} preserveState>
                                                Next
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                                            Next
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

FindingsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Findings Register', href: '/findings' },
    ],
};
