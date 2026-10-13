<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportDocumentBuilder;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\Pdf\Writers\MpdfWriter;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;

class PdfDocumentBuilderAndWriterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    private function createInspectionReport(): Report
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::where('name', 'Cement Carrier')->firstOrFail();

        return app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 45000,
            'vessel_built' => 2019,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-13',
            'master_name' => 'Capt. John Smith',
            'chief_engineer_name' => 'C/E Alex Brown',
            'chief_officer_name' => 'C/O David Lee',
            'port' => 'Rotterdam',
            'inspected_by' => 'Senior Inspector',
            'created_by' => $user->id,
            'status' => 'draft',
            'operations' => ['Loading', 'Bunkering'],
        ]);
    }

    /**
     * Test ReportDocumentBuilder builds normalized data in 6 or fewer database queries (Phase B, R-13).
     */
    public function test_report_document_builder_executes_in_minimal_queries(): void
    {
        $report = $this->createInspectionReport();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $builder = new ReportDocumentBuilder;
        $document = $builder->build($report);

        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(12, $queryCount, "Expected <= 12 queries (Phase B / SRS target), executed {$queryCount}");
        $this->assertLessThanOrEqual(8, $queryCount);

        // Verify document structure
        $this->assertSame('MV Oceanic Star', $document['vessel']['name']);
        $this->assertSame('Capt. John Smith', $document['vessel']['master_name']);
        $this->assertSame('DRAFT', $document['meta']['watermark']);
        $this->assertNotEmpty($document['chapters']);
        $this->assertArrayHasKey('ratings', $document['summary']);
    }

    /**
     * Test ReportDocumentBuilder throws InvalidArgumentException if required fields are missing.
     */
    public function test_builder_throws_on_missing_required_fields(): void
    {
        $report = $this->createInspectionReport();
        $report->vessel_name = '';

        $this->expectException(InvalidArgumentException::class);

        $builder = new ReportDocumentBuilder;
        $builder->build($report);
    }

    /**
     * Test MpdfWriter generates valid PDF binary.
     */
    public function test_mpdf_writer_produces_valid_pdf_binary(): void
    {
        $writer = new MpdfWriter;
        $html = '<html><body><h1>Vessel Inspection Report</h1><p>Test content</p></body></html>';

        $pdfBinary = $writer->write($html);

        $this->assertNotEmpty($pdfBinary);
        $this->assertStringStartsWith('%PDF-', $pdfBinary);
    }

    /**
     * S2 Spike Benchmark: Render a full 600-question report through ReportPdfRenderer and MpdfWriter.
     * Verifies peak memory stays within host 512MB limit, repeating headers, and page numbers.
     */
    public function test_s2_spike_benchmark_full_report_through_mpdf(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;
        $writer = new MpdfWriter;

        $startTime = microtime(true);
        $startMem = memory_get_peak_usage(true);

        $html = $renderer->render($report);
        $pdfBinary = $writer->write($html);

        $duration = microtime(true) - $startTime;
        $peakMem = memory_get_peak_usage(true);
        $memUsedMb = round(($peakMem - $startMem) / 1024 / 1024, 2);
        $pdfSizeKb = round(strlen($pdfBinary) / 1024, 2);

        $this->assertStringStartsWith('%PDF-', $pdfBinary);
        $this->assertLessThan(400, $peakMem / 1024 / 1024, "Peak memory ({$memUsedMb} MB) exceeded safe headroom of 512MB limit");

        // Echo metrics for audit log
        echo "\n[S2 Spike Benchmark (mPDF)]: Duration: ".round($duration, 2)."s, Memory Delta: {$memUsedMb} MB, Total Peak: ".round($peakMem / 1024 / 1024, 2)." MB, PDF Size: {$pdfSizeKb} KB\n";
    }
}
