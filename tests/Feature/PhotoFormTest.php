<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use Database\Seeders\FormSeeder;
use Database\Seeders\PhotoCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PhotoFormTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([FormSeeder::class, PhotoCategorySeeder::class]);
    }

    public function test_photo_form_is_available_for_standalone_report_creation(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $response = $this->actingAs($corporate)->get(route('reports.create'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('reports/create')
            ->where('forms', fn ($forms) => collect($forms)->contains('code', 'P-001'))
        );
    }

    public function test_user_can_create_standalone_photo_report(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $vesselType = VesselType::firstOrFail();
        $photoForm = Form::where('code', 'P-001')->firstOrFail();

        $response = $this->actingAs($corporate)->post(route('reports.store'), [
            'form_id' => $photoForm->id,
            'vessel_name' => 'MV Oceanic Star',
            'vessel_imo' => '9123456',
            'vessel_flag' => 'Panama',
            'vessel_gt' => 28000,
            'vessel_built' => 2018,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-09',
            'inspected_by' => 'Capt. Superintendent',
        ]);

        $report = Report::where('form_id', $photoForm->id)->firstOrFail();

        $response->assertRedirect(route('reports.show', $report->id));
        $this->assertEquals('MV Oceanic Star', $report->vessel_name);
        $this->assertStringStartsWith('P001-20261009-', $report->reference_number);
    }

    public function test_user_can_save_and_update_photo_section_comment(): void
    {
        $user = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $photoForm = Form::where('code', 'P-001')->firstOrFail();
        $report = Report::create([
            'report_type' => 'photo',
            'form_id' => $photoForm->id,
            'template_version' => 1,
            'reference_number' => 'P001-20261013-01',
            'status' => 'draft',
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        // 1. Save comment for section 1
        $response = $this->actingAs($user)->postJson(route('reports.photo-section-comment', $report->id), [
            'section_key' => '1',
            'comment' => 'General overview shows vessel is well maintained.',
        ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'saved',
                'section_key' => '1',
                'comment' => 'General overview shows vessel is well maintained.',
            ]);

        $report->refresh();
        $this->assertEquals('General overview shows vessel is well maintained.', $report->summary_data['photo_section_comments']['1']);

        // 2. Save comment for section 2
        $this->actingAs($user)->postJson(route('reports.photo-section-comment', $report->id), [
            'section_key' => '2',
            'comment' => 'Hull and deck area has minor rust on starboard side.',
        ])->assertOk();

        $report->refresh();
        $this->assertEquals('Hull and deck area has minor rust on starboard side.', $report->summary_data['photo_section_comments']['2']);

        // 3. Clear comment for section 1
        $this->actingAs($user)->postJson(route('reports.photo-section-comment', $report->id), [
            'section_key' => '1',
            'comment' => '',
        ])->assertOk();

        $report->refresh();
        $this->assertArrayNotHasKey('1', $report->summary_data['photo_section_comments']);
        $this->assertEquals('Hull and deck area has minor rust on starboard side.', $report->summary_data['photo_section_comments']['2']);
    }

    public function test_photo_form_pdf_renders_sections_and_comments(): void
    {
        $user = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $photoForm = Form::where('code', 'P-001')->firstOrFail();
        $report = Report::create([
            'report_type' => 'photo',
            'form_id' => $photoForm->id,
            'template_version' => 1,
            'reference_number' => 'P001-20261013-02',
            'status' => 'draft',
            'vessel_name' => 'MV Section Tester',
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
            'summary_data' => [
                'photo_section_comments' => [
                    '1' => 'Bridge equipment tested and found in order.',
                ],
            ],
        ]);

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('General View / Overview', $html);
        $this->assertStringContainsString('Section Comments / Remarks:', $html);
        $this->assertStringContainsString('Bridge equipment tested and found in order.', $html);
        $this->assertStringContainsString('No comments recorded for this section.', $html);
    }
}
