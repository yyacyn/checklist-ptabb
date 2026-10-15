<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\VesselTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property bool $is_active
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['name', 'is_active'])]
class VesselType extends Model
{
    /** @use HasFactory<VesselTypeFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Historical or active reports that referenced this vessel type.
     */
    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    /**
     * Form applicability rules configured for this vessel type.
     */
    public function formApplicabilities(): HasMany
    {
        return $this->hasMany(FormApplicability::class);
    }
}
