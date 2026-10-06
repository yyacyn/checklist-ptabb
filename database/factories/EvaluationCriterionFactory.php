<?php

namespace Database\Factories;

use App\Models\EvaluationCriterion;
use App\Models\Form;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EvaluationCriterion>
 */
class EvaluationCriterionFactory extends Factory
{
    protected $model = EvaluationCriterion::class;

    public function definition(): array
    {
        return [
            'form_id' => Form::factory(),
            'criterion_key' => fake()->unique()->slug(),
            'label' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'sort_order' => 1,
        ];
    }
}
