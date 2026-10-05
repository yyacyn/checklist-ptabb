<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reference data and the template catalogue (ERD section 2).
     *
     * These tables are the live, superadmin-editable source of questions. Reports never
     * read from them at display time: they copy the rows into report_groups and
     * report_questions when a report is created (SRS FM-8).
     */
    public function up(): void
    {
        Schema::create('vessel_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('forms', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();                 // D-062, B-008
            $table->string('name');
            $table->string('form_version')->default('v01.01'); // the paper form's own version
            $table->unsignedInteger('template_version')->default(1);
            $table->string('answer_set');                     // d062_yes_no_ns_na | b008_yes_no_ns
            $table->timestamps();
        });

        Schema::create('form_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('form_groups')->nullOnDelete();
            $table->string('title');
            $table->string('chapter_no', 8)->nullable();       // D-062 chapters are numbered
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(true);
            $table->boolean('ice_class_only')->default(false);
            $table->timestamp('archived_at')->nullable();      // never hard deleted once used
            $table->timestamps();

            $table->index(['form_id', 'parent_id', 'sort_order']);
            $table->index(['form_id', 'archived_at']);
        });

        Schema::create('form_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('form_groups')->cascadeOnDelete();
            $table->text('question_text');
            $table->text('guidance')->nullable();
            $table->string('input_type')->default('none');    // none|date|text|number
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(true);
            $table->timestamp('archived_at')->nullable();
            $table->string('source_key')->nullable()->unique(); // traceability to the source document
            $table->string('source_ref')->nullable();
            $table->timestamps();

            $table->index(['group_id', 'sort_order']);
            $table->index(['group_id', 'archived_at']);
        });

        // One applicability table for both levels (ERD 14.2): a row points at a group or
        // at a question, never both.
        Schema::create('form_applicability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_group_id')->nullable()->constrained('form_groups')->cascadeOnDelete();
            $table->foreignId('form_question_id')->nullable()->constrained('form_questions')->cascadeOnDelete();
            $table->foreignId('vessel_type_id')->nullable()->constrained()->cascadeOnDelete();
            $table->boolean('ice_class_only')->nullable();
            $table->timestamps();

            $table->unique(['form_group_id', 'vessel_type_id'], 'form_applicability_group_type_unique');
            $table->unique(['form_question_id', 'vessel_type_id'], 'form_applicability_question_type_unique');
        });

        // The seven B-008 auditee evaluation criteria as configuration, so their wording
        // can change without a migration (ERD 14.4).
        Schema::create('evaluation_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->string('criterion_key');
            $table->string('label');
            $table->text('description')->nullable();          // the 1 to 5 definitions
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['form_id', 'criterion_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_criteria');
        Schema::dropIfExists('form_applicability');
        Schema::dropIfExists('form_questions');
        Schema::dropIfExists('form_groups');
        Schema::dropIfExists('forms');
        Schema::dropIfExists('vessel_types');
    }
};
