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
        Schema::table('report_groups', function (Blueprint $table) {
            $table->string('display_no', 32)->nullable()->after('chapter_no');
        });

        Schema::table('report_questions', function (Blueprint $table) {
            $table->string('display_no', 32)->nullable()->after('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('report_groups', function (Blueprint $table) {
            $table->dropColumn('display_no');
        });

        Schema::table('report_questions', function (Blueprint $table) {
            $table->dropColumn('display_no');
        });
    }
};
