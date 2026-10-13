<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Form;
use App\Models\Photo;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
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
        $vesselType = VesselType::first();
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

    public function test_photo_can_be_attached_directly_to_question_on_upload(): void
    {
        $group = $this->report->groups()->create([
            'title' => 'Test Group',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $question = $group->questions()->create([
            'report_id' => $this->report->id,
            'question_text' => 'Are fire extinguishers inspected?',
            'input_type' => 'yes_no_na',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $fakeImage = UploadedFile::fake()->image('extinguisher.jpg', 800, 600);

        $response = $this->actingAs($this->inspector)->postJson("/reports/{$this->report->id}/photos", [
            'file' => $fakeImage,
            'title' => 'Extinguisher Inspection Tag',
            'report_question_id' => $question->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('photo.report_question_id', $question->id);

        $this->assertDatabaseHas('photos', [
            'report_id' => $this->report->id,
            'report_question_id' => $question->id,
            'title' => 'Extinguisher Inspection Tag',
        ]);

        $this->assertCount(1, $question->fresh()->photos);
    }

    public function test_existing_photo_can_be_linked_and_unlinked_to_question(): void
    {
        $group = $this->report->groups()->create([
            'title' => 'Navigation Group',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $question = $group->questions()->create([
            'report_id' => $this->report->id,
            'question_text' => 'Are ECDIS charts updated?',
            'input_type' => 'yes_no_na',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'ECDIS Screen',
            'original_filename' => 'ecdis.jpg',
            'file_path' => 'photos/1/ecdis.jpg',
            'file_size' => 2048,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        // 1. Link to question
        $linkRes = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'report_question_id' => $question->id,
        ]);

        $linkRes->assertStatus(200)
            ->assertJsonPath('photo.report_question_id', $question->id);

        $this->assertEquals($question->id, $photo->fresh()->report_question_id);

        // 2. Unlink from question
        $unlinkRes = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'report_question_id' => null,
        ]);

        $unlinkRes->assertStatus(200)
            ->assertJsonPath('photo.report_question_id', null);

        $this->assertNull($photo->fresh()->report_question_id);
    }

    public function test_existing_photo_can_be_linked_and_unlinked_to_finding(): void
    {
        $finding = Finding::create([
            'report_id' => $this->report->id,
            'finding_no' => 'OBS-1',
            'finding_kind' => 'observation',
            'risk_level' => 'medium',
            'description' => 'Lifeboat painter frayed.',
            'finding_status' => 'open',
        ]);

        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'Lifeboat Painter',
            'original_filename' => 'painter.jpg',
            'file_path' => 'photos/1/painter.jpg',
            'file_size' => 2048,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        // 1. Link to finding
        $linkRes = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'finding_id' => $finding->id,
        ]);

        $linkRes->assertStatus(200)
            ->assertJsonPath('photo.finding_id', $finding->id);

        $this->assertEquals($finding->id, $photo->fresh()->finding_id);
        $this->assertCount(1, $finding->fresh()->photos);

        // 2. Unlink from finding
        $unlinkRes = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'finding_id' => null,
        ]);

        $unlinkRes->assertStatus(200)
            ->assertJsonPath('photo.finding_id', null);

        $this->assertNull($photo->fresh()->finding_id);
    }

    public function test_linking_to_question_or_finding_from_different_report_is_refused(): void
    {
        $otherReport = Report::create([
            'report_type' => 'inspection',
            'form_id' => $this->formD062->id,
            'template_version' => 1,
            'reference_number' => 'INS-2026-OTHER-01',
            'status' => 'draft',
            'vessel_name' => 'MV Pacific Sun',
            'report_date' => now()->toDateString(),
            'created_by' => $this->inspector->id,
        ]);

        $foreignGroup = $otherReport->groups()->create([
            'title' => 'Foreign Group',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $foreignQuestion = $foreignGroup->questions()->create([
            'report_id' => $otherReport->id,
            'question_text' => 'Foreign question?',
            'input_type' => 'yes_no_na',
            'sort_order' => 1,
            'is_applicable' => true,
        ]);

        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'My Photo',
            'original_filename' => 'photo.jpg',
            'file_path' => 'photos/1/photo.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        $response = $this->actingAs($this->inspector)->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
            'report_question_id' => $foreignQuestion->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_uploading_photo_transitions_draft_report_to_in_progress(): void
    {
        $this->assertEquals('draft', $this->report->status);

        $fakeImage = UploadedFile::fake()->image('test.jpg');
        $this->actingAs($this->inspector)->postJson("/reports/{$this->report->id}/photos", [
            'file' => $fakeImage,
            'item_no' => 1,
            'title' => 'Test Photo',
        ])->assertStatus(201);

        $this->assertEquals('in_progress', $this->report->fresh()->status);
    }

    public function test_submit_photo_report_requires_all_schema_items_uploaded(): void
    {
        // Create a standalone photo report with 2 items in photo_schema
        $photoForm = Form::factory()->create([
            'code' => 'P-TEST',
            'form_type' => 'photo',
            'photo_schema' => [
                'items' => [
                    ['item_no' => 1, 'title' => 'Bow'],
                    ['item_no' => 2, 'title' => 'Stern'],
                ],
            ],
        ]);

        $photoReport = Report::create([
            'report_type' => 'inspection',
            'form_id' => $photoForm->id,
            'template_version' => 1,
            'reference_number' => 'P-TEST-001',
            'status' => 'draft',
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $this->inspector->id,
        ]);

        // Attempt submit when 0 photos uploaded -> should fail 422
        $response = $this->actingAs($this->inspector)->postJson("/reports/{$photoReport->id}/submit");
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        // Upload photo 1
        Photo::create([
            'report_id' => $photoReport->id,
            'vessel_name' => $photoReport->vessel_name,
            'item_no' => 1,
            'title' => 'Bow',
            'original_filename' => 'test1.jpg',
            'file_path' => 'photos/test1.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        // Still missing item 2 -> should fail 422
        $this->actingAs($this->inspector)->postJson("/reports/{$photoReport->id}/submit")
            ->assertStatus(422);

        // Upload photo 2
        Photo::create([
            'report_id' => $photoReport->id,
            'vessel_name' => $photoReport->vessel_name,
            'item_no' => 2,
            'title' => 'Stern',
            'original_filename' => 'test2.jpg',
            'file_path' => 'photos/test2.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 2,
        ]);

        // Now all items are fulfilled -> submit succeeds 200
        $submitResponse = $this->actingAs($this->inspector)->postJson("/reports/{$photoReport->id}/submit");
        $submitResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertEquals('submitted', $photoReport->fresh()->status);
        $this->assertNotNull($photoReport->fresh()->submitted_at);
    }

    public function test_photo_modifications_are_forbidden_when_report_is_submitted_or_closed(): void
    {
        $photo = Photo::create([
            'report_id' => $this->report->id,
            'vessel_name' => $this->report->vessel_name,
            'item_no' => 1,
            'title' => 'Test Photo',
            'original_filename' => 'test.jpg',
            'file_path' => 'photos/test.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => $this->inspector->id,
            'sort_order' => 1,
        ]);

        // Submit the report
        $this->report->update(['status' => 'submitted']);

        // 1. Uploading a new photo must be forbidden (403)
        $file = UploadedFile::fake()->image('new.jpg');
        $this->actingAs($this->inspector)
            ->postJson("/reports/{$this->report->id}/photos", [
                'photos' => [$file],
            ])
            ->assertStatus(403);

        // 2. Editing photo metadata must be forbidden (403)
        $this->actingAs($this->inspector)
            ->putJson("/reports/{$this->report->id}/photos/{$photo->id}", [
                'title' => 'Updated Title',
            ])
            ->assertStatus(403);

        // 3. Deleting a photo must be forbidden (403)
        $this->actingAs($this->inspector)
            ->deleteJson("/reports/{$this->report->id}/photos/{$photo->id}")
            ->assertStatus(403);

        // 4. Reordering photos must be forbidden (403)
        $this->actingAs($this->inspector)
            ->postJson("/reports/{$this->report->id}/photos/reorder", [
                'order' => [$photo->id],
            ])
            ->assertStatus(403);
    }
}
