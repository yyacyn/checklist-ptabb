<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\User;
use App\Services\AutoFillReportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AutoFillReportController extends Controller
{
    /**
     * Auto-fill an existing report by ID or reference_number and redirect to its show page.
     *
     * Example URLs:
     * - checklist.test/auto/B008-20261014-01
     * - checklist.test/auto/25
     */
    public function __invoke(Request $request, string $identifier, AutoFillReportService $autoFillService): RedirectResponse
    {
        // 1. Resolve Report by numeric ID or reference_number
        $report = is_numeric($identifier)
            ? Report::where('id', (int) $identifier)->first()
            : Report::where('reference_number', $identifier)->first();

        if (! $report) {
            abort(404, "Report with reference number or ID [{$identifier}] not found.");
        }

        // 2. Ensure a user is authenticated (if not logged in, log in report creator or first active user)
        if (! Auth::check()) {
            $user = $report->creator ?? User::where('is_active', true)->first();
            if ($user) {
                Auth::login($user);
            }
        }

        // 3. Fill the report
        $autoFillService->fill($report);

        return redirect()->route('reports.show', $report->id)->with('success', "Report {$report->reference_number} has been 100% filled with test data!");
    }
}
