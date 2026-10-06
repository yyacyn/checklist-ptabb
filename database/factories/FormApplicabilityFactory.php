<?php

namespace Database\Factories;

use App\Models\FormApplicability;
use App\Models\VesselType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FormApplicability>
 */
class FormApplicabilityFactory extends Factory
{
    protected $model = FormApplicability::class;

    public function definition(): array
    {
        return [
            'form_group_id' => null,
            'form_question_id' => null,
            'vessel_type_id' => VesselType::factory(),
            'ice_class_only' => false,
        ];
    }
}
