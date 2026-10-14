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
        Schema::table('findings', function (Blueprint $table) {
            $table->string('finding_no')->nullable()->after('report_question_id');
            $table->date('issue_date')->nullable()->after('target_date');
            $table->index(['report_id', 'finding_no']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('findings', function (Blueprint $table) {
            $table->dropIndex(['report_id', 'finding_no']);
            $table->dropColumn(['finding_no', 'issue_date']);
        });
    }
};
