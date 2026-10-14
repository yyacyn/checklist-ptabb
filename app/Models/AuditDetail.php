<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Audit Details for B-008 internal audits (AUD-3).
 *
 * @property int $id
 * @property int $report_id
 * @property Carbon|null $start_date
 * @property Carbon|null $end_date
 * @property string|null $audit_type
 * @property string|null $audit_type_other
 * @property string|null $lead_auditor
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable([
    'report_id',
    'start_date',
    'end_date',
    'audit_type',
    'audit_type_other',
    'lead_auditor',
])]
class AuditDetail extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }
}
