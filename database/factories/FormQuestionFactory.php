<?php

namespace Database\Factories;

use App\Models\FormGroup;
use App\Models\FormQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FormQuestion>
 */
class FormQuestionFactory extends Factory
{
    protected $model = FormQuestion::class;

    public function definition(): array
    {
        return [
            'group_id' => FormGroup::factory(),
            'question_text' => fake()->sentence(8).'?',
            'guidance' => null,
            'input_type' => 'none',
            'sort_order' => 1,
            'is_enabled' => true,
            'archived_at' => null,
            'source_key' => fake()->unique()->slug(),
            'source_ref' => null,
        ];
    }
}
