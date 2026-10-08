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
            'vessel_flag' => 'Panama',
            'vessel_gt' => 5000,
            'vessel_built' => 2015,
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

        $vesselType = VesselType::firstOrFail();

        // 1. Vessel user cannot create D-062 inspection
        $this->actingAs($vesselUser)
            ->post(route('reports.store'), [
                'form_id' => $d062->id,
                'vessel_name' => 'MV Meratus Java',
                'vessel_imo' => '9123456',
                'vessel_flag' => 'Indonesia',
                'vessel_gt' => 4500,
                'vessel_built' => 2018,
                'vessel_type_id' => $vesselType->id,
                'report_date' => '2026-10-06',
            ])
            ->assertForbidden();

        // 2. Vessel user can create B-008 audit, and vessel_name is enforced from account
        $response = $this->actingAs($vesselUser)
            ->post(route('reports.store'), [
                'form_id' => $b008->id,
                'vessel_name' => 'Another Ship', // Attempt to spoof
                'vessel_imo' => '9123456',
                'vessel_flag' => 'Indonesia',
                'vessel_gt' => 4500,
                'vessel_built' => 2018,
                'vessel_type_id' => $vesselType->id,
                'report_date' => '2026-10-06',
            ]);

        $report = Report::where('report_type', 'audit')->firstOrFail();
        $response->assertRedirect(route('reports.show', $report->id));

        // Assert forced to their assigned vessel
        $this->assertEquals('MV Meratus Java', $report->vessel_name);
    }

    public function test_corporate_user_can_create_report_with_all_general_info_fields(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $vesselType = VesselType::firstOrFail();

        $response = $this->actingAs($corporate)->post(route('reports.store'), [
            'form_id' => $form->id,
            'vessel_name' => 'MV Oceanic Leader',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Singapore',
            'vessel_gt' => 8500,
            'vessel_built' => 2017,
            'vessel_type_id' => $vesselType->id,
            'report_date' => '2026-10-06',
            'port' => 'Bojonegara',
            'inspected_by' => 'Rendy',
            'master_name' => 'Capt. Haddock',
            'chief_engineer_name' => 'C/E Calculus',
            'chief_officer_name' => 'C/O Tintin',
            'sailing_with_vessel' => true,
            'sailing_from' => 'Merak',
            'sailing_to' => 'Batam',
            'psc_last_port' => 'Tanjung Priok',
            'psc_last_date' => '2026-05-15',
            'psc_detained_or_deficiencies' => true,
            'drydock_last_date' => '2025-01-10',
            'drydock_next_date' => '2027-01-10',
            'operations' => ['Loading', 'Deballasting', 'At anchor'],
        ]);

        $report = Report::where('vessel_name', 'MV Oceanic Leader')->firstOrFail();
        $response->assertRedirect(route('reports.show', $report->id));

        $this->assertEquals('Bojonegara', $report->port);
        $this->assertEquals('Rendy', $report->inspected_by);
        $this->assertTrue($report->sailing_with_vessel);
        $this->assertEquals('Merak', $report->sailing_from);
        $this->assertEquals('Batam', $report->sailing_to);
        $this->assertEquals('Tanjung Priok', $report->psc_last_port);
        $this->assertEquals('2026-05-15', $report->psc_last_date->format('Y-m-d'));
        $this->assertTrue($report->psc_detained_or_deficiencies);
        $this->assertEquals('2025-01-10', $report->drydock_last_date->format('Y-m-d'));
        $this->assertEquals('2027-01-10', $report->drydock_next_date->format('Y-m-d'));
        $this->assertEquals(['Loading', 'Deballasting', 'At anchor'], $report->operations);
    }

    public function test_user_can_update_general_info_on_existing_report(): void
    {
        $user = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::firstOrFail();

        $this->actingAs($user)->post(route('reports.store'), [
            'form_id' => $form->id,
            'vessel_name' => 'MV Pacific Star',
            'vessel_imo' => '9554321',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 6200,
            'vessel_built' => 2019,
            'vessel_type_id' => $vesselType->id,
            'report_date' => '2026-10-06',
        ]);

        $report = Report::where('vessel_name', 'MV Pacific Star')->firstOrFail();

        $updateResponse = $this->actingAs($user)->put(route('reports.general-info.update', $report->id), [
            'report_date' => '2026-10-07',
            'port' => 'Singapore',
            'inspected_by' => 'Inspector Lee',
            'master_name' => 'Capt. Morgan',
            'chief_engineer_name' => 'C/E Sparrow',
            'chief_officer_name' => 'C/O Turner',
            'sailing_with_vessel' => false,
            'psc_last_port' => 'Jurong',
            'psc_last_date' => '2026-04-12',
            'psc_detained_or_deficiencies' => false,
            'drydock_last_date' => '2024-11-20',
            'drydock_next_date' => '2026-11-20',
            'operations' => ['Bunkering', 'Repairs under way'],
        ]);

        $updateResponse->assertOk()
            ->assertJson([
                'status' => 'saved',
            ]);

        $report->refresh();
        $this->assertEquals('2026-10-07', $report->report_date->format('Y-m-d'));
        $this->assertEquals('Singapore', $report->port);
        $this->assertEquals('Inspector Lee', $report->inspected_by);
        $this->assertEquals('Capt. Morgan', $report->master_name);
        $this->assertEquals('Jurong', $report->psc_last_port);
        $this->assertEquals('2026-04-12', $report->psc_last_date->format('Y-m-d'));
        $this->assertFalse($report->psc_detained_or_deficiencies);
        $this->assertEquals(['Bunkering', 'Repairs under way'], $report->operations);
    }
}
