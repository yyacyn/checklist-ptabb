<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    public function test_corporate_user_can_view_reports_index_and_create_page(): void
    {
        $user = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('reports/index'));

        $this->actingAs($user)
            ->get(route('reports.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('reports/create')
                ->has('forms')
                ->has('vessel_types')
                ->has('known_vessels')
            );
    }

    public function test_corporate_user_can_create_d062_inspection_with_snapshot(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $cementType = VesselType::where('name', 'Cement Carrier')->firstOrFail();

        $response = $this->actingAs($corporate)->post(route('reports.store'), [
            'form_id' => $form->id,
            'vessel_name' => '  MV Amarin Glory  ',
            'vessel_imo' => '9123456',
            'vessel_type_id' => $cementType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-06',
            'master_name' => 'Capt. John Doe',
            'chief_engineer_name' => 'C/E Smith',
            'port' => 'Singapore',
        ]);

        $this->assertDatabaseHas('reports', [
            'vessel_name' => 'MV Amarin Glory', // Normalised
            'vessel_imo' => '9123456',
            'report_type' => 'inspection',
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        $report = Report::where('vessel_name', 'MV Amarin Glory')->firstOrFail();
        $response->assertRedirect(route('reports.show', $report->id));

        // Assert snapshot copied groups and questions
        $this->assertGreaterThan(0, $report->groups()->count());
        $this->assertGreaterThan(0, $report->questions()->count());

        // Inapplicable check: Tanker-only items should be marked is_applicable=false on Cement Carrier
        $this->assertTrue(
            $report->groups()->where('is_applicable', false)->exists(),
            'Cement Carrier must have tanker-only chapters resolved as inapplicable.'
        );
    }

    public function test_vessel_user_can_only_create_audit_for_their_assigned_vessel(): void
    {
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Meratus Java',
            'is_active' => true,
        ]);

        $b008 = Form::where('code', 'B-008')->firstOrFail();
        $d062 = Form::where('code', 'D-062')->firstOrFail();

        // 1. Vessel user cannot create D-062 inspection
        $this->actingAs($vesselUser)
            ->post(route('reports.store'), [
                'form_id' => $d062->id,
                'vessel_name' => 'MV Meratus Java',
                'report_date' => '2026-10-06',
            ])
            ->assertForbidden();

        // 2. Vessel user can create B-008 audit, and vessel_name is enforced from account
        $response = $this->actingAs($vesselUser)
            ->post(route('reports.store'), [
                'form_id' => $b008->id,
                'vessel_name' => 'Another Ship', // Attempt to spoof
                'report_date' => '2026-10-06',
            ]);

        $report = Report::where('report_type', 'audit')->firstOrFail();
        $response->assertRedirect(route('reports.show', $report->id));

        // Assert forced to their assigned vessel
        $this->assertEquals('MV Meratus Java', $report->vessel_name);
    }
}
