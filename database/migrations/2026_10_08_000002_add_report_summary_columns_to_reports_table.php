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
        Schema::table('reports', function (Blueprint $table) {
            $table->json('summary_ratings')->nullable()->after('operations');
            $table->text('summary_comments_no')->nullable()->after('summary_ratings');
            $table->text('summary_safety_meetings')->nullable()->after('summary_comments_no');
            $table->text('summary_participants')->nullable()->after('summary_safety_meetings');
            $table->text('summary_concept_understanding')->nullable()->after('summary_participants');
            $table->text('summary_training_needs')->nullable()->after('summary_concept_understanding');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn([
                'summary_ratings',
                'summary_comments_no',
                'summary_safety_meetings',
                'summary_participants',
                'summary_concept_understanding',
                'summary_training_needs',
            ]);
        });
    }
};
