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
        Schema::create('findings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_group_id')->nullable()->constrained('report_groups')->nullOnDelete();
            $table->foreignId('report_question_id')->nullable()->constrained('report_questions')->nullOnDelete();
            $table->string('chapter_label')->nullable();
            $table->string('finding_kind')->default('observation'); // observation | non_conformity
            $table->string('risk')->nullable();                     // high | medium | low
            $table->string('severity')->nullable();
            $table->text('description');
            $table->string('viq_paragraph')->nullable();
            $table->string('job_order_no')->nullable();
            $table->date('target_date')->nullable();
            $table->string('finding_status')->default('open');      // open | action_submitted | verified_closed | reopened
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('action_submitted_at')->nullable();
            $table->foreignId('action_submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('reopened_count')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['report_id', 'sort_order']);
            $table->index(['report_id', 'finding_status']);
            $table->index(['report_question_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('findings');
    }
};
