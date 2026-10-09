<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->json('summary_schema')->nullable()->after('answer_set');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->json('summary_data')->nullable()->after('summary_training_needs');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('summary_schema');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('summary_data');
        });
    }
};
