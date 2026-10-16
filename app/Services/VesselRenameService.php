<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Photo;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin vessel bulk-rename tool (SRS §2.1, PLAN Task 8.3).
 *
 * Vessel identity is stored as a normalised string across reports, photos, and accounts.
 * When a ship is renamed or a typo corrected, this service atomically updates all
 * records matching the old name (case-insensitively) and logs the action to the audit trail.
 */
class VesselRenameService
{
    /**
     * Compute the impact (record counts) of renaming a vessel.
     *
     * @return array{vessel_name: string, users_count: int, reports_count: int, photos_count: int, total_records: int}
     */
    public function impact(string $vesselName): array
    {
        $normalized = VesselName::normalize($vesselName);
        if ($normalized === '') {
            return [
                'vessel_name' => '',
                'users_count' => 0,
                'reports_count' => 0,
                'photos_count' => 0,
                'total_records' => 0,
            ];
        }

        $lower = mb_strtolower($normalized);

        $usersCount = User::query()
            ->whereNotNull('vessel_name')
            ->whereRaw('LOWER(vessel_name) = ?', [$lower])
            ->count();

        $reportsCount = Report::query()
            ->whereRaw('LOWER(vessel_name) = ?', [$lower])
            ->count();

        $photosCount = Photo::query()
            ->whereRaw('LOWER(vessel_name) = ?', [$lower])
            ->count();

        return [
            'vessel_name' => $normalized,
            'users_count' => $usersCount,
            'reports_count' => $reportsCount,
            'photos_count' => $photosCount,
            'total_records' => $usersCount + $reportsCount + $photosCount,
        ];
    }

    /**
     * Atomically rename a vessel across all reports, photos, and user accounts.
     *
     * @return array{old_name: string, new_name: string, users_updated: int, reports_updated: int, photos_updated: int, total_updated: int}
     *
     * @throws ValidationException
     */
    public function rename(string $oldName, string $newName, ?User $actor = null): array
    {
        $normOld = VesselName::normalize($oldName);
        $normNew = VesselName::normalize($newName);

        if ($normOld === '') {
            throw ValidationException::withMessages([
                'old_name' => 'Current vessel name is required.',
            ]);
        }

        if ($normNew === '') {
            throw ValidationException::withMessages([
                'new_name' => 'New vessel name is required.',
            ]);
        }

        if ($normOld === $normNew) {
            throw ValidationException::withMessages([
                'new_name' => 'The new vessel name is identical to the current vessel name.',
            ]);
        }

        $oldLower = mb_strtolower($normOld);

        return DB::transaction(function () use ($normOld, $normNew, $oldLower, $actor) {
            // 1. Update User accounts assigned to this vessel
            $usersUpdated = User::query()
                ->whereNotNull('vessel_name')
                ->whereRaw('LOWER(vessel_name) = ?', [$oldLower])
                ->update(['vessel_name' => $normNew]);

            // 2. Update Inspection and Audit Reports (and invalidate cached PDF to force regeneration with new name)
            $reportsUpdated = Report::query()
                ->whereRaw('LOWER(vessel_name) = ?', [$oldLower])
                ->update([
                    'vessel_name' => $normNew,
                    'pdf_version' => null,
                ]);

            // 3. Update Photographic Records
            $photosUpdated = Photo::query()
                ->whereRaw('LOWER(vessel_name) = ?', [$oldLower])
                ->update(['vessel_name' => $normNew]);

            $totalUpdated = $usersUpdated + $reportsUpdated + $photosUpdated;

            if ($totalUpdated === 0) {
                throw ValidationException::withMessages([
                    'old_name' => "No records found matching vessel '{$normOld}'.",
                ]);
            }

            // 4. Record audit event in append-only ActivityLog (SRS NFR-9, SRS §2.1)
            ActivityLog::create([
                'user_id' => $actor?->id ?? Auth::id(),
                'report_id' => null,
                'entity_type' => 'vessel',
                'entity_id' => 0,
                'action' => 'vessel_renamed',
                'field' => 'vessel_name',
                'before_value' => $normOld,
                'after_value' => json_encode([
                    'new_name' => $normNew,
                    'users_updated' => $usersUpdated,
                    'reports_updated' => $reportsUpdated,
                    'photos_updated' => $photosUpdated,
                ]),
                'ip' => request()?->ip(),
                'created_at' => now(),
            ]);

            return [
                'old_name' => $normOld,
                'new_name' => $normNew,
                'users_updated' => $usersUpdated,
                'reports_updated' => $reportsUpdated,
                'photos_updated' => $photosUpdated,
                'total_updated' => $totalUpdated,
            ];
        });
    }
}
