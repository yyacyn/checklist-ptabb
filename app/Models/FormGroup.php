<?php

namespace App\Models;

use Database\Factories\FormGroupFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A chapter or section of a template, and optionally a subgroup inside one.
 *
 * @property int $id
 * @property int $form_id
 * @property int|null $parent_id
 * @property string $title
 * @property string|null $chapter_no
 * @property int $sort_order
 * @property bool $is_enabled
 * @property bool $ice_class_only
 */
#[Fillable(['form_id', 'parent_id', 'title', 'chapter_no', 'sort_order', 'is_enabled', 'ice_class_only', 'archived_at'])]
class FormGroup extends Model
{
    /** @use HasFactory<FormGroupFactory> */
    use HasFactory;

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subgroups(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(FormQuestion::class, 'group_id')->orderBy('sort_order');
    }

    public function applicability(): HasMany
    {
        return $this->hasMany(FormApplicability::class);
    }

    /** Not archived. Archive, never delete, once a question has been used (SRS FM-9). */
    public function scopeLive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    /**
     * This group plus every ancestor, for resolving applicability: a subgroup inherits
     * the restrictions of the chapter it sits in (ERD 14.2).
     *
     * @return array<int, int>
     */
    public function ancestorsAndSelfIds(): array
    {
        $ids = [$this->id];
        $parentId = $this->parent_id;
        $guard = 0;

        while ($parentId !== null && $guard++ < 10) {
            $ids[] = $parentId;
            $parentId = static::query()->whereKey($parentId)->value('parent_id');
        }

        return $ids;
    }

    /**
     * Whether this group has been used in any report (SRS FM-9).
     */
    public function isUsedInReports(): bool
    {
        return ReportGroup::query()->where('source_group_id', $this->id)->exists();
    }

    public function reportsCount(): int
    {
        return ReportGroup::query()->where('source_group_id', $this->id)->count();
    }
}
