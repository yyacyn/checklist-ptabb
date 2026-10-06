<?php

namespace App\Models;

use Carbon\Carbon;
use Database\Factories\ReportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A concrete inspection or audit report for a specific vessel visit.
 *
 * @property int $id
 * @property string $report_type
 * @property int $form_id
 * @property int $template_version
 * @property string $reference_number
 * @property string $status
 * @property string $vessel_name
 * @property string|null $vessel_imo
 * @property string|null $vessel_flag
 * @property string|null $vessel_gt
 * @property int|null $vessel_built
 * @property int|null $vessel_type_id
 * @property bool $vessel_ice_class
 * @property Carbon $report_date
 * @property string|null $master_name
 * @property string|null $chief_engineer_name
 * @property string|null $chief_officer_name
 * @property int $current_version
 * @property int $created_by
 * @property Carbon|null $submitted_at
 * @property int|null $reviewed_by
 * @property Carbon|null $closed_at
 * @property int|null $lock_owner_id
 * @property Carbon|null $lock_expires_at
 * @property string|null $delete_reason
 */
#[Fillable([
    'report_type',
    'form_id',
    'template_version',
    'reference_number',
    'status',
    'vessel_name',
    'vessel_imo',
    'vessel_flag',
    'vessel_gt',
    'vessel_built',
    'vessel_type_id',
    'vessel_ice_class',
    'report_date',
    'master_name',
    'chief_engineer_name',
    'chief_officer_name',
    'current_version',
    'created_by',
    'submitted_at',
    'reviewed_by',
    'closed_at',
    'lock_owner_id',
    'lock_expires_at',
    'delete_reason',
])]
class Report extends Model
{
    /** @use HasFactory<ReportFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'template_version' => 'integer',
            'vessel_gt' => 'decimal:2',
            'vessel_built' => 'integer',
            'vessel_ice_class' => 'boolean',
            'report_date' => 'date',
            'current_version' => 'integer',
            'submitted_at' => 'datetime',
            'closed_at' => 'datetime',
            'lock_expires_at' => 'datetime',
        ];
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function vesselType(): BelongsTo
    {
        return $this->belongsTo(VesselType::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function lockOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lock_owner_id');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(ReportGroup::class)->orderBy('sort_order');
    }

    public function topLevelGroups(): HasMany
    {
        return $this->hasMany(ReportGroup::class)->whereNull('parent_id')->orderBy('sort_order');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(ReportQuestion::class)->orderBy('sort_order');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ReportAnswer::class);
    }
}
