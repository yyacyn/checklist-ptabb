<?php

namespace Database\Factories;

use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\ReportQuestion;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReportAnswer>
 */
class ReportAnswerFactory extends Factory
{
    protected $model = ReportAnswer::class;

    public function definition(): array
    {
        return [
            'report_question_id' => ReportQuestion::factory(),
            'report_id' => fn (array $attributes) => ReportQuestion::find($attributes['report_question_id'])?->report_id ?? Report::factory(),
            'answer' => fake()->randomElement(['yes', 'no', 'ns', 'na']),
            'note' => null,
            'extra_value' => null,
            'answered_by' => User::factory(),
            'answered_at' => now(),
            'client_save_id' => Str::uuid()->toString(),
            'row_version' => 1,
        ];
    }
}
