<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for photo categories, photos table, and form photo schema (Task 4.3, PHO-0, PHO-1, PHO-2).
     */
    public function up(): void
    {
        Schema::create('photo_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->nullable()->constrained('reports')->cascadeOnDelete();
            $table->foreignId('report_question_id')->nullable()->constrained('report_questions')->nullOnDelete();
            $table->foreignId('finding_id')->nullable()->constrained('findings')->nullOnDelete();
            $table->foreignId('photo_category_id')->nullable()->constrained('photo_categories')->nullOnDelete();
            $table->string('vessel_name')->index();
            $table->integer('item_no')->default(1);
            $table->string('title')->nullable();
            $table->string('caption')->nullable();
            $table->text('description')->nullable();
            $table->string('location')->nullable();
            $table->string('original_filename');
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type', 100)->default('image/jpeg');
            $table->string('checksum', 64)->nullable()->index();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->dateTime('captured_at')->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('delete_reason')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['report_id', 'sort_order']);
            $table->index(['vessel_name', 'created_at']);
        });

        Schema::table('forms', function (Blueprint $table) {
            $table->json('photo_schema')->nullable()->after('summary_schema');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('photo_schema');
        });

        Schema::dropIfExists('photos');
        Schema::dropIfExists('photo_categories');
    }
};
