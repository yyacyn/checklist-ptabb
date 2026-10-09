<?php

namespace Database\Seeders;

use App\Models\PhotoCategory;
use Illuminate\Database\Seeder;

class PhotoCategorySeeder extends Seeder
{
    /**
     * Seed standard maritime photographic categories (SRS §8.1).
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Hull condition',
                'code' => 'hull',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'Deck condition',
                'code' => 'deck',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => 'Engine room condition',
                'code' => 'engine_room',
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'name' => 'Room condition',
                'code' => 'room_condition',
                'sort_order' => 4,
                'is_active' => true,
            ],
            [
                'name' => 'Bridge condition',
                'code' => 'bridge',
                'sort_order' => 5,
                'is_active' => true,
            ],
            [
                'name' => 'Navigational equipment',
                'code' => 'navigational_equipment',
                'sort_order' => 6,
                'is_active' => true,
            ],
            [
                'name' => 'Safety equipment',
                'code' => 'safety_equipment',
                'sort_order' => 7,
                'is_active' => true,
            ],
            [
                'name' => 'Other / General',
                'code' => 'other',
                'sort_order' => 8,
                'is_active' => true,
            ],
        ];

        foreach ($categories as $category) {
            PhotoCategory::updateOrCreate(
                ['code' => $category['code']],
                $category
            );
        }
    }
}
