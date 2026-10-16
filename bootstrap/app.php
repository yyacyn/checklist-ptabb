<?php

use App\Http\Controllers\DeploymentController;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            // Completely stateless deployment endpoints: NO web middleware, NO database session query!
            Route::match(['get', 'post'], 'deploy/init', [DeploymentController::class, 'init'])->name('deploy.init');
            Route::match(['get', 'post'], 'deploy/first-time', [DeploymentController::class, 'init'])->name('deploy.first-time');
            Route::match(['get', 'post'], 'deploy/maintenance', [DeploymentController::class, 'maintenance'])->name('deploy.maintenance');
            Route::match(['get', 'post'], 'deploy/maint', [DeploymentController::class, 'maintenance'])->name('deploy.maint');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
