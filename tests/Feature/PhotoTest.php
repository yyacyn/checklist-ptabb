<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Form;
use App\Models\Photo;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\ReportQuestion;
use App\Models\User;
use Database\Seeders\FormSeeder;
use Database\Seeders\PhotoCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PhotoTest extends TestCase
{
    use RefreshDatabase;

    protected User $superadmin;
    protected User $inspector;
    protected User $vesselUser;
    protected Report $report;
    protected Form $formD062;
    protected Form $formP001;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PhotoCategorySeeder::class,
            FormSeeder::class,
        ]);

        Storage::fake('public');

        $this->superadmin = User::factory()->create([
            'role' => 'superadmin',
            'email' => 'superadmin@example.com',
        ]);

        $this->inspector = User::factory()->create([
            'role' => 'corporate',
            'email' => 'inspector@example.com',
        ]);

        $this->vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Oceanic Star',
            'email' => 'vessel@example.com',
        ]);

        $this->formD062 = Form::where('code', 'D-062')->first();
        $this->formP001 = Form::where('code', 'P-001')->first();

        $this->report = Report::create([
            'report_type' => 'inspection',
            'form_id' => $this->formD062->id,
            'template_version' => 1,
            'reference_number' => 'INS-2026-TEST-01',
            'status' => 'draft',
            'vessel_name' => 'MV Oceanic Star',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 50000,
            'report_date' => now()->toDateString(),
            'created_by' => $this->inspector->id,
        ]);
    }

    public function test_inspector_can_upload_photo_with_metadata_and_generates_thumbnail(): void
    {
        $category = PhotoCategory::first();
        $fakeImage = UploadedFile::fake()->image('engine_room.jpg', 1200, 800);

        $response = $this->actingAs($this->inspector)->postJson("/reports/{$this->report->id}/photos", [
            'file' => $fakeImage,
            'item_no' => 1,
            'title' => 'Main Engine Turbocharger',
            'caption' => 'Turbocharger turbine side casing',
            'description' => 'Inspected during condition assessment. No significant exhaust gas leaks noted.',
            'location' => 'Engine Room, Lower Platform',
            'photo_category_id' => $category->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('photo.title', 'Main Engine Turbocharger')
            ->assertJsonPath('photo.item_no', 1);

        $this->assertDatabaseHas('photos', [
            'report_id' => $this->report->id,
            'vessel_name' => 'MV Oceanic Star',
            'item_no' => 1,
            'title' => 'Main Engine Turbocharger',
            'photo_category_id' => $category->id,
        ]);

        $photo = Photo::where('report_id', $this->report->id)->first();
        $this->assertNotNull($photo);
        $this->assertNotNull($photo->thumbnail_path);
        Storage::disk('public')->assertExists($photo->file_path);
        Storage::disk('public')->assertExists($photo->thumbnail_path);
    }

    public function test_photo_can_be_attached_to_finding(): void
    {
        $finding = Finding::create([
            'report_id' => $this->report->id,
            'finding_no' => '1',
            'finding_kind' => 'observation',
            'risk_level' => 'high',
            'description' => 'Oil leak on auxiliary engine fuel rail.',
            'finding_status' => 'open',
        ]);

        $fakeImage = UploadedFile::fake()->image('leak.png', 600, 400);

        $response = $this->actingAs($this->inspector)->postJson("/reports/{$this->report->id}/photos", [
            'file' => $fakeImage,
            'title' => 'Fuel Rail Oil Leak',
            'finding_id' => $finding->id,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('photos', [
            'report_id' => $this->report->id,
            'finding_id' => $finding->id,
            'title' => 'Fuel Rail Oil Leak',
        ]);
    }

    public function test_photo_metadata_can_be_updated(): void
    {
        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'Old Title',
            'original_filename' => 'test.jpg',
            'file_path' => 'photos/1/test.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        $response = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'title' => 'Updated Title',
            'description' => 'Updated Description',
            'location' => 'Bridge Wing',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('photo.title', 'Updated Title');

        $this->assertDatabaseHas('photos', [
            'id' => $photo->id,
            'title' => 'Updated Title',
            'location' => 'Bridge Wing',
        ]);
    }

    public function test_photo_can_be_soft_deleted(): void
    {
        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'To Delete',
            'original_filename' => 'delete.jpg',
            'file_path' => 'photos/1/delete.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        $response = $this->actingAs($this->inspector)->deleteJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'delete_reason' => 'Blurry photo',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertSoftDeleted('photos', [
            'id' => $photo->id,
            'delete_reason' => 'Blurry photo',
        ]);
    }

    public function test_photos_can_be_reordered(): void
    {
        $photo1 = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'Photo 1',
            'original_filename' => '1.jpg',
            'file_path' => 'photos/1/1.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        $photo2 = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 2,
            'title' => 'Photo 2',
            'original_filename' => '2.jpg',
            'file_path' => 'photos/1/2.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 2,
        ]);

        $response = $this->actingAs($this->inspector)->postJson("/reports/{$this->report->id}/photos/reorder", [
            'order' => [$photo2->id, $photo1->id],
        ]);

        $response->assertStatus(200);

        $this->assertEquals(1, $photo2->fresh()->sort_order);
        $this->assertEquals(2, $photo1->fresh()->sort_order);
    }

    public function test_photo_gallery_is_role_scoped_for_vessel_users(): void
    {
        Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => 'MV OCEANIC STAR',
            'item_no' => 1,
            'title' => 'Oceanic Photo',
            'original_filename' => 'oceanic.jpg',
            'file_path' => 'photos/1/oceanic.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        Photo::create([
            'report_id' => null,
            'vessel_name' => 'MV PACIFIC SUN',
            'item_no' => 1,
            'title' => 'Pacific Photo',
            'original_filename' => 'pacific.jpg',
            'file_path' => 'photos/2/pacific.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        // Vessel user can only see MV OCEANIC STAR photos
        $response = $this->actingAs($this->vesselUser)->get('/photos');
        $response->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('photos/index')
                ->has('photos.data', 1)
                ->where('photos.data.0.vessel_name', 'MV OCEANIC STAR')
            );

        // Superadmin sees all photos
        $adminResponse = $this->actingAs($this->superadmin)->get('/photos');
        $adminResponse->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('photos/index')
                ->has('photos.data', 2)
            );
    }

    public function test_standalone_photo_report_can_be_created_and_filled(): void
    {
        $vesselType = \App\Models\VesselType::first();
        $response = $this->actingAs($this->inspector)->post('/reports', [
            'form_id' => $this->formP001->id,
            'vessel_name' => 'MV Oceanic Star',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 50000,
            'vessel_built' => 2018,
            'vessel_type_id' => $vesselType->id,
            'report_date' => now()->toDateString(),
            'port' => 'Singapore',
        ]);

        $photoReport = Report::where('form_id', $this->formP001->id)->latest()->first();
        $this->assertNotNull($photoReport);
        $response->assertRedirect("/reports/{$photoReport->id}");

        // 2. Upload photo into standalone photo report
        $fakeImage = UploadedFile::fake()->image('walkaround.jpg', 800, 600);
        $uploadRes = $this->actingAs($this->inspector)->postJson("/reports/{$photoReport->id}/photos", [
            'file' => $fakeImage,
            'title' => 'Forward Deck Overview',
            'location' => 'Forecastle Deck',
        ]);

        $uploadRes->assertStatus(201);
        $this->assertDatabaseHas('photos', [
            'report_id' => $photoReport->id,
            'title' => 'Forward Deck Overview',
        ]);
    }
}
