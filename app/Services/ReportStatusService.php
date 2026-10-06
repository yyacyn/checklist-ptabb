<?php

namespace App\Services;

use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\ReportQuestion;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Report lifecycle state machine and server-side transition guard (SRS section 10, PLAN 1.7).
 */
class ReportStatusService
{
    /**
     * Map of permitted transitions from current status to allowed target statuses.
     *
     * Note: 'closed' has no outgoing transition (RLS-9: closed is final, never reopened).
     *
     * @var array<string, list<string>>
     */
    protected const ALLOWED_TRANSITIONS = [
        'draft' => ['in_progress', 'submitted'],
        'in_progress' => ['submitted'],
        'submitted' => ['reviewed', 'reopened'],
        'reviewed' => ['closed', 'reopened'],
        'reopened' => ['in_progress', 'submitted'],
        'closed' => [],
    ];

    /**
     * Get all applicable questions in the report that have not been answered (RLS-2).
     *
     * @return Collection<int, ReportQuestion>
     */
    public static function getUnansweredApplicableQuestions(Report $report): Collection
    {
        return $report->questions()
            ->where('is_applicable', true)
            ->where(function ($query) {
                $query->whereDoesntHave('answer')
                    ->orWhereHas('answer', function ($q) {
                        $q->whereNull('answer')->orWhere('answer', '');
                    });
            })
            ->get();
    }

    /**
     * Check if a transition is valid and authorized for the user.
     */
    public static function canTransitionTo(Report $report, ReportStatus|string $target, User $user, ?string $reason = null): bool
    {
        try {
            static::validateTransition($report, $target, $user, $reason);

            return true;
        } catch (ValidationException) {
            return false;
        }
    }

    /**
     * Validate transition rules and permissions. Throws ValidationException on failure.
     *
     * @throws ValidationException
     */
    public static function validateTransition(
        Report $report,
        ReportStatus|string $target,
        User $user,
        ?string $reason = null
    ): void {
        $targetStatus = $target instanceof ReportStatus ? $target->value : $target;
        $currentStatus = $report->status;

        // 1. Closed reports can never change status (RLS-9)
        if ($currentStatus === ReportStatus::Closed->value) {
            throw ValidationException::withMessages([
                'status' => ['A closed report is final and can never be reopened or changed (RLS-9).'],
            ]);
        }

        // 2. Validate allowed state transition
        $allowed = self::ALLOWED_TRANSITIONS[$currentStatus] ?? [];
        if (! in_array($targetStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot transition report status from '{$currentStatus}' to '{$targetStatus}'."],
            ]);
        }

        // 3. Role-based permissions
        if ($user->role === 'vessel') {
            // Vessel users can never review, reopen, or close reports
            if (in_array($targetStatus, ['reviewed', 'reopened', 'closed'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Vessel users are not authorized to review, reopen, or close reports.'],
                ]);
            }

            // Vessel users can only work on their own vessel's reports
            if (! VesselName::matches($report->vessel_name, $user->vessel_name)) {
                throw ValidationException::withMessages([
                    'status' => ['You are not authorized to submit reports for another vessel.'],
                ]);
            }
        }

        // 4. RLS-2: 'submitted' requires every applicable question answered
        if ($targetStatus === ReportStatus::Submitted->value) {
            $unanswered = static::getUnansweredApplicableQuestions($report);
            if ($unanswered->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'status' => [
                        sprintf(
                            'Cannot submit report: %d applicable question(s) remain unanswered (RLS-2).',
                            $unanswered->count()
                        ),
                    ],
                ]);
            }
        }

        // 5. RLS-5: 'reopened' requires a reason
        if ($targetStatus === ReportStatus::Reopened->value) {
            if ($reason === null || trim($reason) === '') {
                throw ValidationException::withMessages([
                    'reason' => ['A reason is required when returning a report for correction (RLS-5).'],
                ]);
            }
        }
    }

    /**
     * Execute a status transition on a report.
     *
     * @throws ValidationException
     */
    public static function transitionTo(
        Report $report,
        ReportStatus|string $target,
        User $user,
        ?string $reason = null
    ): Report {
        $targetStatus = $target instanceof ReportStatus ? $target->value : $target;

        static::validateTransition($report, $targetStatus, $user, $reason);

        $updates = [
            'status' => $targetStatus,
            'current_version' => $report->current_version + 1,
        ];

        if ($targetStatus === ReportStatus::Submitted->value) {
            $updates['submitted_at'] = now();
        } elseif ($targetStatus === ReportStatus::Reviewed->value) {
            $updates['reviewed_by'] = $user->id;
        } elseif ($targetStatus === ReportStatus::Closed->value) {
            $updates['closed_at'] = now();
        }

        $report->update($updates);

        return $report;
    }
}
