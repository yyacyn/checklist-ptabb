<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations to link photo reports and photos across forms.
     */
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('linked_photo_report_id')
                ->nullable()
                ->after('form_id')
                ->constrained('reports')
                ->nullOnDelete();
        });

        Schema::table('photos', function (Blueprint $table) {
            $table->foreignId('source_photo_id')
                ->nullable()
                ->after('report_id')
                ->constrained('photos')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropForeign(['source_photo_id']);
            $table->dropColumn('source_photo_id');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['linked_photo_report_id']);
            $table->dropColumn('linked_photo_report_id');
        });
    }
};
