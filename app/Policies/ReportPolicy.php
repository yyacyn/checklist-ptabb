<?php

namespace App\Policies;

use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\User;
use App\Services\VesselName;

/**
 * Access control and authorization matrix for reports (SRS section 2, PLAN 1.10).
 */
class ReportPolicy
{
    /**
     * Superadmins bypass standard policy checks.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->role === 'superadmin') {
            if ($ability === 'delete') {
                return null;
            }

            return true;
        }

        if (! $user->is_active) {
            return false;
        }

        return null;
    }

    /**
     * Determine whether the user can view the reports index.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view a specific report.
     */
    public function view(User $user, Report $report): bool
    {
        if ($user->role === 'corporate') {
            return true;
        }

        if ($user->role === 'vessel') {
            return VesselName::matches($report->vessel_name, $user->vessel_name);
        }

        return false;
    }

    /**
     * Determine whether the user can create a report of the given type.
     */
    public function create(User $user, string $reportType): bool
    {
        if ($user->role === 'corporate') {
            return $reportType === 'inspection';
        }

        if ($user->role === 'vessel') {
            return $reportType === 'audit';
        }

        return false;
    }

    /**
     * Determine whether the user can edit/answer a report.
     */
    public function update(User $user, Report $report): bool
    {
        $status = ReportStatus::tryFrom($report->status);
        if ($status === null || ! $status->isEditable()) {
            return false;
        }

        if ($user->role === 'corporate') {
            // Corporate users edit D-062 inspections; audits are read-only for corporate
            return $report->report_type === 'inspection';
        }

        if ($user->role === 'vessel') {
            // Vessel users only edit B-008 audits for their assigned vessel
            return $report->report_type === 'audit'
                && VesselName::matches($report->vessel_name, $user->vessel_name);
        }

        return false;
    }

    /**
     * Determine whether the user can delete a report (RLS-8).
     *
     * Only 'draft' or 'in_progress' reports can be deleted.
     */
    public function delete(User $user, Report $report): bool
    {
        if (! in_array($report->status, ['draft', 'in_progress'], true)) {
            return false;
        }

        if ($user->role === 'superadmin') {
            return true;
        }

        if ($user->role === 'corporate') {
            return $report->report_type === 'inspection';
        }

        if ($user->role === 'vessel') {
            return $report->report_type === 'audit'
                && $report->created_by === $user->id
                && VesselName::matches($report->vessel_name, $user->vessel_name);
        }

        return false;
    }

    /**
     * Determine whether the user can submit the report for review.
     */
    public function submit(User $user, Report $report): bool
    {
        $status = ReportStatus::tryFrom($report->status);
        if ($status === null || ! $status->isEditable()) {
            return false;
        }

        if ($user->role === 'corporate') {
            return $report->report_type === 'inspection';
        }

        if ($user->role === 'vessel') {
            return $report->report_type === 'audit'
                && VesselName::matches($report->vessel_name, $user->vessel_name);
        }

        return false;
    }

    /**
     * Determine whether the user can mark a submitted report as reviewed.
     */
    public function review(User $user, Report $report): bool
    {
        return $user->role === 'corporate' && $report->status === ReportStatus::Submitted->value;
    }

    /**
     * Determine whether the user can return a report to its author for correction (RLS-5).
     */
    public function reopen(User $user, Report $report): bool
    {
        return $user->role === 'corporate'
            && in_array($report->status, [ReportStatus::Submitted->value, ReportStatus::Reviewed->value], true);
    }

    /**
     * Determine whether the user can close a report (RLS-9: final).
     */
    public function close(User $user, Report $report): bool
    {
        return $user->role === 'corporate' && $report->status === ReportStatus::Reviewed->value;
    }

    /**
     * Determine whether the user can view B-008 auditee evaluation scores (SRS section 2, AUD-11).
     *
     * Only Corporate Users, Superadmins, and the author who created the audit can view.
     * Other vessel crew members never see them.
     */
    public function viewAuditeeEvaluations(User $user, Report $report): bool
    {
        if ($user->role === 'corporate') {
            return true;
        }

        if ($user->role === 'vessel') {
            return $report->created_by === $user->id
                && VesselName::matches($report->vessel_name, $user->vessel_name);
        }

        return false;
    }

    /**
     * Determine whether the user can view D-062 appraisals and chapter ratings (SRS section 2).
     *
     * Corporate users can view. Vessel users cannot view appraisals or ratings.
     */
    public function viewAppraisals(User $user, Report $report): bool
    {
        return $user->role === 'corporate';
    }
}
