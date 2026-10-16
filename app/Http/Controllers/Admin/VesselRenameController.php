<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\VesselRenameService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VesselRenameController extends Controller
{
    public function __construct(
        protected VesselRenameService $renameService
    ) {}

    /**
     * Preview the impact (affected record counts) of renaming a vessel.
     */
    public function impact(Request $request): JsonResponse
    {
        $vesselName = (string) $request->input('vessel_name', '');
        $impact = $this->renameService->impact($vesselName);

        return response()->json($impact);
    }

    /**
     * Execute the fleetwide vessel rename across users, reports, and photos.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'old_name' => ['required', 'string', 'max:255'],
            'new_name' => ['required', 'string', 'max:255'],
        ]);

        $result = $this->renameService->rename(
            oldName: $validated['old_name'],
            newName: $validated['new_name'],
            actor: $request->user()
        );

        return back()->with(
            'success',
            "Vessel successfully renamed from '{$result['old_name']}' to '{$result['new_name']}'. Updated {$result['reports_updated']} reports, {$result['users_updated']} user accounts, and {$result['photos_updated']} photo records."
        );
    }
}
