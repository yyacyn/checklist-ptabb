<?php

namespace Database\Factories;

use App\Models\Report;
use App\Models\ReportGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportGroup>
 */
class ReportGroupFactory extends Factory
{
    protected $model = ReportGroup::class;

    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'source_group_id' => null,
            'parent_id' => null,
            'title' => fake()->sentence(3),
            'chapter_no' => null,
            'sort_order' => fake()->numberBetween(1, 20),
            'is_applicable' => true,
            'na_reason' => null,
            'comments' => null,
        ];
    }
}
