<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $doc['meta']['reference_number'] ?? 'Report' }}</title>
    <style>
        {!! $styles !!}
    </style>
</head>
<body>
    {!! $sections !!}
</body>
</html>
