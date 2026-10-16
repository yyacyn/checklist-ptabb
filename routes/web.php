<?php

use App\Http\Controllers\Admin\FormController;
use App\Http\Controllers\Admin\FormGroupController;
use App\Http\Controllers\Admin\FormQuestionController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\VesselRenameController;
use App\Http\Controllers\Admin\VesselTypeController;
use App\Http\Controllers\AutoFillReportController;
use App\Http\Controllers\FindingController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\ReportController;
use App\Models\Finding;
use App\Models\Report;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

// Auto-fill test helper (e.g. checklist.test/auto/B008-20261014-01 or checklist.test/auto/25)
Route::get('auto/{identifier}', AutoFillReportController::class)->name('reports.auto-fill');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        $user = auth()->user();

        $reportsQuery = Report::query();
        $findingsQuery = Finding::query();

        if ($user && $user->role === 'vessel') {
            $reportsQuery->where('vessel_name', $user->vessel_name);
            $findingsQuery->whereHas('report', fn ($q) => $q->where('vessel_name', $user->vessel_name));
        }

        $recentReports = (clone $reportsQuery)
            ->with('form')
            ->latest('report_date')
            ->latest('id')
            ->limit(5)
            ->get(['id', 'reference_number', 'vessel_name', 'form_id', 'status', 'report_date']);

        return Inertia::render('dashboard', [
            'stats' => [
                'total_reports' => $reportsQuery->count(),
                'draft_reports' => (clone $reportsQuery)->where('status', 'draft')->count(),
                'submitted_reports' => (clone $reportsQuery)->where('status', 'submitted')->count(),
                'open_findings' => (clone $findingsQuery)->where('finding_status', 'open')->count(),
            ],
            'recent_reports' => $recentReports,
        ]);
    })->name('dashboard');

    // Reports (Task 3.1, 3.2, 3.3, 3.6)
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/create', [ReportController::class, 'create'])->name('reports.create');
    Route::post('reports', [ReportController::class, 'store'])->name('reports.store');
    Route::get('reports/{report}', [ReportController::class, 'show'])->name('reports.show');
    Route::delete('reports/{report}', [ReportController::class, 'destroy'])->name('reports.destroy');
    Route::post('reports/{report}/questions/{question}/answer', [ReportController::class, 'saveAnswer'])->name('reports.answers.save');
    Route::post('reports/{report}/questions/{question}/attachment', [ReportController::class, 'uploadAttachment'])->name('reports.questions.attachment');
    Route::put('reports/{report}/general-info', [ReportController::class, 'updateGeneralInfo'])->name('reports.general-info.update');
    Route::put('reports/{report}/datasets/{key}', [ReportController::class, 'updateDataset'])->name('reports.datasets.update');
    Route::put('reports/{report}/fields', [ReportController::class, 'updateFields'])->name('reports.fields.update');
    Route::put('reports/{report}/summary', [ReportController::class, 'updateSummary'])->name('reports.summary.update');
    Route::post('reports/{report}/summary-ratings', [ReportController::class, 'saveSummaryRatings'])->name('reports.summary-ratings.save');
    Route::post('reports/{report}/summary-text', [ReportController::class, 'saveSummaryText'])->name('reports.summary-text.save');
    Route::post('reports/{report}/groups/{group}/comments', [ReportController::class, 'saveGroupComments'])->name('reports.groups.comments');
    Route::post('reports/{report}/photo-section-comment', [ReportController::class, 'savePhotoSectionComment'])->name('reports.photo-section-comment');
    Route::post('reports/{report}/lock', [ReportController::class, 'acquireLock'])->name('reports.lock.acquire');
    Route::delete('reports/{report}/lock', [ReportController::class, 'releaseLock'])->name('reports.lock.release');
    Route::post('reports/{report}/submit', [ReportController::class, 'submit'])->name('reports.submit');
    Route::get('reports/{report}/pdf', [ReportController::class, 'viewPdf'])->name('reports.pdf.view');
    Route::get('reports/{report}/pdf/download', [ReportController::class, 'downloadPdf'])->name('reports.pdf.download');

    // Findings & Chapter 15 Summary of Observations (Task 4.1, 4.2)
    Route::get('findings', [FindingController::class, 'index'])->name('findings.index');
    Route::post('reports/{report}/findings', [FindingController::class, 'store'])->name('reports.findings.store');
    Route::put('reports/{report}/findings/{finding}', [FindingController::class, 'update'])->name('reports.findings.update');
    Route::delete('reports/{report}/findings/{finding}', [FindingController::class, 'destroy'])->name('reports.findings.destroy');

    // Photos & Chapter 16 Photographic Records (Phase 5, Tasks 5.3, 5.6, 5.8, 5.10, 5.11)
    Route::get('photos', [PhotoController::class, 'index'])->name('photos.index');
    Route::post('reports/{report}/photos', [PhotoController::class, 'store'])->name('reports.photos.store');
    Route::put('reports/{report}/photos/{photo}', [PhotoController::class, 'update'])->name('reports.photos.update');
    Route::delete('reports/{report}/photos/{photo}', [PhotoController::class, 'destroy'])->name('reports.photos.destroy');
    Route::post('reports/{report}/photos/reorder', [PhotoController::class, 'reorder'])->name('reports.photos.reorder');

    Route::middleware('can:manage-forms')->prefix('admin')->name('admin.')->group(function () {
        Route::get('forms', [FormController::class, 'index'])->name('forms.index');
        Route::post('forms', [FormController::class, 'store'])->name('forms.store');
        Route::get('forms/{form}', [FormController::class, 'show'])->name('forms.show');
        Route::put('forms/{form}/summary-schema', [FormController::class, 'updateSummarySchema'])->name('forms.summary-schema.update');
        Route::put('forms/{form}/photo-schema', [FormController::class, 'updatePhotoSchema'])->name('forms.photo-schema.update');
        Route::put('forms/{form}/layout-schema', [FormController::class, 'updateLayoutSchema'])->name('forms.layout-schema.update');

        // Groups (Task 2.1, 2.3, 2.4, 2.6)
        Route::post('forms/{form}/groups', [FormGroupController::class, 'store'])->name('groups.store');
        Route::put('groups/{group}', [FormGroupController::class, 'update'])->name('groups.update');
        Route::post('groups/{group}/toggle', [FormGroupController::class, 'toggle'])->name('groups.toggle');
        Route::post('groups/{group}/bulk-toggle', [FormGroupController::class, 'bulkToggle'])->name('groups.bulk-toggle');
        Route::put('groups/{group}/applicability', [FormGroupController::class, 'updateApplicability'])->name('groups.applicability');
        Route::get('groups/{group}/history', [FormGroupController::class, 'history'])->name('groups.history');
        Route::post('groups/{group}/reorder', [FormGroupController::class, 'reorder'])->name('groups.reorder');
        Route::delete('groups/{group}', [FormGroupController::class, 'destroy'])->name('groups.destroy');

        // Questions (Task 2.2, 2.3, 2.4, 2.6)
        Route::post('groups/{group}/questions', [FormQuestionController::class, 'store'])->name('questions.store');
        Route::put('questions/{question}', [FormQuestionController::class, 'update'])->name('questions.update');
        Route::post('questions/{question}/toggle', [FormQuestionController::class, 'toggle'])->name('questions.toggle');
        Route::post('questions/{question}/duplicate', [FormQuestionController::class, 'duplicate'])->name('questions.duplicate');
        Route::post('questions/{question}/reorder', [FormQuestionController::class, 'reorder'])->name('questions.reorder');
        Route::post('questions/bulk-move', [FormQuestionController::class, 'bulkMove'])->name('questions.bulk-move');
        Route::put('questions/{question}/applicability', [FormQuestionController::class, 'updateApplicability'])->name('questions.applicability');
        Route::get('questions/{question}/history', [FormQuestionController::class, 'history'])->name('questions.history');
        Route::delete('questions/{question}', [FormQuestionController::class, 'destroy'])->name('questions.destroy');

        // Users & Vessel Accounts (Task 8.1)
        Route::resource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('users/{user}/toggle-active', [UserController::class, 'toggleActive'])->name('users.toggle-active');

        // Vessel Types Management (Task 8.2)
        Route::resource('vessel-types', VesselTypeController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('vessel-types/{vessel_type}/toggle-active', [VesselTypeController::class, 'toggleActive'])->name('vessel-types.toggle-active');

        // Vessel Bulk Rename (Task 8.3, SRS §2.1)
        Route::get('vessels/impact', [VesselRenameController::class, 'impact'])->name('vessels.impact');
        Route::post('vessels/rename', [VesselRenameController::class, 'store'])->name('vessels.rename');
    });
});

require __DIR__.'/settings.php';
