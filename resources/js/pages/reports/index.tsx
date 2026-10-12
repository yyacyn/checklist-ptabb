import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    CheckCircle2,
    Eye,
    FilePlus2,
    RotateCcw,
    Search,
    Ship,
    Trash2,
    X,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface ReportItem {
    id: number;
    report_type: 'inspection' | 'audit';
    reference_number: string;
    status: string;
    vessel_name: string;
    vessel_imo: string | null;
    vessel_type: string | null;
    report_date: string;
    form_code: string;
    form_name: string;
    created_at: string;
    can_delete?: boolean;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginationProps {
    data: ReportItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links?: PaginationLink[];
}

interface FormOption {
    id: number;
    code: string;
    name: string;
}

interface FilterParams {
    search?: string;
    status?: string;
    report_type?: string;
    form_code?: string;
    vessel_name?: string;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    per_page?: number;
}

interface Props {
    reports: PaginationProps;
    filters: FilterParams;
    forms?: FormOption[];
    known_vessels?: string[];
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'draft':
            return <Badge variant="secondary">Draft</Badge>;
        case 'in_progress':
            return <Badge variant="default">In Progress</Badge>;
        case 'submitted':
            return (
                <Badge variant="outline" className="border-amber-500 text-amber-500">
                    Submitted
                </Badge>
            );
        case 'reviewed':
            return (
                <Badge variant="outline" className="border-blue-500 text-blue-500">
                    Reviewed
                </Badge>
            );
        case 'closed':
            return (
                <Badge variant="outline" className="border-green-600 text-green-600">
                    Closed
                </Badge>
            );
        case 'reopened':
            return <Badge variant="destructive">Reopened</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function ReportsIndex({
    reports,
    filters = {},
    forms = [],
    known_vessels = [],
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || 'all');
    const [formCode, setFormCode] = useState(filters.form_code || 'all');
    const [vesselName, setVesselName] = useState(filters.vessel_name || 'all');
    const [sortBy, setSortBy] = useState(filters.sort_by || 'report_date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir || 'desc');

    // Deletion Modal
    const [deletingReport, setDeletingReport] = useState<ReportItem | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const isFiltered = Boolean(
        (search && search.trim().length > 0) ||
            (status && status !== 'all') ||
            (formCode && formCode !== 'all') ||
            (vesselName && vesselName !== 'all')
    );

    // Debounced search timer
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const applyFilters = (overrides: Partial<FilterParams> = {}) => {
        const queryParams: Record<string, string | number | undefined> = {
            search: overrides.search !== undefined ? (overrides.search.trim() || undefined) : (search.trim() || undefined),
            status: overrides.status !== undefined ? (overrides.status !== 'all' ? overrides.status : undefined) : (status !== 'all' ? status : undefined),
            form_code: overrides.form_code !== undefined ? (overrides.form_code !== 'all' ? overrides.form_code : undefined) : (formCode !== 'all' ? formCode : undefined),
            vessel_name: overrides.vessel_name !== undefined ? (overrides.vessel_name !== 'all' ? overrides.vessel_name : undefined) : (vesselName !== 'all' ? vesselName : undefined),
            sort_by: overrides.sort_by ?? sortBy,
            sort_dir: overrides.sort_dir ?? sortDir,
        };

        // Remove undefined / empty keys
        Object.keys(queryParams).forEach((k) => {
            if (queryParams[k] === undefined || queryParams[k] === '') {
                delete queryParams[k];
            }
        });

        router.get('/reports', queryParams, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            applyFilters({ search: val });
        }, 350);
    };

    const handleStatusChange = (val: string) => {
        setStatus(val);
        applyFilters({ status: val });
    };

    const handleFormChange = (val: string) => {
        setFormCode(val);
        applyFilters({ form_code: val });
    };

    const handleVesselChange = (val: string) => {
        setVesselName(val);
        applyFilters({ vessel_name: val });
    };

    const handleReset = () => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setSearch('');
        setStatus('all');
        setFormCode('all');
        setVesselName('all');
        setSortBy('report_date');
        setSortDir('desc');

        router.get('/reports', {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSort = (column: string) => {
        let newDir: 'asc' | 'desc' = 'asc';
        if (sortBy === column) {
            newDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            newDir = column === 'report_date' || column === 'created_at' ? 'desc' : 'asc';
        }
        setSortBy(column);
        setSortDir(newDir);
        applyFilters({ sort_by: column, sort_dir: newDir });
    };

    const handleDelete = () => {
        if (!deletingReport) return;
        setIsDeleting(true);
        router.delete(`/reports/${deletingReport.id}`, {
            data: { delete_reason: deleteReason },
            onFinish: () => {
                setIsDeleting(false);
                setDeletingReport(null);
            },
        });
    };

    const renderSortIcon = (column: string) => {
        if (sortBy !== column) {
            return <ArrowUpDown className="size-3 text-muted-foreground/50 ml-1 inline-block" />;
        }
        return sortDir === 'asc' ? (
            <ArrowUp className="size-3 text-primary ml-1 inline-block" />
        ) : (
            <ArrowDown className="size-3 text-primary ml-1 inline-block" />
        );
    };

    return (
        <>
            <Head title="Vessel Reports & Audits" />

            <div className="flex h-full flex-1 flex-col gap-5 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-semibold gap-1">
                                <Ship className="size-3" /> Fleet Inspection
                            </Badge>
                            <Badge variant="secondary">{reports.total} Reports</Badge>
                        </div>
                        <Heading
                            title="Vessel Reports & Audits"
                            description="Vessel inspections, onboard audits, and photographic reports across the fleet."
                        />
                    </div>

                    <Button asChild className="flex items-center gap-1.5 self-start shadow-xs">
                        <Link href="/reports/create">
                            <FilePlus2 className="size-4" />
                            <span>Create New Report</span>
                        </Link>
                    </Button>
                </div>

                {/* Clean, Single-Row Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search reference, vessel..."
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-8 text-xs h-9 bg-card"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Status Filter */}
                        <Select value={status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="reviewed">Reviewed</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="reopened">Reopened</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Form Code Filter */}
                        {forms.length > 0 && (
                            <Select value={formCode} onValueChange={handleFormChange}>
                                <SelectTrigger className="w-[135px] h-9 text-xs bg-card">
                                    <SelectValue placeholder="All Forms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Forms</SelectItem>
                                    {forms.map((f) => (
                                        <SelectItem key={f.code} value={f.code}>
                                            {f.code} ({f.name.slice(0, 16)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Vessel Filter */}
                        {known_vessels.length > 1 && (
                            <Select value={vesselName} onValueChange={handleVesselChange}>
                                <SelectTrigger className="w-[150px] h-9 text-xs bg-card">
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
                        )}

                        {/* Reset Filter Button */}
                        {isFiltered && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                            >
                                <RotateCcw className="size-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table or Empty state */}
                {reports.data.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <CheckCircle2 className="size-12 text-muted-foreground/60 mb-3" />
                        <h3 className="font-semibold text-lg text-foreground">No reports match your filters</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            {isFiltered
                                ? 'Try clearing your search query or filters to see all reports.'
                                : 'Create your first inspection or audit to start checklist entry.'}
                        </p>
                        {isFiltered ? (
                            <Button variant="outline" size="sm" onClick={handleReset} className="mt-4">
                                Clear Filters
                            </Button>
                        ) : (
                            <Button asChild className="mt-4">
                                <Link href="/reports/create">Create Report</Link>
                            </Button>
                        )}
                    </Card>
                ) : (
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        {/* Reference # */}
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('reference_number')}
                                        >
                                            <div className="flex items-center">
                                                <span>Reference #</span>
                                                {renderSortIcon('reference_number')}
                                            </div>
                                        </th>

                                        {/* Form */}
                                        <th className="px-4 py-3">Form</th>

                                        {/* Vessel */}
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('vessel_name')}
                                        >
                                            <div className="flex items-center">
                                                <span>Vessel</span>
                                                {renderSortIcon('vessel_name')}
                                            </div>
                                        </th>

                                        {/* Type */}
                                        <th className="px-4 py-3">Type</th>

                                        {/* Report Date */}
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('report_date')}
                                        >
                                            <div className="flex items-center">
                                                <span>Date</span>
                                                {renderSortIcon('report_date')}
                                            </div>
                                        </th>

                                        {/* Status */}
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-foreground select-none"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center">
                                                <span>Status</span>
                                                {renderSortIcon('status')}
                                            </div>
                                        </th>

                                        {/* Action */}
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {reports.data.map((report) => (
                                        <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-mono font-medium text-foreground">
                                                {report.reference_number}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="font-bold">
                                                    {report.form_code}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-foreground">{report.vessel_name}</div>
                                                {report.vessel_imo && (
                                                    <div className="text-xs text-muted-foreground">IMO: {report.vessel_imo}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground capitalize">
                                                {report.report_type}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {report.report_date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(report.status)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                                                        <Link href={`/reports/${report.id}`}>
                                                            <Eye className="size-3.5 mr-1" /> View / Fill
                                                        </Link>
                                                    </Button>
                                                    {report.can_delete && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60"
                                                            onClick={() => {
                                                                setDeletingReport(report);
                                                                setDeleteReason('');
                                                            }}
                                                            title="Delete Draft"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-muted-foreground pt-1">
                            <div>
                                {reports.total > 0 ? (
                                    <span>
                                        Showing <span className="font-medium text-foreground">{reports.from || 1}</span> to{' '}
                                        <span className="font-medium text-foreground">{reports.to || reports.data.length}</span> of{' '}
                                        <span className="font-medium text-foreground">{reports.total}</span> reports
                                    </span>
                                ) : (
                                    <span>No reports</span>
                                )}
                            </div>

                            {reports.last_page > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {reports.prev_page_url ? (
                                        <Button size="sm" variant="outline" asChild className="h-8 text-xs px-2.5">
                                            <Link href={reports.prev_page_url} preserveState preserveScroll>
                                                Previous
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" disabled className="h-8 text-xs px-2.5 opacity-50">
                                            Previous
                                        </Button>
                                    )}

                                    {reports.links && reports.links.length > 3 ? (
                                        reports.links.slice(1, -1).map((link, linkIdx) => {
                                            if (link.label === '...') {
                                                return (
                                                    <span key={linkIdx} className="px-2 py-1 text-muted-foreground">
                                                        ...
                                                    </span>
                                                );
                                            }

                                            return link.url ? (
                                                <Button
                                                    key={linkIdx}
                                                    size="sm"
                                                    variant={link.active ? 'default' : 'outline'}
                                                    asChild
                                                    className="h-8 w-8 p-0 text-xs"
                                                >
                                                    <Link href={link.url} preserveState preserveScroll>
                                                        {link.label}
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    key={linkIdx}
                                                    size="sm"
                                                    variant="outline"
                                                    disabled
                                                    className="h-8 w-8 p-0 text-xs opacity-50"
                                                >
                                                    {link.label}
                                                </Button>
                                            );
                                        })
                                    ) : (
                                        <span className="text-xs px-2">
                                            Page {reports.current_page} of {reports.last_page}
                                        </span>
                                    )}

                                    {reports.next_page_url ? (
                                        <Button size="sm" variant="outline" asChild className="h-8 text-xs px-2.5">
                                            <Link href={reports.next_page_url} preserveState preserveScroll>
                                                Next
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" disabled className="h-8 text-xs px-2.5 opacity-50">
                                            Next
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Dialog for Deleting Draft */}
            <Dialog open={!!deletingReport} onOpenChange={(open) => !open && setDeletingReport(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Draft Report</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete draft report{' '}
                            <span className="font-semibold text-foreground">{deletingReport?.reference_number}</span> for{' '}
                            <span className="font-semibold text-foreground">{deletingReport?.vessel_name}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <Label htmlFor="delete-reason" className="text-xs">Reason for deletion (optional)</Label>
                        <Input
                            id="delete-reason"
                            placeholder="e.g. Created by mistake / duplicated"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            disabled={isDeleting}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeletingReport(null)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={handleDelete}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Draft'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reports & Audits', href: '/reports' },
    ],
};
