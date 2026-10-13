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
    @if(!empty($doc['meta']['watermark']))
        <div class="watermark">{{ $doc['meta']['watermark'] }}</div>
    @endif

    {!! $sections !!}

    <div class="footer">{{ $footerText }}</div>
</body>
</html>
