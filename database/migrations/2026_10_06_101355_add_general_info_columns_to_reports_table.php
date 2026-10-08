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
            $table->string('port')->nullable()->after('report_date');
            $table->string('inspected_by')->nullable()->after('port');
            $table->boolean('sailing_with_vessel')->default(false)->after('inspected_by');
            $table->string('sailing_from')->nullable()->after('sailing_with_vessel');
            $table->string('sailing_to')->nullable()->after('sailing_from');
            $table->string('psc_last_port')->nullable()->after('chief_officer_name');
            $table->date('psc_last_date')->nullable()->after('psc_last_port');
            $table->boolean('psc_detained_or_deficiencies')->default(false)->after('psc_last_date');
            $table->date('drydock_last_date')->nullable()->after('psc_detained_or_deficiencies');
            $table->date('drydock_next_date')->nullable()->after('drydock_last_date');
            $table->json('operations')->nullable()->after('drydock_next_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn([
                'port',
                'inspected_by',
                'sailing_with_vessel',
                'sailing_from',
                'sailing_to',
                'psc_last_port',
                'psc_last_date',
                'psc_detained_or_deficiencies',
                'drydock_last_date',
                'drydock_next_date',
                'operations',
            ]);
        });
    }
};
