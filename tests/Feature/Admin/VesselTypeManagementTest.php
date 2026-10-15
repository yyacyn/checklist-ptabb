<?php

namespace Tests\Feature\Admin;

use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VesselTypeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_can_access_vessel_types_index(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        VesselType::factory()->create(['name' => 'Tanker', 'is_active' => true]);
        VesselType::factory()->create(['name' => 'Bulk Carrier', 'is_active' => false]);

        // Legacy / direct route redirects to accounts page with tab=vessel-types
        $redirectResponse = $this->actingAs($superadmin)
            ->get(route('admin.vessel-types.index'));

        $redirectResponse->assertRedirect(route('admin.users.index', ['tab' => 'vessel-types']));

        // Accounts page displays vessel types and stats
        $response = $this->actingAs($superadmin)
            ->get(route('admin.users.index', ['tab' => 'vessel-types']));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/users/index')
                ->has('vessel_types', 2)
                ->has('vessel_type_stats')
                ->where('vessel_type_stats.total', 2)
                ->where('vessel_type_stats.active', 1)
                ->where('vessel_type_stats.inactive', 1)
                ->where('active_tab', 'vessel-types')
            );
    }

    public function test_corporate_and_vessel_users_are_forbidden(): void
    {
        $corporate = User::factory()->corporate()->create();
        $vessel = User::factory()->vessel()->create();

        $this->actingAs($corporate)
            ->get(route('admin.vessel-types.index'))
            ->assertForbidden();

        $this->actingAs($vessel)
            ->get(route('admin.vessel-types.index'))
            ->assertForbidden();
    }

    public function test_unauthenticated_user_is_redirected_to_login(): void
    {
        $this->get(route('admin.vessel-types.index'))
            ->assertRedirect(route('login'));
    }

    public function test_superadmin_can_create_vessel_type(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $response = $this->actingAs($superadmin)
            ->post(route('admin.vessel-types.store'), [
                'name' => 'Cement Carrier',
                'is_active' => true,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('vessel_types', [
            'name' => 'Cement Carrier',
            'is_active' => true,
        ]);
    }

    public function test_vessel_type_name_is_required_and_must_be_unique(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        VesselType::factory()->create(['name' => 'Tanker']);

        $response = $this->actingAs($superadmin)
            ->from(route('admin.vessel-types.index'))
            ->post(route('admin.vessel-types.store'), [
                'name' => '',
            ]);

        $response->assertSessionHasErrors('name');

        $duplicateResponse = $this->actingAs($superadmin)
            ->from(route('admin.vessel-types.index'))
            ->post(route('admin.vessel-types.store'), [
                'name' => 'Tanker',
            ]);

        $duplicateResponse->assertSessionHasErrors('name');
    }

    public function test_superadmin_can_update_vessel_type(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $type = VesselType::factory()->create(['name' => 'Old Name', 'is_active' => true]);

        $response = $this->actingAs($superadmin)
            ->put(route('admin.vessel-types.update', $type), [
                'name' => 'Updated Name',
                'is_active' => false,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('vessel_types', [
            'id' => $type->id,
            'name' => 'Updated Name',
            'is_active' => false,
        ]);
    }

    public function test_superadmin_can_toggle_vessel_type_active_status(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $type = VesselType::factory()->create(['name' => 'Container Ship', 'is_active' => true]);

        $response = $this->actingAs($superadmin)
            ->post(route('admin.vessel-types.toggle-active', $type));

        $response->assertRedirect();
        $this->assertFalse($type->fresh()->is_active);

        $this->actingAs($superadmin)
            ->post(route('admin.vessel-types.toggle-active', $type));

        $this->assertTrue($type->fresh()->is_active);
    }

    public function test_superadmin_can_delete_unused_vessel_type(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $type = VesselType::factory()->create(['name' => 'Unused Type']);

        $response = $this->actingAs($superadmin)
            ->delete(route('admin.vessel-types.destroy', $type));

        $response->assertRedirect();
        $this->assertDatabaseMissing('vessel_types', [
            'id' => $type->id,
        ]);
    }

    public function test_vessel_type_cannot_be_deleted_if_linked_to_reports(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $type = VesselType::factory()->create(['name' => 'Tanker']);
        $form = Form::factory()->create();

        Report::factory()->create([
            'form_id' => $form->id,
            'vessel_type_id' => $type->id,
            'vessel_name' => 'TB Test',
        ]);

        $response = $this->actingAs($superadmin)
            ->from(route('admin.vessel-types.index'))
            ->delete(route('admin.vessel-types.destroy', $type));

        $response->assertSessionHasErrors('vessel_type');
        $this->assertDatabaseHas('vessel_types', [
            'id' => $type->id,
        ]);
    }

    public function test_vessel_type_cannot_be_deleted_if_linked_to_form_applicability(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $type = VesselType::factory()->create(['name' => 'Cement Carrier']);
        $form = Form::factory()->create();
        $group = FormGroup::factory()->create(['form_id' => $form->id]);

        FormApplicability::create([
            'form_group_id' => $group->id,
            'vessel_type_id' => $type->id,
        ]);

        $response = $this->actingAs($superadmin)
            ->from(route('admin.vessel-types.index'))
            ->delete(route('admin.vessel-types.destroy', $type));

        $response->assertSessionHasErrors('vessel_type');
        $this->assertDatabaseHas('vessel_types', [
            'id' => $type->id,
        ]);
    }

    public function test_search_and_status_filtering(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        // Direct route forwards query parameters to accounts page
        $response = $this->actingAs($superadmin)
            ->get(route('admin.vessel-types.index', ['search' => 'Tanker']));

        $response->assertRedirect(route('admin.users.index', ['tab' => 'vessel-types', 'search' => 'Tanker']));
    }
}
