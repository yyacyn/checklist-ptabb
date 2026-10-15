<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VesselType;
use App\Services\VesselName;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Display a listing of user accounts with search and filters.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $role = $request->input('role', 'all');
        $status = $request->input('status', 'all');

        $query = User::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('vessel_name', 'like', "%{$search}%");
            });
        }

        if ($role !== 'all' && in_array($role, ['superadmin', 'corporate', 'vessel'], true)) {
            $query->where('role', $role);
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $users = $query->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'vessel_name' => $user->vessel_name,
                'is_active' => (bool) $user->is_active,
                'created_at' => $user->created_at?->toIso8601String(),
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            ]);

        $stats = [
            'total' => User::count(),
            'active' => User::where('is_active', true)->count(),
            'inactive' => User::where('is_active', false)->count(),
            'superadmin' => User::where('role', 'superadmin')->count(),
            'corporate' => User::where('role', 'corporate')->count(),
            'vessel' => User::where('role', 'vessel')->count(),
        ];

        $vesselTypes = VesselType::query()
            ->withCount(['reports', 'formApplicabilities'])
            ->orderBy('name')
            ->get()
            ->map(fn (VesselType $type) => [
                'id' => $type->id,
                'name' => $type->name,
                'is_active' => (bool) $type->is_active,
                'reports_count' => (int) $type->reports_count,
                'form_applicabilities_count' => (int) $type->form_applicabilities_count,
                'created_at' => $type->created_at?->toIso8601String(),
            ]);

        $vesselTypeStats = [
            'total' => VesselType::count(),
            'active' => VesselType::where('is_active', true)->count(),
            'inactive' => VesselType::where('is_active', false)->count(),
            'in_use' => VesselType::whereHas('reports')->orWhereHas('formApplicabilities')->count(),
        ];

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => [
                'search' => $search,
                'role' => $role,
                'status' => $status,
            ],
            'stats' => $stats,
            'known_vessels' => VesselName::knownNames()->values()->all(),
            'vessel_types' => $vesselTypes,
            'vessel_type_stats' => $vesselTypeStats,
            'active_tab' => $request->input('tab') === 'vessel-types' ? 'vessel-types' : 'users',
        ]);
    }

    /**
     * Store a newly created user account.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(['superadmin', 'corporate', 'vessel'])],
            'vessel_name' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        if ($validated['role'] === 'vessel') {
            $validated['vessel_name'] = ! empty($validated['vessel_name']) ? $validated['vessel_name'] : $validated['name'];
        } else {
            $validated['vessel_name'] = null;
        }

        $validated['is_active'] = $request->boolean('is_active', true);
        $validated['email_verified_at'] = now();

        $user = User::create($validated);

        return redirect()->route('admin.users.index')
            ->with('success', "User {$user->name} created successfully.");
    }

    /**
     * Update the specified user account.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        // Prevent self-demotion
        if ($request->user()?->id === $user->id && $request->input('role') !== 'superadmin') {
            throw ValidationException::withMessages([
                'role' => 'You cannot remove your own superadmin role.',
            ]);
        }

        // Prevent self-deactivation
        if ($request->user()?->id === $user->id && ! $request->boolean('is_active', true)) {
            throw ValidationException::withMessages([
                'is_active' => 'You cannot deactivate your own account.',
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(['superadmin', 'corporate', 'vessel'])],
            'vessel_name' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        if ($validated['role'] === 'vessel') {
            $validated['vessel_name'] = ! empty($validated['vessel_name']) ? $validated['vessel_name'] : $validated['name'];
        } else {
            $validated['vessel_name'] = null;
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $validated['is_active'] = $request->boolean('is_active', true);

        $user->update($validated);

        return redirect()->route('admin.users.index')
            ->with('success', "User {$user->name} updated successfully.");
    }

    /**
     * Toggle the active status of a user account.
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        if ($request->user()?->id === $user->id) {
            return back()->withErrors(['error' => 'You cannot deactivate your own account.']);
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        $action = $user->is_active ? 'activated' : 'deactivated';

        return back()->with('success', "User {$user->name} has been {$action}.");
    }

    /**
     * Remove the specified user account.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()?->id === $user->id) {
            return back()->withErrors(['error' => 'You cannot delete your own account.']);
        }

        $name = $user->name;
        $user->delete();

        return redirect()->route('admin.users.index')
            ->with('success', "User {$name} deleted successfully.");
    }
}
