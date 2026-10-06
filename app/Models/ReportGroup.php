<?php

namespace App\Models;

use Database\Factories\ReportGroupFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A chapter or subgroup copied into the report snapshot (SRS FM-8).
 *
 * @property int $id
 * @property int $report_id
 * @property int|null $source_group_id
 * @property int|null $parent_id
 * @property string $title
 * @property string|null $chapter_no
 * @property int $sort_order
 * @property bool $is_applicable
 * @property string|null $na_reason
 * @property string|null $comments
 */
#[Fillable([
    'report_id',
    'source_group_id',
    'parent_id',
    'title',
    'chapter_no',
    'sort_order',
    'is_applicable',
    'na_reason',
    'comments',
])]
class ReportGroup extends Model
{
    /** @use HasFactory<ReportGroupFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_applicable' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function sourceGroup(): BelongsTo
    {
        return $this->belongsTo(FormGroup::class, 'source_group_id');
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
        return $this->hasMany(ReportQuestion::class)->orderBy('sort_order');
    }
}
