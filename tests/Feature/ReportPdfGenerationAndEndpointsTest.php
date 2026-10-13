<?php

namespace Tests\Feature;

use App\Jobs\GenerateReportPdf;
use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReportPdfGenerationAndEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed(FormSeeder::class);
    }

    private function createInspectionReport(array $overrides = []): Report
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::where('name', 'Cement Carrier')->firstOrFail();

        return app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Oceanic Titan',
            'vessel_imo' => '9123456',
            'vessel_flag' => 'Liberia',
            'vessel_gt' => 28000,
            'vessel_built' => 2017,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-13',
            'port' => 'Singapore',
            'inspected_by' => 'Lead Surveyor',
            'created_by' => $user->id,
            'status' => 'draft',
            'operations' => ['Loading', 'Bunkering'],
        ], $overrides));
    }

    /**
     * Test generating PDF binary and caching file to disk with deterministic path (REP-6).
     */
    public function test_generate_pdf_file_caches_pdf_to_disk_and_updates_model(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;

        $path = $renderer->generatePdfFile($report);

        $this->assertNotEmpty($path);
        Storage::disk('public')->assertExists($path);

        $report->refresh();
        $this->assertSame($path, $report->pdf_path);
        $this->assertSame($report->current_version, $report->pdf_version);
        $this->assertFalse($renderer->isCacheStale($report));
    }

    /**
     * Test query count during complete PDF generation is <= 12 queries.
     */
    public function test_query_count_during_pdf_generation_is_minimal(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;

        DB::flushQueryLog();
        DB::enableQueryLog();

        $renderer->render($report);

        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(12, $queryCount, "Expected <= 12 queries, actual {$queryCount}");
    }

    /**
     * Test status transition invalidates the cache (REP-6).
     */
    public function test_status_transition_invalidates_pdf_cache(): void
    {
        $report = $this->createInspectionReport(['status' => 'draft']);
        $renderer = new ReportPdfRenderer;

        $path = $renderer->generatePdfFile($report);
        $this->assertFalse($renderer->isCacheStale($report));

        // Transition status to submitted
        $report->update(['status' => 'submitted']);
        $report->refresh();

        $this->assertTrue($renderer->isCacheStale($report));
    }

    /**
     * Test queued GenerateReportPdf job handles generation.
     */
    public function test_generate_report_pdf_job_executes(): void
    {
        $report = $this->createInspectionReport();

        $job = new GenerateReportPdf($report);
        $job->handle(new ReportPdfRenderer);

        $report->refresh();
        $this->assertNotNull($report->pdf_path);
        Storage::disk('public')->assertExists($report->pdf_path);
    }

    /**
     * Test GET /reports/{report}/pdf streams PDF inline.
     */
    public function test_view_pdf_endpoint_streams_pdf_inline(): void
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $report = $this->createInspectionReport(['created_by' => $user->id]);

        $response = $this->actingAs($user)->get(route('reports.pdf.view', $report->id));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition') ?? '');
    }

    /**
     * Test GET /reports/{report}/pdf/download triggers attachment download.
     */
    public function test_download_pdf_endpoint_downloads_pdf_attachment(): void
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $report = $this->createInspectionReport(['created_by' => $user->id]);

        $response = $this->actingAs($user)->get(route('reports.pdf.download', $report->id));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    /**
     * Test unauthorized vessel user cannot download PDF of another vessel.
     */
    public function test_unauthorized_vessel_user_cannot_view_or_download_pdf(): void
    {
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Different Vessel',
            'is_active' => true,
        ]);
        $report = $this->createInspectionReport(['vessel_name' => 'MV Oceanic Titan']);

        $response = $this->actingAs($vesselUser)->get(route('reports.pdf.view', $report->id));
        $response->assertForbidden();

        $downloadResponse = $this->actingAs($vesselUser)->get(route('reports.pdf.download', $report->id));
        $downloadResponse->assertForbidden();
    }
}
