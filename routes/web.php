<?php

use App\Http\Controllers\Admin\FormController;
use App\Http\Controllers\Admin\FormGroupController;
use App\Http\Controllers\Admin\FormQuestionController;
use App\Http\Controllers\FindingController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Reports (Task 3.1, 3.2, 3.3, 3.6)
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/create', [ReportController::class, 'create'])->name('reports.create');
    Route::post('reports', [ReportController::class, 'store'])->name('reports.store');
    Route::get('reports/{report}', [ReportController::class, 'show'])->name('reports.show');
    Route::delete('reports/{report}', [ReportController::class, 'destroy'])->name('reports.destroy');
    Route::post('reports/{report}/questions/{question}/answer', [ReportController::class, 'saveAnswer'])->name('reports.answers.save');
    Route::post('reports/{report}/questions/{question}/attachment', [ReportController::class, 'uploadAttachment'])->name('reports.questions.attachment');
    Route::put('reports/{report}/general-info', [ReportController::class, 'updateGeneralInfo'])->name('reports.general-info.update');
    Route::put('reports/{report}/summary', [ReportController::class, 'updateSummary'])->name('reports.summary.update');
    Route::post('reports/{report}/groups/{group}/comments', [ReportController::class, 'saveGroupComments'])->name('reports.groups.comments');
    Route::post('reports/{report}/lock', [ReportController::class, 'acquireLock'])->name('reports.lock.acquire');
    Route::delete('reports/{report}/lock', [ReportController::class, 'releaseLock'])->name('reports.lock.release');

    // Findings & Chapter 15 Summary of Observations (Task 4.1, 4.2)
    Route::get('findings', [FindingController::class, 'index'])->name('findings.index');
    Route::post('reports/{report}/findings', [FindingController::class, 'store'])->name('reports.findings.store');
    Route::put('reports/{report}/findings/{finding}', [FindingController::class, 'update'])->name('reports.findings.update');
    Route::delete('reports/{report}/findings/{finding}', [FindingController::class, 'destroy'])->name('reports.findings.destroy');

    Route::middleware('can:manage-forms')->prefix('admin')->name('admin.')->group(function () {
        Route::get('forms', [FormController::class, 'index'])->name('forms.index');
        Route::get('forms/{form}', [FormController::class, 'show'])->name('forms.show');
        Route::put('forms/{form}/summary-schema', [FormController::class, 'updateSummarySchema'])->name('forms.summary-schema.update');

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
    });
});

require __DIR__.'/settings.php';
