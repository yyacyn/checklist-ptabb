<?php

namespace Database\Seeders;

use App\Models\EvaluationCriterion;
use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use App\Models\VesselType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Loads the reviewed question files produced by spike S1 into the template catalogue.
 *
 * Matching is by `source_key` (SRS 5.1), never by order, so re-running after a review of
 * the CSV updates rows instead of duplicating them. The whole load is one transaction: it
 * either lands completely or not at all.
 *
 * Run it:      php artisan db:seed --class=FormSeeder
 * Preview it:  FORMS_SEED_DRY=1 php artisan db:seed --class=FormSeeder
 */
class FormSeeder extends Seeder
{
    /** Files this seeder reads, relative to the project root. */
    private const SOURCES = [
        'D-062' => 'spikes/s1-parser/out/review-D062.csv',
        'B-008' => 'spikes/s1-parser/out/review-B008.csv',
    ];

    /** Chapter level applicability from SRS 5.4. */
    private const APPLICABILITY = [
        'D-062' => [
            'chapter' => ['8' => 'Tanker only', '13' => 'Ice class only'],
            'group' => ['/inert gas/i' => 'Tanker only'],
        ],
    ];

    /** The seven B-008 auditee evaluation criteria, as configuration (ERD 14.4). */
    private const CRITERIA = [
        ['sms_knowledge', 'Awareness and knowledge of the SMS and company policies'],
        ['lsa_ffe_security', 'Awareness of safety and use of LSA, FFE, security and emergency equipment'],
        ['regulations', 'Awareness of international regulations'],
        ['familiarisation', 'Familiarisation during service onboard'],
        ['environmental', 'Awareness of topics related to protection of the environment'],
        ['emergency_procedures', 'Familiarisation with vessel emergency procedures'],
        ['safety_awareness', 'Awareness of personal and crew safety obligations'],
    ];

    public function run(): void
    {
        $dry = (bool) env('FORMS_SEED_DRY');

        $summary = DB::transaction(function () use ($dry) {
            $summary = ['forms' => 0, 'groups' => 0, 'questions_created' => 0, 'questions_updated' => 0, 'skipped' => []];

            $vesselTypes = $this->ensureVesselTypes();

            foreach (self::SOURCES as $code => $relativePath) {
                $path = base_path($relativePath);

                if (! File::exists($path)) {
                    $this->command?->warn("  skipped {$code}: {$relativePath} not found");

                    continue;
                }

                $result = $this->seedForm($code, $path, $vesselTypes);

                $summary['forms'] += $result['forms'];
                $summary['groups'] += $result['groups'];
                $summary['questions_created'] += $result['questions_created'];
                $summary['questions_updated'] += $result['questions_updated'];
                foreach ($result['skipped'] as $reason => $count) {
                    $summary['skipped'][$reason] = ($summary['skipped'][$reason] ?? 0) + $count;
                }
            }

            // Seed standalone Photographic Inspection Form (P-001)
            Form::query()->updateOrCreate(
                ['code' => 'P-001'],
                [
                    'form_type' => 'photo',
                    'name' => 'Photographic Record Form',
                    'form_version' => 'v01.00',
                    'answer_set' => 'none',
                    'photo_schema' => [
                        'enabled' => true,
                        'title' => 'Photographic Record Form',
                        'items' => [
                            ['id' => '1', 'title' => 'General View / Overview'],
                            ['id' => '2', 'title' => 'Hull & Deck Area'],
                            ['id' => '3', 'title' => 'Engine Room'],
                            ['id' => '4', 'title' => 'Bridge & Navigation'],
                            ['id' => '5', 'title' => 'Safety Equipment'],
                        ],
                    ],
                ]
            );
            $summary['forms']++;

            if ($dry) {
                DB::rollBack();

                return $summary;
            }

            return $summary;
        });

        $this->report($summary, $dry);
    }

    /**
     * @return array<string, array<string, int>>
     */
    private function ensureVesselTypes(): array
    {
        $types = ['Cement Carrier' => 1, 'Tanker' => 2];

        foreach ($types as $name => $sort) {
            VesselType::query()->firstOrCreate(['name' => $name], ['is_active' => true]);
        }

        return VesselType::query()->pluck('id', 'name')->all();
    }

