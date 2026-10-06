<?php

namespace Database\Factories;

use App\Models\Report;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportQuestion>
 */
class ReportQuestionFactory extends Factory
{
    protected $model = ReportQuestion::class;

    public function definition(): array
    {
        return [
            'report_group_id' => ReportGroup::factory(),
            'report_id' => fn (array $attributes) => ReportGroup::find($attributes['report_group_id'])?->report_id ?? Report::factory(),
            'source_question_id' => null,
            'question_text' => fake()->sentence(8).'?',
            'guidance' => fake()->sentence(6),
            'input_type' => 'none',
            'sort_order' => fake()->numberBetween(1, 50),
            'is_applicable' => true,
            'applicable_reason' => null,
            'na_reason' => null,
        ];
    }
}
