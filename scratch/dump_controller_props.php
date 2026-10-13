<?php

use App\Http\Controllers\Admin\FormController;
use App\Models\Form;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$user = User::where('role', 'superadmin')->orWhere('role', 'admin')->first();
if (! $user) {
    $user = User::first();
}

$request = Request::create('/admin/forms/1', 'GET');
$request->setUserResolver(fn () => $user);

$controller = new FormController;
$form = Form::find(1);
$response = $controller->show($request, $form);

$data = $response->toResponse($request)->original->getData()['page']['props'];

echo 'Form: '.$data['form']['code'].' - '.$data['form']['name']."\n";
echo 'Chapters count: '.count($data['chapters'])."\n";

foreach (array_slice($data['chapters'], 0, 5) as $ch) {
    echo 'Chapter: '.($ch['chapter_no'] ? "Ch. {$ch['chapter_no']} " : '').$ch['title']."\n";
    echo '  Direct questions: '.count($ch['questions'])."\n";
    echo '  Subgroups: '.count($ch['subgroups'])."\n";
    foreach ($ch['subgroups'] as $sg) {
        echo '    - Subgroup: '.$sg['title'].' ('.count($sg['questions'])." questions)\n";
        if (count($sg['questions']) > 0) {
            echo '        q1: '.substr($sg['questions'][0]['question_text'], 0, 40)."...\n";
        }
    }
}
