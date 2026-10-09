<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use Database\Seeders\FormSeeder;
use Database\Seeders\PhotoCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FormPhotoSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([FormSeeder::class, PhotoCategorySeeder::class]);
    }

    public function test_superadmin_can_view_form_editor_with_photo_schema_and_categories(): void
    {
        $admin = User::factory()->create([
            'role' => 'superadmin',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $response = $this->actingAs($admin)
            ->get(route('admin.forms.show', $form->id));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('forms/show')
            ->has('photo_categories', 8)
            ->has('form.photo_schema')
        );
    }

    public function test_superadmin_can_update_photo_schema_and_bumps_template_version(): void
    {
        $admin = User::factory()->create([
            'role' => 'superadmin',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'B-008')->firstOrFail();
        $initialVersion = $form->template_version;

        $payload = [
            'enabled' => true,
            'title' => 'Chapter 5 - Photographic Evidence',
            'description' => 'Mandatory photos for safety and navigation equipment.',
            'allowed_categories' => ['safety_equipment', 'navigational_equipment', 'deck'],
        ];

        $response = $this->actingAs($admin)
            ->putJson(route('admin.forms.photo-schema.update', $form->id), [
                'photo_schema' => $payload,
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'saved',
                'photo_schema' => $payload,
            ]);

        $form->refresh();
        $this->assertIsArray($form->photo_schema);
        $this->assertTrue($form->photo_schema['enabled']);
        $this->assertEquals('Chapter 5 - Photographic Evidence', $form->photo_schema['title']);
        $this->assertEquals(['safety_equipment', 'navigational_equipment', 'deck'], $form->photo_schema['allowed_categories']);
        $this->assertEquals($initialVersion + 1, $form->template_version);
    }

    public function test_non_superadmin_cannot_update_photo_schema(): void
    {
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $response = $this->actingAs($vesselUser)
            ->putJson(route('admin.forms.photo-schema.update', $form->id), [
                'photo_schema' => [
                    'enabled' => false,
                    'title' => 'Disabled Photo Chapter',
                ],
            ]);

        $response->assertForbidden();
    }
}
