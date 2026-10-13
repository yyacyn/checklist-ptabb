<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Disconnect the photo form from regular question forms.
     *
     * Regular forms (D-062, B-008) no longer carry a photo_schema; only the
     * standalone photographic record form (P-001) retains one. Existing
     * regular reports that were linked to photo reports have their
     * linked_photo_report_id cleared.
     */
    public function up(): void
    {
        // Clear photo_schema from regular (non-photo) forms
        DB::table('forms')
            ->where('form_type', '!=', 'photo')
            ->orWhereNull('form_type')
            ->update(['photo_schema' => null]);

        // Clear linked_photo_report_id on all non-photo reports
        DB::table('reports')
            ->whereNotIn('form_id', function ($q) {
                $q->select('id')->from('forms')->where('form_type', 'photo');
            })
            ->update(['linked_photo_report_id' => null]);
    }

    public function down(): void
    {
        // No-op: the photo_schema for D-062 is not restored from migration.
        // Re-run FormSeeder to restore.
    }
};
