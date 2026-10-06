<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reports, snapshot groups and questions, and granular answers (ERD section 3).
     *
     * report_groups and report_questions are frozen snapshots taken at report creation
     * time (SRS FM-8). Answers carry machinery for idempotent retries (client_save_id)
     * and conflict detection (row_version).
     */
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_type');                     // inspection (D-062) | audit (B-008)
            $table->foreignId('form_id')->constrained();
            $table->unsignedInteger('template_version');       // snapshot of forms.template_version (FM-12)
            $table->string('reference_number')->unique();      // FORMCODE-YYYYMMDD-NN (SRS RLS-7)
            $table->string('status')->default('draft');        // draft|in_progress|submitted|reviewed|closed|reopened
            $table->string('vessel_name');                     // normalised on write (SRS 2.1)
            $table->string('vessel_imo')->nullable();
            $table->string('vessel_flag')->nullable();
            $table->decimal('vessel_gt', 12, 2)->nullable();
            $table->unsignedSmallInteger('vessel_built')->nullable();
            $table->foreignId('vessel_type_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('vessel_ice_class')->default(false);
            $table->date('report_date');
            $table->string('master_name')->nullable();
            $table->string('chief_engineer_name')->nullable();
            $table->string('chief_officer_name')->nullable();
            $table->unsignedInteger('current_version')->default(1); // bumped on content edit, PDF cache key
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('lock_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('lock_expires_at')->nullable();
            $table->softDeletes();
            $table->string('delete_reason')->nullable();
            $table->timestamps();

            $table->index(['vessel_name', 'report_date']);
            $table->index(['status', 'vessel_name']);
            $table->index(['created_by', 'status']);
        });

        Schema::create('report_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_group_id')->nullable()->constrained('form_groups')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('report_groups')->cascadeOnDelete();
            $table->string('title');
            $table->string('chapter_no', 8)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_applicable')->default(true);
            $table->string('na_reason')->nullable();
            $table->text('comments')->nullable();              // the form's COMMENTS / REMARKS box (FM-7a)
            $table->timestamps();

            $table->index(['report_id', 'parent_id', 'sort_order']);
        });

        Schema::create('report_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete(); // denormalised for fast counter queries
            $table->foreignId('source_question_id')->nullable()->constrained('form_questions')->nullOnDelete();
            $table->text('question_text');
            $table->text('guidance')->nullable();
            $table->string('input_type')->default('none');     // none|date|text|number
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_applicable')->default(true);
            $table->string('applicable_reason')->nullable();   // auto: Tanker only | Ice class only
            $table->string('na_reason')->nullable();           // user override reason (FM-4a)
            $table->timestamps();

            $table->index(['report_group_id', 'sort_order']);
            $table->index(['report_id', 'is_applicable']);
        });

        Schema::create('report_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_question_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete(); // denormalised for counter queries
            $table->string('answer')->nullable();              // yes|no|ns|na
            $table->text('note')->nullable();
            $table->text('extra_value')->nullable();           // typed input: date, text, number
            $table->foreignId('answered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('answered_at')->nullable();
            $table->string('client_save_id')->nullable()->unique(); // idempotent retry key (NFR-2)
            $table->unsignedInteger('row_version')->default(1); // conflict detection (NFR-15)
            $table->timestamps();

            $table->index(['report_id', 'answer']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_answers');
        Schema::dropIfExists('report_questions');
        Schema::dropIfExists('report_groups');
        Schema::dropIfExists('reports');
    }
};
