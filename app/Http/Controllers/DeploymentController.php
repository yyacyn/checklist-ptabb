<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Artisan;

class DeploymentController extends Controller
{
    /**
     * First-time deployment endpoint: migrations, seeders, storage link, cache setup.
     *
     * Example URLs:
     * - /deploy/init?key=YOUR_DEPLOY_KEY
     * - /deploy/first-time?key=YOUR_DEPLOY_KEY&fresh=true
     */
    public function init(Request $request): JsonResponse|Response
    {
        // Enforce array session driver so database sessions are never queried on unmigrated databases
        config(['session.driver' => 'array']);

        set_time_limit(300);
        ignore_user_abort(true);

        $startTime = microtime(true);
        $steps = [];

        // 1. Storage symlink
        $steps[] = $this->runArtisan('storage:link');

        // 2. Migration
        if ($request->boolean('fresh')) {
            $steps[] = $this->runArtisan('migrate:fresh', ['--force' => true]);
        } else {
            $steps[] = $this->runArtisan('migrate', ['--force' => true]);
        }

        // 3. Database seeding
        $steps[] = $this->runArtisan('db:seed', ['--force' => true]);

        // 4. Cache & view clearing
        $steps[] = $this->runArtisan('optimize:clear');

        // 5. Optional caching/optimization if requested
        if ($request->boolean('optimize')) {
            $steps[] = $this->runArtisan('config:cache');
            $steps[] = $this->runArtisan('route:cache');
            $steps[] = $this->runArtisan('view:cache');
        }

        $duration = round(microtime(true) - $startTime, 3);
        $hasErrors = collect($steps)->contains(fn ($s) => ($s['exit_code'] ?? 0) !== 0);

        $data = [
            'status' => $hasErrors ? 'completed_with_errors' : 'success',
            'action' => 'first_time_deploy',
            'environment' => app()->environment(),
            'timestamp' => now()->toIso8601String(),
            'duration_seconds' => $duration,
            'steps' => $steps,
        ];

        return $this->formatResponse($request, $data, 'First-Time Deployment');
    }

    /**
     * Maintenance deployment endpoint: clear views, caches, routes, config, storage link, etc.
     *
     * Example URLs:
     * - /deploy/maintenance?key=YOUR_DEPLOY_KEY
     * - /deploy/maint?key=YOUR_DEPLOY_KEY&optimize=true
     */
    public function maintenance(Request $request): JsonResponse|Response
    {
        config(['session.driver' => 'array']);

        set_time_limit(300);
        ignore_user_abort(true);

        $startTime = microtime(true);
        $steps = [];

        // 1. Clear all application caches
        $steps[] = $this->runArtisan('optimize:clear');
        $steps[] = $this->runArtisan('view:clear');
        $steps[] = $this->runArtisan('cache:clear');
        $steps[] = $this->runArtisan('config:clear');
        $steps[] = $this->runArtisan('route:clear');

        // 2. Ensure storage symlink exists
        $steps[] = $this->runArtisan('storage:link');

        // 3. Apply any new migrations (safe if already up to date)
        $steps[] = $this->runArtisan('migrate', ['--force' => true]);

        // 4. Optional caching/optimization if requested
        if ($request->boolean('optimize')) {
            $steps[] = $this->runArtisan('config:cache');
            $steps[] = $this->runArtisan('route:cache');
            $steps[] = $this->runArtisan('view:cache');
        }

        $duration = round(microtime(true) - $startTime, 3);
        $hasErrors = collect($steps)->contains(fn ($s) => ($s['exit_code'] ?? 0) !== 0);

        $data = [
            'status' => $hasErrors ? 'completed_with_errors' : 'success',
            'action' => 'maintenance_deploy',
            'environment' => app()->environment(),
            'timestamp' => now()->toIso8601String(),
            'duration_seconds' => $duration,
            'steps' => $steps,
        ];

        return $this->formatResponse($request, $data, 'Maintenance Deployment');
    }

    /**
     * Run an Artisan command and capture exit code and standard output.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    protected function runArtisan(string $command, array $params = []): array
    {
        try {
            $exitCode = Artisan::call($command, $params);
            $rawOutput = trim(Artisan::output());

            return [
                'command' => $command.($params ? ' '.http_build_query($params, '', ' ') : ''),
                'exit_code' => $exitCode,
                'status' => $exitCode === 0 ? 'success' : 'failed',
                'output' => $rawOutput !== '' ? $rawOutput : '(no output)',
            ];
        } catch (\Throwable $e) {
            return [
                'command' => $command,
                'exit_code' => 1,
                'status' => 'error',
                'output' => $e->getMessage(),
            ];
        }
    }

    /**
     * Format response as JSON or a human-friendly HTML dashboard.
     *
     * @param  array<string, mixed>  $data
     */
    protected function formatResponse(Request $request, array $data, string $title): JsonResponse|Response
    {
        if ($request->wantsJson() || $request->has('json') || $request->query('format') === 'json') {
            return response()->json($data, $data['status'] === 'success' ? 200 : 500, [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        }

        $stepsHtml = '';
        foreach ($data['steps'] as $idx => $step) {
            $stepNum = $idx + 1;
            $isOk = ($step['exit_code'] ?? 0) === 0;
            $badgeColor = $isOk ? '#10b981' : '#ef4444';
            $badgeText = $isOk ? 'OK' : 'FAILED';
            $escapedCommand = htmlspecialchars((string) $step['command']);
            $escapedOutput = htmlspecialchars((string) $step['output']);

            $stepsHtml .= <<<HTML
            <div style="margin-bottom: 16px; background: #1e293b; border-radius: 6px; padding: 14px 16px; border: 1px solid #334155;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600; color: #f8fafc; font-size: 14px;">#{$stepNum} artisan {$escapedCommand}</span>
                <span style="background: {$badgeColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">{$badgeText}</span>
              </div>
              <pre style="margin: 0; padding: 10px; background: #0f172a; color: #94a3b8; border-radius: 4px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; line-height: 1.4;">{$escapedOutput}</pre>
            </div>
HTML;
        }

        $statusColor = $data['status'] === 'success' ? '#10b981' : '#ef4444';
        $statusText = strtoupper(str_replace('_', ' ', (string) $data['status']));
        $jsonUrl = $request->fullUrlWithQuery(['format' => 'json']);

        $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$title} — Deploy Status</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px 16px; }
    .container { max-width: 860px; margin: 0 auto; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    h1 { margin: 0; font-size: 20px; font-weight: 700; color: #f8fafc; }
    .meta { font-size: 12px; color: #94a3b8; margin-top: 6px; }
    .btn { display: inline-block; padding: 6px 12px; border-radius: 4px; background: #334155; color: #f8fafc; text-decoration: none; font-size: 12px; font-weight: 600; }
    .btn:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header-row">
        <div>
          <h1>{$title}</h1>
          <div class="meta">
            Status: <strong style="color: {$statusColor};">{$statusText}</strong> &bull;
            Duration: <strong>{$data['duration_seconds']}s</strong> &bull;
            Env: <strong>{$data['environment']}</strong> &bull;
            Time: <strong>{$data['timestamp']}</strong>
          </div>
        </div>
        <div>
          <a href="{$jsonUrl}" class="btn">&rarr; View JSON</a>
        </div>
      </div>
    </div>

    <div>
      {$stepsHtml}
    </div>
  </div>
</body>
</html>
HTML;

        return response($html, $data['status'] === 'success' ? 200 : 500)
            ->header('Content-Type', 'text/html; charset=UTF-8');
    }
}
