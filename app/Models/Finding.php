<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An observation or non-conformity finding (Form D-062 Chapter 15, Form B-008, ERD §7.3, SRS FND-1).
 *
 * @property int $id
 * @property int $report_id
 * @property int|null $report_group_id
 * @property int|null $report_question_id
 * @property string|null $chapter_label
 * @property string $finding_kind
 * @property string|null $risk
 * @property string|null $severity
 * @property string $description
 * @property string|null $viq_paragraph
 * @property string|null $job_order_no
 * @property Carbon|null $target_date
 * @property string $finding_status
 * @property int|null $owner_user_id
 * @property Carbon|null $action_submitted_at
 * @property int|null $action_submitted_by
 * @property Carbon|null $verified_at
 * @property int|null $verified_by
 * @property int $reopened_count
 * @property int $sort_order
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable([
    'report_id',
    'report_group_id',
    'report_question_id',
    'chapter_label',
    'finding_kind',
    'risk',
    'severity',
    'description',
    'viq_paragraph',
    'job_order_no',
    'target_date',
    'finding_status',
    'owner_user_id',
    'action_submitted_at',
    'action_submitted_by',
    'verified_at',
    'verified_by',
    'reopened_count',
    'sort_order',
])]
class Finding extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'target_date' => 'date',
            'action_submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'reopened_count' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ReportGroup::class, 'report_group_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ReportQuestion::class, 'report_question_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function actionSubmittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'action_submitted_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }
}
