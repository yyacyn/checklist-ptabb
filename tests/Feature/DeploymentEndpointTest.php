<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeploymentEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_time_deploy_endpoint_executes_successfully(): void
    {
        $response = $this->getJson(route('deploy.init'));

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'action' => 'first_time_deploy',
            ])
            ->assertJsonStructure([
                'status',
                'action',
                'environment',
                'timestamp',
                'duration_seconds',
                'steps' => [
                    '*' => ['command', 'exit_code', 'status', 'output'],
                ],
            ]);

        $commands = array_column($response->json('steps'), 'command');
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'storage:link')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'migrate')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'db:seed')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'optimize:clear')));
    }

    public function test_maintenance_deploy_endpoint_executes_successfully(): void
    {
        $response = $this->getJson(route('deploy.maintenance'));

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'action' => 'maintenance_deploy',
            ])
            ->assertJsonStructure([
                'status',
                'action',
                'environment',
                'timestamp',
                'duration_seconds',
                'steps' => [
                    '*' => ['command', 'exit_code', 'status', 'output'],
                ],
            ]);

        $commands = array_column($response->json('steps'), 'command');
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'optimize:clear')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'view:clear')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'cache:clear')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'config:clear')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'route:clear')));
        $this->assertTrue(collect($commands)->contains(fn ($c) => str_contains($c, 'storage:link')));
    }

    public function test_browser_receives_html_dashboard(): void
    {
        $response = $this->get(route('deploy.maintenance'));

        $response->assertStatus(200);
        $this->assertStringContainsString('Maintenance Deployment', $response->getContent());
        $this->assertStringContainsString('artisan optimize:clear', $response->getContent());
        $this->assertStringContainsString('&rarr; View JSON', $response->getContent());
    }

    public function test_endpoints_are_fully_public_without_any_authentication_or_token(): void
    {
        // Unauthenticated guest can access first-time deploy
        $initResponse = $this->get(route('deploy.init'));
        $initResponse->assertStatus(200);

        // Unauthenticated guest can access maintenance deploy
        $maintResponse = $this->get(route('deploy.maintenance'));
        $maintResponse->assertStatus(200);
    }

    public function test_deploy_init_works_when_database_session_driver_configured_without_sessions_table(): void
    {
        config(['session.driver' => 'database']);
        Schema::dropIfExists('sessions');

        $response = $this->get(route('deploy.init'));
        $response->assertStatus(200);
    }
}
