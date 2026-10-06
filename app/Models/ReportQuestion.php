<?php

namespace App\Models;

use Database\Factories\ReportQuestionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A question copied into the report snapshot (SRS FM-8).
 *
 * @property int $id
 * @property int $report_group_id
 * @property int $report_id
 * @property int|null $source_question_id
 * @property string $question_text
 * @property string|null $guidance
 * @property string $input_type
 * @property int $sort_order
 * @property bool $is_applicable
 * @property string|null $applicable_reason
 * @property string|null $na_reason
 */
#[Fillable([
    'report_group_id',
    'report_id',
    'source_question_id',
    'question_text',
    'guidance',
    'input_type',
    'sort_order',
    'is_applicable',
    'applicable_reason',
    'na_reason',
])]
class ReportQuestion extends Model
{
    /** @use HasFactory<ReportQuestionFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_applicable' => 'boolean',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ReportGroup::class, 'report_group_id');
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function sourceQuestion(): BelongsTo
    {
        return $this->belongsTo(FormQuestion::class, 'source_question_id');
    }

    public function answer(): HasOne
    {
        return $this->hasOne(ReportAnswer::class);
    }
}
