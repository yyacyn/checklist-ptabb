<?php

namespace App\Services;

use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Vessel identity without a vessel table (SRS 2.1).
 *
 * Vessel names are typed strings normalised on save: trimmed, spaces collapsed,
 * compared case-insensitively. The known name list is built on the fly from distinct
 * names across reports and user accounts for autocomplete.
 */
class VesselName
{
    /**
     * Normalise a vessel name string (SRS 2.1).
     * Trims leading/trailing whitespace and collapses internal multiple spaces into one.
     */
    public static function normalize(?string $name): string
    {
        if ($name === null) {
            return '';
        }

        $collapsed = preg_replace('/\s+/', ' ', trim($name));

        return $collapsed ?? '';
    }

    /**
     * Case-insensitive equality check between two vessel names.
     */
    public static function matches(?string $a, ?string $b): bool
    {
        $normA = static::normalize($a);
        $normB = static::normalize($b);

        if ($normA === '' || $normB === '') {
            return false;
        }

        return mb_strtoupper($normA) === mb_strtoupper($normB);
    }

    /**
     * Distinct vessel names already in use across reports and user accounts (SRS 2.1, ERD §2).
     *
     * @return Collection<int, string>
     */
    public static function knownNames(): Collection
    {
        $reportNames = Report::query()
            ->whereNotNull('vessel_name')
            ->where('vessel_name', '!=', '')
            ->distinct()
            ->pluck('vessel_name');

        $userNames = User::query()
            ->whereNotNull('vessel_name')
            ->where('vessel_name', '!=', '')
            ->distinct()
            ->pluck('vessel_name');

        return $reportNames->concat($userNames)
            ->map(fn (string $name) => static::normalize($name))
            ->filter()
            ->unique(fn (string $name) => mb_strtoupper($name))
            ->sort(SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }
}
