<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates tables for B-008 Audit particulars (AUD-2, AUD-3, ERD §5, PLAN Task 7.1):
     * - audit_details: dates, audit type, other specification, lead auditor
     * - auditees: vessel crew auditees (name, rank, optional user link)
     * - auditors: audit team members (name, rank, is_lead, optional user link)
     * - audit_activities: activities audited (Bridge, Deck, Engine, custom rows)
     */
    public function up(): void
    {
        Schema::create('audit_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->unique()->constrained()->cascadeOnDelete();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('audit_type')->nullable(); // A Internal, B Independent, C Unscheduled, D Other
            $table->string('audit_type_other')->nullable();
            $table->string('lead_auditor')->nullable();
            $table->timestamps();
        });

        Schema::create('auditees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('rank');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['report_id', 'sort_order']);
        });

        Schema::create('auditors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('rank');
            $table->boolean('is_lead')->default(false);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['report_id', 'sort_order']);
        });

        Schema::create('audit_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->string('activity');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['report_id', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_activities');
        Schema::dropIfExists('auditors');
        Schema::dropIfExists('auditees');
        Schema::dropIfExists('audit_details');
    }
};
