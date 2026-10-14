<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Auditor entity for B-008 internal audits (AUD-3).
 *
 * @property int $id
 * @property int $report_id
 * @property string $name
 * @property string $rank
 * @property bool $is_lead
 * @property int|null $user_id
 * @property int $sort_order
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable([
    'report_id',
    'name',
    'rank',
    'is_lead',
    'user_id',
    'sort_order',
])]
class Auditor extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'is_lead' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
