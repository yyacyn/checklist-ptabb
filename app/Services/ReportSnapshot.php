<?php

namespace App\Services;

use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\Report;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use Illuminate\Support\Facades\DB;

class ReportSnapshot
{
    /**
     * Create a new frozen report snapshot from a Form template (SRS FM-8, FM-12, ERD §3).
     *
     * Copies all enabled groups and questions at their current state,
     * resolves applicability from vessel type and ice class notation,
     * stamps template_version, and provisions group comment boxes (FM-7a).
     *
     * @param  array<string, mixed>  $attributes
     */
    public function createReport(Form $form, array $attributes): Report
    {
        return DB::transaction(function () use ($form, $attributes) {
            $reportType = $attributes['report_type'] ?? ($form->form_type === 'photo' ? 'photo' : ($form->code === 'D-062' ? 'inspection' : 'audit'));
            $vesselTypeId = isset($attributes['vessel_type_id']) ? (int) $attributes['vessel_type_id'] : null;
            $vesselTypeIds = $vesselTypeId !== null ? [$vesselTypeId] : [];
            $iceClass = (bool) ($attributes['vessel_ice_class'] ?? false);

            $reportDate = $attributes['report_date'] ?? now()->toDateString();
            $referenceNumber = $attributes['reference_number'] ?? ReportNumberService::nextReferenceNumber($form, $reportDate);

            // Report record
            $reportData = array_merge($attributes, [
                'form_id' => $form->id,
                'template_version' => $form->template_version,
                'report_type' => $reportType,
                'reference_number' => $referenceNumber,
                'status' => $attributes['status'] ?? 'draft',
                'current_version' => 1,
            ]);

            $report = Report::create($reportData);

            // Fetch all enabled, live top-level groups
            $topLevelGroups = $form->groups()
                ->whereNull('parent_id')
                ->whereNull('archived_at')
                ->where('is_enabled', true)
                ->orderBy('sort_order')
                ->get();

            foreach ($topLevelGroups as $group) {
                $questionCounter = 0;
                $this->copyGroup($report, $group, null, $vesselTypeIds, $iceClass, $questionCounter);
            }

            if ($reportType === 'audit') {
                $report->auditDetail()->create([
                    'start_date' => $reportDate,
                    'end_date' => $reportDate,
                    'audit_type' => 'A',
                ]);

                foreach (['Bridge', 'Deck', 'Engine'] as $idx => $act) {
                    $report->auditActivities()->create([
                        'activity' => $act,
                        'sort_order' => $idx + 1,
                    ]);
                }
            }

            return $report;
        });
    }

    /**
     * Copy a group (and its subgroups and questions recursively) into the report.
     *
     * @param  list<int>  $vesselTypeIds
     */
    protected function copyGroup(
        Report $report,
        FormGroup $group,
        ?ReportGroup $parentReportGroup,
        array $vesselTypeIds,
        bool $iceClass,
        int &$questionCounter
    ): ReportGroup {
        $groupApplicability = FormApplicability::resolveGroupApplicability($group, $vesselTypeIds, $iceClass);

        $displayNo = $parentReportGroup
            ? ($parentReportGroup->display_no ? $parentReportGroup->display_no.'.'.$group->sort_order : (string) $group->sort_order)
            : ($group->chapter_no ?: (string) $group->sort_order);

        $reportGroup = ReportGroup::create([
            'report_id' => $report->id,
            'source_group_id' => $group->id,
            'parent_id' => $parentReportGroup?->id,
            'title' => $group->title,
            'chapter_no' => $group->chapter_no,
            'display_no' => $displayNo,
            'sort_order' => $group->sort_order,
            'is_applicable' => $groupApplicability['applicable'],
            'na_reason' => $groupApplicability['reason'],
            'comments' => null, // Provisioned remarks box for top-level chapters (FM-7a)
        ]);

        // Copy direct questions of this group
        $questions = $group->questions()
            ->whereNull('archived_at')
            ->where('is_enabled', true)
            ->orderBy('sort_order')
            ->get();

        foreach ($questions as $question) {
            $questionCounter++;
            $questionApplicability = FormApplicability::resolveQuestionApplicability(
                $question,
                $groupApplicability,
                $vesselTypeIds,
                $iceClass
            );

            ReportQuestion::create([
                'report_group_id' => $reportGroup->id,
                'report_id' => $report->id,
                'source_question_id' => $question->id,
                'question_text' => $question->question_text,
                'guidance' => $question->guidance,
                'input_type' => $question->input_type,
                'display_no' => (string) $questionCounter,
                'sort_order' => $question->sort_order,
                'is_applicable' => $questionApplicability['applicable'],
                'applicable_reason' => $questionApplicability['reason'],
                'na_reason' => null,
            ]);
        }

        // Copy subgroups recursively
        $subgroups = $group->subgroups()
            ->whereNull('archived_at')
            ->where('is_enabled', true)
            ->orderBy('sort_order')
            ->get();

        foreach ($subgroups as $subgroup) {
            $this->copyGroup($report, $subgroup, $reportGroup, $vesselTypeIds, $iceClass, $questionCounter);
        }

        return $reportGroup;
    }
}
