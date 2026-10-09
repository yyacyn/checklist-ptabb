<?php

namespace App\Models;

use App\Services\VesselName;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A photograph entity representing inspection/audit photographic records and evidence (SRS §8, PHO-1, PHO-2, PHO-5).
 *
 * @property int $id
 * @property int|null $report_id
 * @property int|null $report_question_id
 * @property int|null $finding_id
 * @property int|null $photo_category_id
 * @property string $vessel_name
 * @property int $item_no
 * @property string|null $title
 * @property string|null $caption
 * @property string|null $description
 * @property string|null $location
 * @property string $original_filename
 * @property string $file_path
 * @property string|null $thumbnail_path
 * @property int $file_size
 * @property string $mime_type
 * @property string|null $checksum
 * @property int $uploaded_by
 * @property Carbon|null $captured_at
 * @property int $sort_order
 * @property string|null $delete_reason
 * @property Carbon|null $deleted_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable([
    'report_id',
    'report_question_id',
    'finding_id',
    'photo_category_id',
    'vessel_name',
    'item_no',
    'title',
    'caption',
    'description',
    'location',
    'original_filename',
    'file_path',
    'thumbnail_path',
    'file_size',
    'mime_type',
    'checksum',
    'uploaded_by',
    'captured_at',
    'sort_order',
    'delete_reason',
])]
class Photo extends Model
{
    use HasFactory, SoftDeletes;

    protected static function booted(): void
    {
        static::saving(function (self $photo) {
            if ($photo->vessel_name !== null) {
                $photo->vessel_name = VesselName::normalize($photo->vessel_name);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'item_no' => 'integer',
            'file_size' => 'integer',
            'sort_order' => 'integer',
            'captured_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ReportQuestion::class, 'report_question_id');
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(Finding::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(PhotoCategory::class, 'photo_category_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
