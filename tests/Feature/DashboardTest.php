<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
    }

    public function test_dashboard_renders_with_stats_and_recent_reports()
    {
        $user = User::factory()->superadmin()->create();
        $form = Form::factory()->create();
        $report = Report::factory()->create([
            'form_id' => $form->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);
        Finding::create([
            'report_id' => $report->id,
            'description' => 'Test observation defect',
            'finding_status' => 'open',
        ]);

        $response = $this->actingAs($user)->get(route('dashboard'));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('dashboard')
                ->where('stats.total_reports', 1)
                ->where('stats.draft_reports', 1)
                ->where('stats.open_findings', 1)
                ->has('recent_reports', 1)
                ->where('recent_reports.0.id', $report->id)
                ->where('recent_reports.0.reference_number', $report->reference_number)
            );
    }
}
