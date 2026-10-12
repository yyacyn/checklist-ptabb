<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Layout schema per form + PDF cache tracking on reports (Phase 6, Task 6.1, REP-1g).
 *
 * `forms.layout_schema` is a JSON definition of the PDF layout: an ordered list of
 * sections, each with a type that maps to a renderer method on ReportPdfRenderer.
 * Both D-062 and B-008 share this column and the same engine; the schema differs per form.
 *
 * `reports.pdf_path` caches the generated PDF so a web request never waits on rendering
 * (REP-6). `reports.pdf_version` is tied to `current_version`: editing the report bumps
 * `current_version`, which invalidates the cached PDF (REP-6).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->json('layout_schema')->nullable()->after('photo_schema');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->string('pdf_path')->nullable()->after('current_version');
            $table->unsignedInteger('pdf_version')->nullable()->after('pdf_path');
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('layout_schema');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['pdf_path', 'pdf_version']);
        });
    }
};
