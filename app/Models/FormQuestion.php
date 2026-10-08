<?php

namespace App\Models;

use Database\Factories\FormQuestionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $group_id
 * @property string $question_text
 * @property string|null $guidance
 * @property string $input_type
 * @property int $sort_order
 * @property bool $is_enabled
 * @property string|null $source_key
 * @property string|null $source_ref
 */
#[Fillable(['group_id', 'question_text', 'guidance', 'input_type', 'sort_order', 'is_enabled', 'archived_at', 'source_key', 'source_ref'])]
class FormQuestion extends Model
{
    /** @use HasFactory<FormQuestionFactory> */
    use HasFactory;

    public const INPUT_TYPES = ['none', 'date', 'text', 'number', 'text_only', 'date_only'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(FormGroup::class);
    }

    public function applicability(): HasMany
    {
        return $this->hasMany(FormApplicability::class);
    }

    public function scopeLive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function hasTypedInput(): bool
    {
        return in_array($this->input_type, ['date', 'text', 'number', 'text_only', 'date_only'], true);
    }

    /**
     * Whether this question has been used in any report (SRS FM-9).
     */
    public function isUsedInReports(): bool
    {
        return ReportQuestion::query()->where('source_question_id', $this->id)->exists();
    }

    public function reportsCount(): int
    {
        return ReportQuestion::query()->where('source_question_id', $this->id)->count();
    }
}
