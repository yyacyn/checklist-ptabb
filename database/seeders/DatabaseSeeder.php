<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Order matters: the question templates go in first, because a fresh environment
     * should never look like an empty app. Both calls are idempotent, so
     * `php artisan migrate --seed` is safe to run again.
     */
    public function run(): void
    {
        // The D-062 and B-008 question catalogues, from the reviewed CSV files
        // (SRS section 5). Skips itself if those files are not in the repo, so a
        // production deploy that excludes spikes/ still seeds cleanly.
        $this->call(FormSeeder::class);

        // User::factory(10)->create();

        if (! User::query()->where('email', 'test@example.com')->exists()) {
            User::factory()->create([
                'name' => 'Superadmin User',
                'email' => 'test@example.com',
                'role' => 'superadmin',
            ]);
        }

        if (! User::query()->where('email', 'corporate@example.com')->exists()) {
            User::factory()->create([
                'name' => 'Capt. H. Miller (Superintendent)',
                'email' => 'corporate@example.com',
                'role' => 'corporate',
            ]);
        }

        if (! User::query()->where('email', 'vessel@example.com')->exists()) {
            User::factory()->create([
                'name' => 'MV Amarin Glory (Ship Account)',
                'email' => 'vessel@example.com',
                'role' => 'vessel',
                'vessel_name' => 'MV Amarin Glory',
            ]);
        }

        $this->call(FleetVesselSeeder::class);
    }
}
