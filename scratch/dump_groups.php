<?php

use App\Models\Form;
use Illuminate\Contracts\Console\Kernel;

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$form = Form::where('code', 'D-062')->first();
$chapters = $form->groups()->whereNull('parent_id')->orderBy('sort_order')->with('subgroups')->get();

foreach ($chapters as $ch) {
    echo "Chapter {$ch->chapter_no}: [{$ch->title}]\n";
    foreach ($ch->subgroups as $sg) {
        echo "   -> Subgroup: [{$sg->title}]\n";
    }
}
