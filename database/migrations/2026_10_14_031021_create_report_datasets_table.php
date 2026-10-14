<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('report_datasets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('dataset_key', 100);
            $table->json('rows');
            $table->unsignedInteger('row_version')->default(1);
            $table->string('client_save_id', 100)->nullable();
            $table->timestamps();

            $table->unique(['report_id', 'dataset_key']);
            $table->index(['report_id', 'dataset_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('report_datasets');
    }
};
