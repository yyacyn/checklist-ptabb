<?php

namespace Database\Factories;

use App\Models\Form;
use App\Models\FormGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FormGroup>
 */
class FormGroupFactory extends Factory
{
    protected $model = FormGroup::class;

    public function definition(): array
    {
        return [
            'form_id' => Form::factory(),
            'parent_id' => null,
            'title' => fake()->sentence(3),
            'chapter_no' => null,
            'sort_order' => 1,
            'is_enabled' => true,
            'ice_class_only' => false,
            'archived_at' => null,
        ];
    }
}
