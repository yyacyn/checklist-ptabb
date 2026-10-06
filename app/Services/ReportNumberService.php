<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Generates transactional, collision-safe reference numbers (SRS RLS-7, ERD §7.1).
 *
 * Format: FORMCODE-YYYYMMDD-NN (e.g. D062-20261005-01, B008-20261005-02).
 * - Form code without hyphens
 * - Report date entered by inspector (YYYYMMDD)
 * - Daily 2-digit sequence with daily rollover
 */
class ReportNumberService
{
    /**
     * Generate the next available reference number for a given form and report date.
     */
    public static function nextReferenceNumber(Form $form, Carbon|string $reportDate): string
    {
        $parsedDate = $reportDate instanceof Carbon
            ? $reportDate
            : Carbon::parse($reportDate);

        $formCode = str_replace('-', '', strtoupper($form->code));
        $dateStr = $parsedDate->format('Ymd');
        $prefix = "{$formCode}-{$dateStr}-";

        return DB::transaction(function () use ($prefix) {
            // Find the highest sequence number for this form and day (including soft-deleted)
            $latest = Report::withTrashed()
                ->where('reference_number', 'like', "{$prefix}%")
                ->lockForUpdate()
                ->orderByDesc('reference_number')
                ->value('reference_number');

            if ($latest) {
                $lastSequence = (int) substr($latest, strlen($prefix));
                $nextSequence = $lastSequence + 1;
            } else {
                $nextSequence = 1;
            }

            return sprintf('%s%02d', $prefix, $nextSequence);
        });
    }
}
