<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only audit trail (SRS NFR-9, NFR-17, ERD §6, §7.5).
     *
     * Never updated, never deleted. Written for template edits, answers,
     * ratings, findings, status transitions, and photo deletions.
     */
    public function up(): void
    {
        Schema::create('activity_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('report_id')->nullable()->constrained('reports')->nullOnDelete();
            $table->string('entity_type');                     // App\Models\FormGroup, App\Models\FormQuestion, etc.
            $table->unsignedBigInteger('entity_id');
            $table->string('action');                          // created|updated|reordered|archived|deleted|moved|toggled
            $table->string('field')->nullable();               // question_text|sort_order|is_enabled|applicability
            $table->text('before_value')->nullable();
            $table->text('after_value')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id']);
            $table->index(['report_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
    }
};
