<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutoFillReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    public function test_can_auto_fill_report_by_reference_number(): void
    {
        $user = User::factory()->create(['role' => 'vessel', 'is_active' => true]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::first();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Explorer',
            'vessel_imo' => '9123456',
            'vessel_flag' => 'Singapore',
            'vessel_gt' => 20000,
            'vessel_built' => 2020,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'audit',
        ]);

        $response = $this->actingAs($user)->get("/auto/{$report->reference_number}");

        $response->assertRedirect(route('reports.show', $report->id));

        $freshReport = $report->fresh();
        $this->assertNotEmpty($freshReport->master_name);
        $this->assertNotEmpty($freshReport->summary_data['audit_type']);
        $this->assertGreaterThan(0, $freshReport->answers()->count());
        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_people',
        ]);
        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_evaluation',
        ]);
        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_execution_log',
        ]);
        $this->assertDatabaseHas('findings', [
            'report_id' => $report->id,
            'finding_no' => 'NC-01',
        ]);
    }

    public function test_can_auto_fill_report_by_numeric_id(): void
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::first();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Cargo Titan',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Panama',
            'vessel_gt' => 35000,
            'vessel_built' => 2019,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'inspection',
        ]);

        $response = $this->actingAs($user)->get("/auto/{$report->id}");

        $response->assertRedirect(route('reports.show', $report->id));

        $freshReport = $report->fresh();
        $this->assertNotEmpty($freshReport->summary_ratings);
        $this->assertNotEmpty($freshReport->summary_data['best_practices']);
        $this->assertGreaterThan(0, $freshReport->answers()->count());
    }
}
