<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VesselType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VesselTypeController extends Controller
{
    /**
     * Display a listing of vessel types within the accounts page.
     */
    public function index(Request $request): RedirectResponse
    {
        return redirect()->route('admin.users.index', array_merge(['tab' => 'vessel-types'], $request->query()));
    }

    /**
     * Store a newly created vessel type.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:vessel_types,name'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $request->boolean('is_active', true);

        $vesselType = VesselType::create($validated);

        return back()->with('success', "Vessel type '{$vesselType->name}' created successfully.");
    }

    /**
     * Update the specified vessel type.
     */
    public function update(Request $request, VesselType $vesselType): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('vessel_types', 'name')->ignore($vesselType->id)],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->has('is_active')) {
            $validated['is_active'] = $request->boolean('is_active');
        }

        $vesselType->update($validated);

        return back()->with('success', "Vessel type '{$vesselType->name}' updated successfully.");
    }

    /**
     * Toggle the active status of the vessel type.
     */
    public function toggleActive(VesselType $vesselType): RedirectResponse
    {
        $vesselType->update([
            'is_active' => ! $vesselType->is_active,
        ]);

        $statusText = $vesselType->is_active ? 'active' : 'inactive';

        return back()->with('success', "Vessel type '{$vesselType->name}' marked as {$statusText}.");
    }

    /**
     * Remove the specified vessel type from storage if not in use.
     */
    public function destroy(VesselType $vesselType): RedirectResponse
    {
        $reportsCount = $vesselType->reports()->count();
        if ($reportsCount > 0) {
            throw ValidationException::withMessages([
                'vessel_type' => "Cannot delete '{$vesselType->name}' because {$reportsCount} report(s) are linked to it. Please deactivate it instead.",
            ]);
        }

        $applicabilityCount = $vesselType->formApplicabilities()->count();
        if ($applicabilityCount > 0) {
            throw ValidationException::withMessages([
                'vessel_type' => "Cannot delete '{$vesselType->name}' because form template applicability rules depend on it. Please deactivate it instead.",
            ]);
        }

        $name = $vesselType->name;
        $vesselType->delete();

        return back()->with('success', "Vessel type '{$name}' deleted successfully.");
    }
}
