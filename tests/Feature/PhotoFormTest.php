<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
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
}
