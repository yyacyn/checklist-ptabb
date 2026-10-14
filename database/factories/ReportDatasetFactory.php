<?php

namespace Database\Factories;

use App\Models\Report;
use App\Models\ReportDataset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportDataset>
 */
class ReportDatasetFactory extends Factory
{
    protected $model = ReportDataset::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'dataset_key' => 'audit_people',
            'rows' => [
                [
                    'name' => fake()->name(),
                    'rank' => 'Lead Auditor',
                    'role' => 'Lead auditor',
                ],
            ],
            'row_version' => 1,
            'client_save_id' => fake()->uuid(),
        ];
    }
}
