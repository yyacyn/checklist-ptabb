<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_can_access_user_management_index(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        User::factory()->corporate()->create(['name' => 'Alice Auditor']);
        User::factory()->vessel('MV Ocean Pioneer')->create(['name' => 'Bob Captain']);

        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index'));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/users/index')
                ->has('users.data', 3)
                ->has('stats')
                ->has('known_vessels')
                ->where('stats.total', 3)
                ->where('stats.vessel', 1)
                ->where('stats.corporate', 1)
                ->where('stats.superadmin', 1)
            );
    }

    public function test_corporate_and_vessel_users_are_forbidden(): void
    {
        $corporate = User::factory()->corporate()->create();
        $vessel = User::factory()->vessel()->create();

        $this->actingAs($corporate)
            ->get(route('admin.users.index'))
            ->assertForbidden();

        $this->actingAs($vessel)
            ->get(route('admin.users.index'))
            ->assertForbidden();
    }

    public function test_superadmin_can_create_a_corporate_user(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $payload = [
            'name' => 'New Corporate User',
            'email' => 'corporate@example.com',
            'password' => 'secret1234',
            'role' => 'corporate',
            'vessel_name' => 'Ignored Vessel Name',
            'is_active' => true,
        ];

        $response = $this->actingAs($superadmin)
            ->post(route('admin.users.store'), $payload);

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('users', [
            'name' => 'New Corporate User',
            'email' => 'corporate@example.com',
            'role' => 'corporate',
            'vessel_name' => null, // nullified for non-vessel roles
            'is_active' => true,
        ]);
    }

    public function test_superadmin_can_create_a_vessel_user_with_vessel_name(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $payload = [
            'name' => 'Shipboard Master',
            'email' => 'master@goldenhorizon.com',
            'password' => 'secret1234',
            'role' => 'vessel',
            'vessel_name' => 'MV Golden Horizon',
            'is_active' => true,
        ];

        $response = $this->actingAs($superadmin)
            ->post(route('admin.users.store'), $payload);

        $response->assertRedirect(route('admin.users.index'));

        $this->assertDatabaseHas('users', [
            'name' => 'Shipboard Master',
            'email' => 'master@goldenhorizon.com',
            'role' => 'vessel',
            'vessel_name' => 'MV Golden Horizon',
            'is_active' => true,
        ]);
    }

    public function test_creating_vessel_user_automatically_assigns_vessel_name_from_name(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $payload = [
            'name' => 'PB.ASUWA',
            'email' => 'asuwa@ptabb.com',
            'password' => 'secret1234',
            'role' => 'vessel',
            'is_active' => true,
        ];

        $response = $this->actingAs($superadmin)
            ->post(route('admin.users.store'), $payload);

        $response->assertRedirect(route('admin.users.index'));
        $this->assertDatabaseHas('users', [
            'name' => 'PB.ASUWA',
            'email' => 'asuwa@ptabb.com',
            'role' => 'vessel',
            'vessel_name' => 'PB.ASUWA',
        ]);
    }

    public function test_superadmin_can_update_user_details_and_password(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $targetUser = User::factory()->corporate()->create([
            'name' => 'Old Name',
            'email' => 'old@example.com',
            'password' => Hash::make('oldpassword'),
        ]);

        $payload = [
            'name' => 'Updated Name',
            'email' => 'updated@example.com',
            'password' => 'newsecretpassword',
            'role' => 'vessel',
            'vessel_name' => 'MV Pacific Star',
            'is_active' => true,
        ];

        $response = $this->actingAs($superadmin)
            ->put(route('admin.users.update', $targetUser->id), $payload);

        $response->assertRedirect(route('admin.users.index'));

        $targetUser->refresh();
        $this->assertEquals('Updated Name', $targetUser->name);
        $this->assertEquals('updated@example.com', $targetUser->email);
        $this->assertEquals('vessel', $targetUser->role);
        $this->assertEquals('MV Pacific Star', $targetUser->vessel_name);
        $this->assertTrue(Hash::check('newsecretpassword', $targetUser->password));
    }

    public function test_updating_user_without_password_keeps_existing_password(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $targetUser = User::factory()->corporate()->create([
            'password' => Hash::make('keepmeplease'),
        ]);

        $payload = [
            'name' => 'Updated Name',
            'email' => $targetUser->email,
            'password' => '',
            'role' => 'corporate',
            'is_active' => true,
        ];

        $this->actingAs($superadmin)
            ->put(route('admin.users.update', $targetUser->id), $payload)
            ->assertRedirect(route('admin.users.index'));

        $targetUser->refresh();
        $this->assertTrue(Hash::check('keepmeplease', $targetUser->password));
    }

    public function test_superadmin_cannot_demote_their_own_superadmin_role(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $payload = [
            'name' => $superadmin->name,
            'email' => $superadmin->email,
            'role' => 'corporate',
            'is_active' => true,
        ];

        $response = $this->actingAs($superadmin)
            ->put(route('admin.users.update', $superadmin->id), $payload);

        $response->assertSessionHasErrors(['role']);
        $superadmin->refresh();
        $this->assertEquals('superadmin', $superadmin->role);
    }

    public function test_superadmin_cannot_deactivate_their_own_account(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $payload = [
            'name' => $superadmin->name,
            'email' => $superadmin->email,
            'role' => 'superadmin',
            'is_active' => false,
        ];

        $response = $this->actingAs($superadmin)
            ->put(route('admin.users.update', $superadmin->id), $payload);

        $response->assertSessionHasErrors(['is_active']);

        // Test toggle-active endpoint as well
        $toggleResponse = $this->actingAs($superadmin)
            ->post(route('admin.users.toggle-active', $superadmin->id));

        $toggleResponse->assertSessionHasErrors(['error']);
        $superadmin->refresh();
        $this->assertTrue($superadmin->is_active);
    }

    public function test_superadmin_can_toggle_active_status_of_another_user(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $target = User::factory()->corporate()->create(['is_active' => true]);

        $this->actingAs($superadmin)
            ->post(route('admin.users.toggle-active', $target->id))
            ->assertSessionHas('success');

        $target->refresh();
        $this->assertFalse($target->is_active);

        $this->actingAs($superadmin)
            ->post(route('admin.users.toggle-active', $target->id))
            ->assertSessionHas('success');

        $target->refresh();
        $this->assertTrue($target->is_active);
    }

    public function test_superadmin_can_soft_delete_other_users_but_not_self(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $target = User::factory()->corporate()->create();

        // Attempt deleting self
        $this->actingAs($superadmin)
            ->delete(route('admin.users.destroy', $superadmin->id))
            ->assertSessionHasErrors(['error']);

        $this->assertDatabaseHas('users', ['id' => $superadmin->id, 'deleted_at' => null]);

        // Delete target user
        $this->actingAs($superadmin)
            ->delete(route('admin.users.destroy', $target->id))
            ->assertRedirect(route('admin.users.index'))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('users', ['id' => $target->id]);
    }

    public function test_deactivated_user_cannot_log_in(): void
    {
        User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => Hash::make('password123'),
            'is_active' => false,
        ]);

        $response = $this->post('/login', [
            'email' => 'inactive@example.com',
            'password' => 'password123',
        ]);

        $response->assertSessionHasErrors(['email']);
        $this->assertGuest();
    }

    public function test_search_and_filters_on_user_list(): void
    {
        $superadmin = User::factory()->superadmin()->create(['name' => 'Admin Boss', 'email' => 'boss@example.com']);
        User::factory()->vessel('MV Golden Star')->create(['name' => 'Captain Jack', 'email' => 'jack@sea.org']);
        User::factory()->corporate()->inactive()->create(['name' => 'Inactive Inspector', 'email' => 'ghost@corp.com']);

        // Search by vessel name
        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index', ['search' => 'Golden Star']));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.name', 'Captain Jack')
            );

        // Filter by role: vessel
        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index', ['role' => 'vessel']));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.role', 'vessel')
            );

        // Filter by status: inactive
        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index', ['status' => 'inactive']));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.name', 'Inactive Inspector')
            );

        // Reset filters (empty query parameter)
        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index', []));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 3)
                ->where('filters.search', '')
                ->where('filters.role', 'all')
                ->where('filters.status', 'all')
            );
    }
}
