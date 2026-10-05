<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PageTest extends TestCase
{
    public function test_welcome_page_is_rendered_by_inertia(): void
    {
        $this->get('/')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Welcome')
                ->where('appName', config('app.name')),
            );
    }

    public function test_about_page_is_rendered_by_inertia(): void
    {
        $this->get('/about')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('About'),
            );
    }
}