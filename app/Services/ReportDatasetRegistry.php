<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Registry and row shape validator for report_datasets (SRS 14.4, Task 7.1).
 *
 * Supported dataset keys for B-008:
 * - audit_people: auditors and auditees (name, rank, role)
 * - audit_evaluation: auditee criteria scoring 1-5 (name, rank, scores, overall_status)
 * - audit_execution_log: timetable of audit execution (person_or_function, date, start_time, end_time, topics)
 */
class ReportDatasetRegistry
{
    /**
     * Recognized dataset keys.
     */
    public const KEY_AUDIT_PEOPLE = 'audit_people';

    public const KEY_AUDIT_EVALUATION = 'audit_evaluation';

    public const KEY_AUDIT_EXECUTION_LOG = 'audit_execution_log';

    public static function allowedKeys(): array
    {
        return [
            self::KEY_AUDIT_PEOPLE,
            self::KEY_AUDIT_EVALUATION,
            self::KEY_AUDIT_EXECUTION_LOG,
        ];
    }

    /**
     * Check if a dataset key is restricted from generic/public listing (SRS 14.4).
     */
    public static function isRestricted(string $key): bool
    {
        return $key === self::KEY_AUDIT_EVALUATION;
    }

    /**
     * Validate and sanitize rows for the given dataset key.
     *
     * @throws ValidationException
     */
    public static function validate(string $key, array $rows): array
    {
        if (! in_array($key, self::allowedKeys(), true)) {
            throw ValidationException::withMessages([
                'dataset_key' => ["Unsupported dataset key [{$key}]."],
            ]);
        }

        $rules = match ($key) {
            self::KEY_AUDIT_PEOPLE => [
                'rows.*.name' => ['required', 'string', 'max:255'],
                'rows.*.rank' => ['required', 'string', 'max:255'],
                'rows.*.role' => ['required', 'string', 'max:100'],
                'rows.*.sort_order' => ['nullable', 'integer'],
            ],
            self::KEY_AUDIT_EVALUATION => [
                'rows.*.name' => ['required', 'string', 'max:255'],
                'rows.*.rank' => ['required', 'string', 'max:255'],
                'rows.*.scores' => ['nullable', 'array'],
                'rows.*.scores.*' => ['nullable', 'integer', 'min:1', 'max:5'],
                'rows.*.overall_status' => ['nullable', 'string', 'max:50'],
                'rows.*.sort_order' => ['nullable', 'integer'],
            ],
            self::KEY_AUDIT_EXECUTION_LOG => [
                'rows.*.person_or_function' => ['required', 'string', 'max:255'],
                'rows.*.date' => ['nullable', 'string', 'max:50'],
                'rows.*.start_time' => ['nullable', 'string', 'max:50'],
                'rows.*.end_time' => ['nullable', 'string', 'max:50'],
                'rows.*.topics' => ['nullable', 'string', 'max:1000'],
                'rows.*.sort_order' => ['nullable', 'integer'],
            ],
        };

        $validator = Validator::make(['rows' => $rows], $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated()['rows'] ?? [];
    }
}
