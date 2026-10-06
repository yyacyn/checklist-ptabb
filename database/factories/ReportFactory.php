<?php

namespace Database\Factories;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Report>
 */
class ReportFactory extends Factory
{
    protected $model = Report::class;

    public function definition(): array
    {
        return [
            'report_type' => 'inspection',
            'form_id' => Form::factory(),
            'template_version' => 1,
            'reference_number' => 'D062-'.now()->format('Ymd').'-'.fake()->unique()->numerify('##'),
            'status' => 'draft',
            'vessel_name' => 'MV '.fake()->city(),
            'vessel_imo' => fake()->numerify('#######'),
            'vessel_flag' => 'Panama',
            'vessel_gt' => fake()->randomFloat(2, 5000, 45000),
            'vessel_built' => fake()->numberBetween(2000, 2024),
            'vessel_type_id' => VesselType::factory(),
            'vessel_ice_class' => false,
            'report_date' => now()->toDateString(),
            'master_name' => fake()->name(),
            'chief_engineer_name' => fake()->name(),
            'chief_officer_name' => fake()->name(),
            'current_version' => 1,
            'created_by' => User::factory(),
        ];
    }
}
