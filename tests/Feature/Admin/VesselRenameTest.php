<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\Form;
use App\Models\Photo;
use App\Models\Report;
use App\Models\User;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VesselRenameTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    private function createSuperadmin(): User
    {
        return User::factory()->create([
            'role' => 'superadmin',
            'is_active' => true,
        ]);
    }

    private function createCorporate(): User
    {
        return User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);
    }

    private function createVesselUser(string $vesselName): User
    {
        return User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => $vesselName,
            'is_active' => true,
        ]);
    }

    private function createReport(string $vesselName, array $overrides = []): Report
    {
        $form = Form::where('code', 'D-062')->firstOrFail();
        $user = $this->createCorporate();

        return Report::create(array_merge([
            'report_type' => 'inspection',
            'form_id' => $form->id,
            'template_version' => 1,
            'reference_number' => 'D062-20261016-'.fake()->unique()->numerify('##'),
            'status' => 'draft',
            'vessel_name' => $vesselName,
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
            'current_version' => 1,
        ], $overrides));
    }

    private function createPhoto(string $vesselName, array $overrides = []): Photo
    {
        $user = $this->createCorporate();

        return Photo::create(array_merge([
            'vessel_name' => $vesselName,
            'item_no' => 1,
            'title' => 'Test Photo',
            'original_filename' => 'photo.jpg',
            'file_path' => 'photos/photo.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $user->id,
            'captured_at' => now(),
            'sort_order' => 1,
        ], $overrides));
    }

    /**
     * Test superadmin can preview vessel rename impact counts.
     */
    public function test_superadmin_can_preview_vessel_impact(): void
    {
        $admin = $this->createSuperadmin();
        $vesselName = 'MV Northern Light';

        $this->createVesselUser($vesselName);
        $this->createReport($vesselName);
        $this->createReport($vesselName);
        $this->createPhoto($vesselName);

        $response = $this->actingAs($admin)
            ->getJson(route('admin.vessels.impact', ['vessel_name' => $vesselName]));

        $response->assertOk()
            ->assertJson([
                'vessel_name' => $vesselName,
                'users_count' => 1,
                'reports_count' => 2,
                'photos_count' => 1,
                'total_records' => 4,
            ]);
    }

    /**
     * Test superadmin can atomically rename a vessel across all tables.
     */
    public function test_superadmin_can_rename_vessel_across_users_reports_and_photos(): void
    {
        $admin = $this->createSuperadmin();
        $oldName = 'MV Northern Light';
        $newName = 'MV Southern Cross';

        $user = $this->createVesselUser($oldName);
        $report1 = $this->createReport($oldName, ['pdf_version' => 1, 'pdf_path' => 'reports/1/pdf.pdf']);
        $report2 = $this->createReport($oldName);
        $photo1 = $this->createPhoto($oldName);

        $response = $this->actingAs($admin)
            ->post(route('admin.vessels.rename'), [
                'old_name' => $oldName,
                'new_name' => $newName,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Check user updated
        $this->assertSame($newName, $user->fresh()->vessel_name);

        // Check reports updated and cached PDF version invalidated
        $freshReport1 = $report1->fresh();
        $this->assertSame($newName, $freshReport1->vessel_name);
        $this->assertNull($freshReport1->pdf_version);

        $freshReport2 = $report2->fresh();
        $this->assertSame($newName, $freshReport2->vessel_name);

        // Check photos updated
        $this->assertSame($newName, $photo1->fresh()->vessel_name);

        // Check activity log entry recorded (SRS NFR-9, SRS §2.1)
        $log = ActivityLog::where('action', 'vessel_renamed')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('vessel', $log->entity_type);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame($oldName, $log->before_value);

        $payload = json_decode($log->after_value, true);
        $this->assertSame($newName, $payload['new_name']);
        $this->assertSame(1, $payload['users_updated']);
        $this->assertSame(2, $payload['reports_updated']);
        $this->assertSame(1, $payload['photos_updated']);
    }

    /**
     * Test case-insensitivity and spacing normalization on vessel rename.
     */
    public function test_vessel_rename_is_case_insensitive_and_normalizes_spacing(): void
    {
        $admin = $this->createSuperadmin();

        $user = $this->createVesselUser('mv northern light');
        $this->createReport('MV   NORTHERN   LIGHT');

        $response = $this->actingAs($admin)
            ->post(route('admin.vessels.rename'), [
                'old_name' => '  mv northern light  ',
                'new_name' => '  MV   Aurora   Borealis  ',
            ]);

        $response->assertRedirect();

        $this->assertSame('MV Aurora Borealis', $user->fresh()->vessel_name);
        $this->assertSame(1, Report::where('vessel_name', 'MV Aurora Borealis')->count());
        $this->assertSame(0, Report::where('vessel_name', 'MV NORTHERN LIGHT')->count());
    }

    /**
     * Test rename fails if new name is identical to current name.
     */
    public function test_rename_fails_when_new_name_is_identical(): void
    {
        $admin = $this->createSuperadmin();
        $this->createVesselUser('MV Titan');

        $response = $this->actingAs($admin)
            ->from(route('admin.users.index'))
            ->post(route('admin.vessels.rename'), [
                'old_name' => 'MV Titan',
                'new_name' => 'MV Titan',
            ]);

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHasErrors(['new_name']);
    }

    /**
     * Test rename fails when target vessel has no records.
     */
    public function test_rename_fails_when_target_vessel_does_not_exist(): void
    {
        $admin = $this->createSuperadmin();

        $response = $this->actingAs($admin)
            ->from(route('admin.users.index'))
            ->post(route('admin.vessels.rename'), [
                'old_name' => 'Non Existent Vessel',
                'new_name' => 'New Vessel Name',
            ]);

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHasErrors(['old_name']);
    }

    /**
     * Test non-superadmin users cannot rename vessels.
     */
    public function test_non_superadmin_users_cannot_rename_vessels(): void
    {
        $corporate = $this->createCorporate();
        $vessel = $this->createVesselUser('MV Test');

        // Corporate user -> Forbidden
        $this->actingAs($corporate)
            ->post(route('admin.vessels.rename'), [
                'old_name' => 'MV Test',
                'new_name' => 'MV Renamed',
            ])
            ->assertForbidden();

        // Vessel user -> Forbidden
        $this->actingAs($vessel)
            ->post(route('admin.vessels.rename'), [
                'old_name' => 'MV Test',
                'new_name' => 'MV Renamed',
            ])
            ->assertForbidden();

        // Unauthenticated -> Redirect to login
        auth()->logout();
        $this->post(route('admin.vessels.rename'), [
            'old_name' => 'MV Test',
            'new_name' => 'MV Renamed',
        ])
            ->assertRedirect(route('login'));
    }
}