    /**
     * @param  array<string, int>  $vesselTypes
     * @return array<string, int>
     */
    private function seedForm(string $code, string $path, array $vesselTypes): array
    {
        $summary = ['forms' => 0, 'groups' => 0, 'questions_created' => 0, 'questions_updated' => 0, 'skipped' => []];
        $handle = fopen($path, 'r');
        $header = fgetcsv($handle);
        // Rows are keyed by header name once combined below.

        $summarySchema = $code === 'D-062' ? [
            'enabled' => true,
            'title' => 'Summary & Observations',
            'has_ratings_matrix' => true,
            'rating_options' => [
                ['value' => 'very_good', 'label' => 'Very Good'],
                ['value' => 'satisfactory', 'label' => 'Satisfactory'],
                ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
            ],
            'text_fields' => [
                [
                    'key' => 'summary_comments_no',
                    'label' => "1. Comments / Remarks for items marked 'NO'",
                    'placeholder' => "Provide explanatory remarks, root causes, or mitigation notes for items marked 'NO' across chapters...",
                    'rows' => 3,
                    'span' => 'full',
                ],
                [
                    'key' => 'summary_safety_meetings',
                    'label' => '2. Safety Meetings / Interviews / Drills Held',
                    'placeholder' => 'Details of safety meetings, master/officer interviews, and emergency drills conducted...',
                    'rows' => 3,
                    'span' => 'half',
                ],
                [
                    'key' => 'summary_participants',
                    'label' => '3. Participants',
                    'placeholder' => 'List of attendees, ranks, and participants involved in meetings and drill debriefs...',
                    'rows' => 3,
                    'span' => 'half',
                ],
                [
                    'key' => 'summary_concept_understanding',
                    'label' => '4. Understanding the Concept of Safety/Environmental Excellence & Continuous Improvement',
                    'placeholder' => 'Observations regarding crew familiarity and engagement with company safety culture...',
                    'rows' => 3,
                    'span' => 'full',
                ],
                [
                    'key' => 'summary_training_needs',
                    'label' => '5. Training Needs Identified',
                    'placeholder' => 'Specify training needs, skill gaps identified during inspection...',
                    'rows' => 3,
                    'span' => 'full',
                ],
            ],
            'has_findings_register' => true,
        ] : [
            'enabled' => true,
            'title' => 'Audit Summary & NCRs',
            'has_ratings_matrix' => false,
            'text_fields' => [
                [
                    'key' => 'summary_auditors_comments_positive',
                    'label' => "1. Auditors' General Comments (Positive / Commendable Areas)",
                    'placeholder' => 'Record positive observations, exemplary safety practices, and commendable crew performance...',
                    'rows' => 3,
                    'span' => 'full',
                ],
                [
                    'key' => 'summary_auditors_comments_negative',
                    'label' => '2. Areas for Improvement / Deficiencies',
                    'placeholder' => 'Key concerns, systemic issues, or overall follow-up recommendations noted during the audit...',
                    'rows' => 3,
                    'span' => 'full',
                ],
            ],
            'has_findings_register' => true,
        ];

        $photoSchema = $code === 'D-062' ? [
            'enabled' => true,
            'title' => 'Chapter 16 - Photographic Records',
            'description' => 'Photographic record of vessel inspection items, defects, and overall condition.',
            'allowed_categories' => ['hull', 'deck', 'engine_room', 'room_condition', 'bridge', 'navigational_equipment', 'safety_equipment', 'other'],
        ] : null;

        $form = Form::query()->updateOrCreate(
            ['code' => $code],
            [
                'form_type' => 'standard',
                'name' => $code === 'D-062' ? 'Vessel Inspection Report' : 'Vessel Internal Audit Checklist',
                'form_version' => $code === 'D-062' ? 'v01.01' : 'v00.00',
                'answer_set' => $code === 'D-062' ? 'd062_yes_no_ns_na' : 'b008_yes_no_ns',
                'summary_schema' => $summarySchema,
                'photo_schema' => $photoSchema,
            ],
        );
        $summary['forms']++;

        if ($code === 'B-008') {
            $this->seedCriteria($form);
        }

        $groups = [];      // "chapter|group|subgroup" => FormGroup
        $chapterGroups = []; // chapter title => FormGroup (fallback parent)
        $chapterOrder = [];

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) !== count($header)) {
                // A wrapped or malformed line in the CSV. Not a question.
                $summary['skipped']['malformed_row'] = ($summary['skipped']['malformed_row'] ?? 0) + 1;

                continue;
            }

            $data = array_combine($header, $row);
            $text = trim((string) ($data['question_text'] ?? ''));

            if ($text === '') {
                $summary['skipped']['empty_text'] = ($summary['skipped']['empty_text'] ?? 0) + 1;

                continue;
            }

            $chapter = trim((string) ($data['chapter'] ?? ''));
            $groupTitle = trim((string) ($data['group'] ?? ''));
            $subgroupTitle = trim((string) ($data['subgroup'] ?? ''));
            $chapterNo = trim((string) ($data['chapter_no'] ?? ''));

            // Top level group: the chapter for D-062, the section for B-008.
            $topKey = $chapter !== '' ? $chapter : $groupTitle;
            if ($topKey === '') {
                $topKey = '(untitled)';
            }

            if (! isset($chapterGroups[$topKey])) {
                $chapterOrder[] = $topKey;
                $chapterGroups[$topKey] = $this->group($form, $code, [
                    'title' => $topKey,
                    'parent_id' => null,
                    'chapter_no' => $chapterNo !== '' ? $chapterNo : null,
                    'sort_order' => count($chapterOrder),
                    'applicability' => $this->applicabilityFor($code, $chapterNo, $topKey),
                ]);
                $summary['groups']++;
            }

            $groupId = $chapterGroups[$topKey]->id;

            // Subgroup inside the chapter. For D-062, every question belongs strictly to a subgroup.
            $effectiveSubgroup = $subgroupTitle;
            if ($code === 'D-062' && $effectiveSubgroup === '') {
                $effectiveSubgroup = ($groupTitle !== '' && $groupTitle !== $topKey)
                    ? $groupTitle
                    : $topKey.' - General';
            }

            if ($effectiveSubgroup !== '') {
                $key = $topKey.'||'.$effectiveSubgroup;
                if (! isset($groups[$key])) {
                    $groups[$key] = $this->group($form, $code, [
                        'title' => $effectiveSubgroup,
                        'parent_id' => $chapterGroups[$topKey]->id,
                        'chapter_no' => $chapterNo !== '' ? $chapterNo : null,
                        'sort_order' => FormGroup::query()->where('parent_id', $chapterGroups[$topKey]->id)->count() + 1,
                        'applicability' => $this->applicabilityFor($code, null, $effectiveSubgroup),
                    ]);
                    $summary['groups']++;
                }
                $groupId = $groups[$key]->id;
            }

            $sourceKey = trim((string) ($data['source_key'] ?? ''));
            $inputType = trim((string) ($data['input_type'] ?? ''));

            $existing = $sourceKey !== ''
                ? FormQuestion::query()->where('source_key', $sourceKey)->first()
                : null;

            $attributes = [
                'group_id' => $groupId,
                'question_text' => $text,
                'guidance' => trim((string) ($data['guidance'] ?? '')) ?: null,
                'input_type' => in_array($inputType, FormQuestion::INPUT_TYPES, true) ? $inputType : 'none',
                'is_enabled' => true,
                'source_ref' => trim((string) ($data['source_ref'] ?? '')) ?: null,
            ];

            if ($existing) {
                $existing->update($attributes);
                $summary['questions_updated']++;
            } else {
                FormQuestion::query()->create($attributes + [
                    'source_key' => $sourceKey !== '' ? $sourceKey : null,
                    'sort_order' => FormQuestion::query()->where('group_id', $groupId)->count(),
                ]);
                $summary['questions_created']++;
            }
        }

        fclose($handle);

        return $summary;
    }

    /**
     * Find or create a group, keyed by form + parent + title so that re-running the
     * seeder does not duplicate a chapter (SRS 5.1, matched on stable keys only).
     *
     * @param  array<string, mixed>  $attributes
     */
    private function group(Form $form, string $code, array $attributes): FormGroup
    {
        $group = FormGroup::query()->firstOrCreate(
            [
                'form_id' => $form->id,
                'parent_id' => $attributes['parent_id'],
                'title' => $attributes['title'],
            ],
            [
                'chapter_no' => $attributes['chapter_no'],
                'sort_order' => $attributes['sort_order'],
                'is_enabled' => true,
            ],
        );

        foreach ($attributes['applicability'] ?? [] as $rule) {
            // A rule is either an ice-class restriction or a vessel-type restriction.
            if ($rule === 'Ice class only') {
                FormApplicability::query()->updateOrCreate(
                    ['form_group_id' => $group->id, 'vessel_type_id' => null],
                    ['ice_class_only' => true],
                );

                continue;
            }

            $vesselTypeId = $this->vesselTypeId($rule);

            if ($vesselTypeId === null) {
                // No such vessel type: the rule is dropped rather than guessed at, and the
                // superadmin sets applicability in the form editor (FM-4).
                continue;
            }

            FormApplicability::query()->updateOrCreate(
                ['form_group_id' => $group->id, 'vessel_type_id' => $vesselTypeId],
                ['ice_class_only' => false],
            );
        }

        return $group;
    }

    private function applicabilityFor(string $code, ?string $chapterNo, string $groupTitle): array
    {
        $map = self::APPLICABILITY[$code] ?? [];

        if ($chapterNo !== null && isset($map['chapter'][$chapterNo])) {
            return [$map['chapter'][$chapterNo]];
        }

        foreach ($map['group'] ?? [] as $pattern => $label) {
            if (preg_match($pattern, $groupTitle)) {
                return [$label];
            }
        }

        return [];
    }

    /** "Tanker only" => the Tanker vessel type. */
    private function vesselTypeId(string $rule): ?int
    {
        $name = preg_replace('/\s+only$/i', '', $rule);

        return VesselType::query()->where('name', trim((string) $name))->value('id');
    }

    private function seedCriteria(Form $form): void
    {
        foreach (self::CRITERIA as $index => [$key, $label]) {
            EvaluationCriterion::query()->updateOrCreate(
                ['form_id' => $form->id, 'criterion_key' => $key],
                ['label' => $label, 'sort_order' => $index + 1],
            );
        }
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    private function report(array $summary, bool $dry): void
    {
        if (! $this->command) {
            return;
        }

        $this->command->info($dry ? 'Form seed dry run (nothing written):' : 'Form seed complete:');
        $this->command->table(
            ['Forms', 'Groups', 'Questions created', 'Questions updated', 'Rows skipped'],
            [[
                $summary['forms'],
                $summary['groups'],
                $summary['questions_created'],
                $summary['questions_updated'],
                array_sum($summary['skipped']),
            ]],
        );

        if ($dry) {
            $this->command->comment('Nothing was saved. Re-run without FORMS_SEED_DRY to write.');
        }
    }
}
