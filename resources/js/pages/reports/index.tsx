import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, FilePlus2, Filter, Ship, Trash2 } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

interface PaginationProps {
    data: ReportItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    reports: PaginationProps;
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'draft':
            return <Badge variant="secondary">Draft</Badge>;
        case 'in_progress':
            return <Badge variant="default">In Progress</Badge>;
        case 'submitted':
            return <Badge variant="outline" className="border-amber-500 text-amber-500">Submitted</Badge>;
        case 'reviewed':
            return <Badge variant="outline" className="border-blue-500 text-blue-500">Reviewed</Badge>;
        case 'closed':
            return <Badge variant="outline" className="border-green-600 text-green-600">Closed</Badge>;
        case 'reopened':
            return <Badge variant="destructive">Reopened</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function ReportsIndex({ reports }: Props) {
    const [deletingReport, setDeletingReport] = useState<ReportItem | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

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

    return (
        <>
            <Head title="Vessel Reports & Audits" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <Heading
                            title="Vessel Reports & Audits"
                            description="Inspections (D-062) and onboard internal audits (B-008) across the fleet."
                        />
                    </div>

                    <Button asChild className="flex items-center gap-1.5 self-start">
                        <Link href="/reports/create">
                            <FilePlus2 className="size-4" />
                            <span>Create New Report</span>
                        </Link>
                    </Button>
                </div>

                {/* Table or Empty state */}
                {reports.data.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                        <Ship className="size-12 text-muted-foreground/60 mb-3" />
                        <h3 className="font-semibold text-lg text-foreground">No reports found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Create your first inspection or audit to start checklist entry.
                        </p>
                        <Button asChild className="mt-4">
                            <Link href="/reports/create">Create Report</Link>
                        </Button>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3">Reference #</th>
                                        <th className="px-4 py-3">Form</th>
                                        <th className="px-4 py-3">Vessel</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Status</th>
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
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {report.vessel_type || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {report.report_date}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(report.status)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="outline" asChild>
                                                        <Link href={`/reports/${report.id}`}>
                                                            <Eye className="size-3.5 mr-1" /> View / Fill
                                                        </Link>
                                                    </Button>
                                                    {report.can_delete && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60"
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

                        {/* Pagination */}
                        {reports.last_page > 1 && (
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                                <div>
                                    Showing page {reports.current_page} of {reports.last_page} ({reports.total} total)
                                </div>
                                <div className="flex gap-2">
                                    {reports.prev_page_url && (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={reports.prev_page_url}>Previous</Link>
                                        </Button>
                                    )}
                                    {reports.next_page_url && (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={reports.next_page_url}>Next</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
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

                    <DialogFooter className="gap-2 sm:gap-0">
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
