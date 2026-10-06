<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FleetVesselSeeder extends Seeder
{
    /**
     * Seed fleet vessel accounts and superadmin.
     */
    public function run(): void
    {
        // Super Admin
        User::updateOrCreate(
            ['email' => 'admin@pmsabb.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'superadmin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $vesselEmails = [
            'asuwa@ptabb.com' => 'PB.ASUWA',
            'beliniix@ptabb.com' => 'BELINIIX',
            'camilla@ptabb.com' => 'CAMILLA',
            'charlotte@ptabb.com' => 'CHARLOTTE',
            'daryamaju@ptabb.com' => 'DARYA MAJU',
            'fuji8@ptabb.com' => 'FUJI 8',
            'fuyo18@ptabb.com' => 'FUYO 18',
            'homanzan@ptabb.com' => 'HOMANZAN',
            'iriana@ptabb.com' => 'IRIANA',
            'kaiya@ptabb.com' => 'KAIYA',
            'kenyo@ptabb.com' => 'KENYO',
            'kunimi@ptabb.com' => 'KUNIMI',
            'meutiaandalasvii@ptabb.com' => 'MEUTIA ANDALAS VII',
            'montok@ptabb.com' => 'MONTOK',
            'mumbai@ptabb.com' => 'MUMBAI',
            'nagako@ptabb.com' => 'NAGAKO',
            'oshima@ptabb.com' => 'OSHIMA',
            'prilly@ptabb.com' => 'PRILLY',
            'reiko@ptabb.com' => 'REIKO',
            'ryoko8@ptabb.com' => 'RYOKO 8',
            'sariandalasv@ptabb.com' => 'SARI ANDALAS V',
            'sensho@ptabb.com' => 'SENSHO',
            'sophia@ptabb.com' => 'SOPHIA',
            'unggul@ptabb.com' => 'UNGGUL',
            'yoshin@ptabb.com' => 'YOSHIN',
            'yurico@ptabb.com' => 'YURICO',
        ];

        foreach ($vesselEmails as $email => $vName) {
            User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $vName,
                    'password' => Hash::make('password'),
                    'role' => 'vessel',
                    'vessel_name' => $vName,
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}
