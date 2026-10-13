<?php

namespace App\Jobs;

use App\Models\Report;
use App\Services\Pdf\ReportPdfRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Queued PDF generation job on dedicated 'pdf' queue (REP-6, Plan Phase 6F).
 */
class GenerateReportPdf implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct(public Report $report, public bool $force = false)
    {
        $this->onQueue('pdf');
    }

    /**
     * Execute the job.
     */
    public function handle(ReportPdfRenderer $renderer): void
    {
        $renderer->generatePdfFile($this->report, $this->force);
    }
}
