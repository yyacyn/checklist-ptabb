<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations to support composable and standalone photo forms (PHO-0).
     */
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->string('form_type', 32)->default('standard')->after('code'); // standard, photo
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('form_type');
        });
    }
};
