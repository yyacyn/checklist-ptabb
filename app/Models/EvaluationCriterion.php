<?php

namespace App\Models;

use Database\Factories\EvaluationCriterionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One of the seven B-008 auditee evaluation criteria, held as configuration so the
 * wording can change without a migration (ERD 14.4).
 *
 * @property int $id
 * @property int $form_id
 * @property string $criterion_key
 * @property string $label
 * @property string|null $description
 * @property int $sort_order
 */
#[Fillable(['form_id', 'criterion_key', 'label', 'description', 'sort_order'])]
class EvaluationCriterion extends Model
{
    /** @use HasFactory<EvaluationCriterionFactory> */
    use HasFactory;

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }
}
