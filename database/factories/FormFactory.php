<?php

namespace Database\Factories;

use App\Models\Form;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Form>
 */
class FormFactory extends Factory
{
    protected $model = Form::class;

    public function definition(): array
    {
        return [
            'code' => 'D-'.fake()->unique()->numerify('###'),
            'name' => 'Vessel Inspection Form',
            'form_version' => 'v01.01',
            'template_version' => 1,
            'answer_set' => 'd062_yes_no_ns_na',
        ];
    }
}
