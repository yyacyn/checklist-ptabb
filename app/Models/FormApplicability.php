<?php

namespace App\Models;

use Database\Factories\FormApplicabilityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Whether a group or a question applies to a vessel type, or only to ice class vessels.
 * A row points at a group or a question, never both (ERD 14.2).
 *
 * @property int $id
 * @property int|null $form_group_id
 * @property int|null $form_question_id
 * @property int|null $vessel_type_id
 * @property bool|null $ice_class_only
 */
#[Fillable(['form_group_id', 'form_question_id', 'vessel_type_id', 'ice_class_only'])]
class FormApplicability extends Model
{
    /** @use HasFactory<FormApplicabilityFactory> */
    use HasFactory;

    protected $table = 'form_applicability';

    public function group(): BelongsTo
    {
        return $this->belongsTo(FormGroup::class, 'form_group_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(FormQuestion::class, 'form_question_id');
    }

    public function vesselType(): BelongsTo
    {
        return $this->belongsTo(VesselType::class);
    }

    /**
     * Resolve applicability for one group against a report's typed particulars (SRS FM-4).
     *
     * Rules are restrictions: a group with no rules applies to everything, and a group
     * with rules applies only when at least one of them matches the vessel. A rule
     * matches on vessel type, or on the ice class flag.
     *
     * @param  list<int>  $vesselTypeIds
     */
    public static function appliesToGroup(FormGroup $group, array $vesselTypeIds, bool $iceClass): bool
    {
        $rules = static::query()
            ->whereIn('form_group_id', $group->ancestorsAndSelfIds())
            ->get();

        if ($rules->isEmpty()) {
            return true;
        }

        foreach ($rules as $rule) {
            if ($rule->ice_class_only && $iceClass) {
                return true;
            }
            if ($rule->vessel_type_id !== null && in_array((int) $rule->vessel_type_id, $vesselTypeIds, true)) {
                return true;
            }
        }

        return false;
    }
}
