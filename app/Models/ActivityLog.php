<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

/**
 * Append-only audit trail (SRS NFR-9, NFR-17, ERD §6, §7.5).
 *
 * @property int $id
 * @property int|null $user_id
 * @property int|null $report_id
 * @property string $entity_type
 * @property int $entity_id
 * @property string $action
 * @property string|null $field
 * @property string|null $before_value
 * @property string|null $after_value
 * @property string|null $ip
 * @property Carbon $created_at
 */
#[Fillable([
    'user_id',
    'report_id',
    'entity_type',
    'entity_id',
    'action',
    'field',
    'before_value',
    'after_value',
    'ip',
    'created_at',
])]
class ActivityLog extends Model
{
    protected $table = 'activity_log';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'entity_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    /**
     * Record an audit event into the append-only activity log (SRS FM-7, NFR-9).
     *
     * @return static
     */
    public static function record(
        Model|string $entity,
        string $action,
        ?string $field = null,
        mixed $before = null,
        mixed $after = null,
        ?int $reportId = null
    ): self {
        $entityType = is_object($entity) ? $entity->getMorphClass() : $entity;
        $entityId = is_object($entity) ? $entity->getKey() : 0;

        return static::create([
            'user_id' => Auth::id(),
            'report_id' => $reportId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'field' => $field,
            'before_value' => is_scalar($before) || is_null($before) ? (string) $before : json_encode($before),
            'after_value' => is_scalar($after) || is_null($after) ? (string) $after : json_encode($after),
            'ip' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
