<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Form;
use App\Models\Photo;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\ReportQuestion;
use App\Models\User;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Database\Seeders\PhotoCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhotoSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([FormSeeder::class, PhotoCategorySeeder::class]);
    }

    public function test_photo_categories_are_seeded_with_standard_categories(): void
    {
        $this->assertDatabaseHas('photo_categories', ['code' => 'hull', 'name' => 'Hull condition']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'deck', 'name' => 'Deck condition']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'engine_room', 'name' => 'Engine room condition']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'room_condition', 'name' => 'Room condition']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'bridge', 'name' => 'Bridge condition']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'navigational_equipment', 'name' => 'Navigational equipment']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'safety_equipment', 'name' => 'Safety equipment']);
        $this->assertDatabaseHas('photo_categories', ['code' => 'other', 'name' => 'Other / General']);
    }

    public function test_form_photo_schema_is_persisted_and_cast_as_array(): void
    {
        $form = Form::where('code', 'D-062')->firstOrFail();
        $form->update([
            'photo_schema' => [
                'enabled' => true,
                'title' => 'Chapter 16 - Photographic Records',
                'description' => 'Photographic record of vessel inspection items.',
                'allowed_categories' => ['hull', 'deck', 'engine_room', 'safety_equipment'],
            ],
        ]);

        $form->refresh();
        $this->assertIsArray($form->photo_schema);
        $this->assertTrue($form->photo_schema['enabled']);
        $this->assertEquals('Chapter 16 - Photographic Records', $form->photo_schema['title']);
    }

    public function test_photo_can_be_linked_to_report_question_and_finding(): void
    {
        $user = User::factory()->create(['role' => 'corporate']);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $category = PhotoCategory::where('code', 'safety_equipment')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        $question = $report->questions()->firstOrFail();
        $finding = Finding::create([
            'report_id' => $report->id,
            'description' => 'Defective emergency pump pressure valve.',
            'risk' => 'high',
            'finding_status' => 'open',
        ]);

        $photo = Photo::create([
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'finding_id' => $finding->id,
            'photo_category_id' => $category->id,
            'vessel_name' => '   MV   Oceanic Star  ',
            'item_no' => 1,
            'title' => '1. Emergency Fire Pump Gauge',
            'caption' => 'Gauge showing 0 pressure during test',
            'description' => 'Discovered during weekly maintenance audit on main deck.',
            'location' => 'Main deck fire control station',
            'original_filename' => 'fire_pump_gauge.jpg',
            'file_path' => 'photos/2026/10/fire_pump_gauge.jpg',
            'thumbnail_path' => 'photos/2026/10/thumb_fire_pump_gauge.jpg',
            'file_size' => 450120,
            'mime_type' => 'image/jpeg',
            'checksum' => hash('sha256', 'mock_photo_content'),
            'uploaded_by' => $user->id,
            'captured_at' => now(),
        ]);

        $this->assertDatabaseHas('photos', [
            'id' => $photo->id,
            'vessel_name' => 'MV Oceanic Star', // normalized
            'title' => '1. Emergency Fire Pump Gauge',
            'photo_category_id' => $category->id,
        ]);

        // Assert relations
        $this->assertTrue($photo->report->is($report));
        $this->assertTrue($photo->question->is($question));
        $this->assertTrue($photo->finding->is($finding));
        $this->assertTrue($photo->category->is($category));
        $this->assertTrue($photo->uploader->is($user));

        $this->assertCount(1, $report->fresh()->photos);
        $this->assertCount(1, $question->fresh()->photos);
        $this->assertCount(1, $finding->fresh()->photos);

        // Soft delete verification
        $photo->delete();
        $this->assertSoftDeleted('photos', ['id' => $photo->id]);
    }
}
