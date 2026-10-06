<?php

namespace Database\Factories;

use App\Models\VesselType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VesselType>
 */
class VesselTypeFactory extends Factory
{
    protected $model = VesselType::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word().' Carrier',
            'is_active' => true,
        ];
    }
}
