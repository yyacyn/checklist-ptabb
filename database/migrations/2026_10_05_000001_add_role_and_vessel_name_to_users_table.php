<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // SRS section 2: three roles. There is no vessels table (SRS 2.1), so a
            // vessel user's scope is a normalised vessel name on their own account.
            $table->string('role')->default('corporate')->after('email_verified_at');
            $table->string('vessel_name')->nullable()->after('role');
            $table->boolean('is_active')->default(true)->after('vessel_name');
            $table->softDeletes();

            $table->index('vessel_name');
            $table->index(['role', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'is_active']);
            $table->dropIndex(['vessel_name']);
            $table->dropColumn(['role', 'vessel_name', 'is_active']);
            $table->dropSoftDeletes();
        });
    }
};
