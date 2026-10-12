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
            'layout_schema' => [
                'sections' => [
                    ['type' => 'cover', 'title_key' => 'inspection_report'],
                    ['type' => 'general_info', 'title' => 'Chapter 1 - General Information'],
                    ['type' => 'checklist_chapters'],
                    ['type' => 'best_practices', 'chapter_no' => '14'],
                    ['type' => 'summary_of_observations', 'chapter_no' => '15'],
                    ['type' => 'report_summary'],
                    ['type' => 'photo_chapter', 'chapter_no' => '16'],
                    ['type' => 'comparison_blocks'],
                    ['type' => 'circulation'],
                    ['type' => 'signature_lines'],
                ],
                'footer' => [
                    'fields' => ['form_code', 'form_version', 'template_version', 'report_number', 'generation_date', 'page_number'],
                ],
                'watermark' => ['draft_label' => 'DRAFT'],
                'photo_appendix_threshold' => 100,
            ],
        ];
    }
}
