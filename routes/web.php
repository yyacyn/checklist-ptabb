<?php

use App\Http\Controllers\Admin\FormController;
use App\Http\Controllers\Admin\FormGroupController;
use App\Http\Controllers\Admin\FormQuestionController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::middleware('can:manage-forms')->prefix('admin')->name('admin.')->group(function () {
        Route::get('forms', [FormController::class, 'index'])->name('forms.index');
        Route::get('forms/{form}', [FormController::class, 'show'])->name('forms.show');

        // Groups (Task 2.1, 2.3)
        Route::post('forms/{form}/groups', [FormGroupController::class, 'store'])->name('groups.store');
        Route::put('groups/{group}', [FormGroupController::class, 'update'])->name('groups.update');
        Route::post('groups/{group}/toggle', [FormGroupController::class, 'toggle'])->name('groups.toggle');
        Route::post('groups/{group}/bulk-toggle', [FormGroupController::class, 'bulkToggle'])->name('groups.bulk-toggle');
        Route::post('groups/{group}/reorder', [FormGroupController::class, 'reorder'])->name('groups.reorder');
        Route::delete('groups/{group}', [FormGroupController::class, 'destroy'])->name('groups.destroy');

        // Questions (Task 2.2, 2.3)
        Route::post('groups/{group}/questions', [FormQuestionController::class, 'store'])->name('questions.store');
        Route::put('questions/{question}', [FormQuestionController::class, 'update'])->name('questions.update');
        Route::post('questions/{question}/toggle', [FormQuestionController::class, 'toggle'])->name('questions.toggle');
        Route::post('questions/{question}/duplicate', [FormQuestionController::class, 'duplicate'])->name('questions.duplicate');
        Route::post('questions/{question}/reorder', [FormQuestionController::class, 'reorder'])->name('questions.reorder');
        Route::post('questions/bulk-move', [FormQuestionController::class, 'bulkMove'])->name('questions.bulk-move');
        Route::delete('questions/{question}', [FormQuestionController::class, 'destroy'])->name('questions.destroy');
    });
});

require __DIR__.'/settings.php';
