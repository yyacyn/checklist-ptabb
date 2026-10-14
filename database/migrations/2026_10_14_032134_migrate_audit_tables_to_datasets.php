<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Migrate audit_details into reports.summary_data
        if (Schema::hasTable('audit_details')) {
            $details = DB::table('audit_details')->get();
            foreach ($details as $detail) {
                $report = DB::table('reports')->where('id', $detail->report_id)->first();
                if ($report) {
                    $summary = json_decode($report->summary_data ?? '{}', true) ?: [];
                    $summary['audit_type'] = $detail->audit_type;
                    $summary['audit_type_other'] = $detail->audit_type_other;
                    $summary['audit_end_date'] = $detail->end_date;
                    $summary['lead_auditor'] = $detail->lead_auditor;

                    DB::table('reports')
                        ->where('id', $report->id)
                        ->update(['summary_data' => json_encode($summary)]);
                }
            }
        }

        // 2. Migrate audit_activities into reports.summary_data.activities_audited
        if (Schema::hasTable('audit_activities')) {
            $reportIds = DB::table('audit_activities')->distinct()->pluck('report_id');
            foreach ($reportIds as $reportId) {
                $activities = DB::table('audit_activities')
                    ->where('report_id', $reportId)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->pluck('activity')
                    ->toArray();

                $report = DB::table('reports')->where('id', $reportId)->first();
                if ($report) {
                    $summary = json_decode($report->summary_data ?? '{}', true) ?: [];
                    $summary['activities_audited'] = $activities;

                    DB::table('reports')
                        ->where('id', $reportId)
                        ->update(['summary_data' => json_encode($summary)]);
                }
            }
        }

        // 3. Migrate auditors & auditees into report_datasets under 'audit_people'
        $allReportIds = collect();
        if (Schema::hasTable('auditors')) {
            $allReportIds = $allReportIds->merge(DB::table('auditors')->pluck('report_id'));
        }
        if (Schema::hasTable('auditees')) {
            $allReportIds = $allReportIds->merge(DB::table('auditees')->pluck('report_id'));
        }
        $allReportIds = $allReportIds->unique();

        foreach ($allReportIds as $reportId) {
            $people = [];

            if (Schema::hasTable('auditors')) {
                $auditors = DB::table('auditors')
                    ->where('report_id', $reportId)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get();

                foreach ($auditors as $auditor) {
                    $people[] = [
                        'name' => $auditor->name,
                        'rank' => $auditor->rank,
                        'role' => $auditor->is_lead ? 'Lead auditor' : 'Auditor',
                        'sort_order' => $auditor->sort_order,
                    ];
                }
            }

            if (Schema::hasTable('auditees')) {
                $auditees = DB::table('auditees')
                    ->where('report_id', $reportId)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get();

                foreach ($auditees as $auditee) {
                    $people[] = [
                        'name' => $auditee->name,
                        'rank' => $auditee->rank,
                        'role' => 'Auditee',
                        'sort_order' => $auditee->sort_order,
                    ];
                }
            }

            if (! empty($people) && Schema::hasTable('report_datasets')) {
                DB::table('report_datasets')->updateOrInsert(
                    [
                        'report_id' => $reportId,
                        'dataset_key' => 'audit_people',
                    ],
                    [
                        'rows' => json_encode($people),
                        'row_version' => 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // 4. Drop the four redundant audit tables
        Schema::dropIfExists('audit_activities');
        Schema::dropIfExists('auditees');
        Schema::dropIfExists('auditors');
        Schema::dropIfExists('audit_details');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate the four tables if rolled back
        Schema::create('audit_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('audit_type', 50)->nullable();
            $table->string('audit_type_other', 255)->nullable();
            $table->string('lead_auditor', 255)->nullable();
            $table->timestamps();
            $table->unique('report_id');
        });

        Schema::create('auditors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('rank', 255);
            $table->boolean('is_lead')->default(false);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('auditees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('rank', 255);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('audit_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('activity', 255);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }
};
