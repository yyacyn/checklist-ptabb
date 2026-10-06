<?php

namespace App\Models;

use Carbon\Carbon;
use Database\Factories\ReportAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An answer to a snapshot question.
 *
 * @property int $id
 * @property int $report_question_id
 * @property int $report_id
 * @property string|null $answer
 * @property string|null $note
 * @property string|null $extra_value
 * @property int|null $answered_by
 * @property Carbon|null $answered_at
 * @property string|null $client_save_id
 * @property int $row_version
 */
#[Fillable([
    'report_question_id',
    'report_id',
    'answer',
    'note',
    'extra_value',
    'answered_by',
    'answered_at',
    'client_save_id',
    'row_version',
])]
class ReportAnswer extends Model
{
    /** @use HasFactory<ReportAnswerFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'answered_at' => 'datetime',
            'row_version' => 'integer',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ReportQuestion::class, 'report_question_id');
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function answeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'answered_by');
    }
}
