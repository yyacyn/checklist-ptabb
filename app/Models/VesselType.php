<?php

namespace App\Models;

use Database\Factories\VesselTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property bool $is_active
 */
#[Fillable(['name', 'is_active'])]
class VesselType extends Model
{
    /** @use HasFactory<VesselTypeFactory> */
    use HasFactory;
}
