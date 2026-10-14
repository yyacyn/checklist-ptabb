<?php

namespace App\Models;

use Database\Factories\ReportDatasetFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Generic repeating dataset storage per report (SRS 14.4, PLAN 7.1).
 *
 * Used for form-specific repeating pages without bespoke tables:
 * - audit_people (auditors and auditees)
 * - audit_evaluation (auditee criteria scoring 1-5)
 * - audit_execution_log (audit execution timetable)
 *
 * @property int $id
 * @property int $report_id
 * @property string $dataset_key
 * @property array $rows
 * @property int $row_version
 * @property string|null $client_save_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ReportDataset extends Model
{
    /** @use HasFactory<ReportDatasetFactory> */
    use HasFactory;

    protected $fillable = [
        'report_id',
        'dataset_key',
        'rows',
        'row_version',
        'client_save_id',
    ];

    protected $casts = [
        'rows' => 'array',
        'row_version' => 'integer',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }
}
