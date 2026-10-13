@php
    $chapterNo = $config['chapter_no'] ?? '16';
    $title = $config['title'] ?? "Chapter {$chapterNo} - Photographic Records";
    $photos = $doc['photos'] ?? [];
    $threshold = $config['photo_appendix_threshold'] ?? 100;
    $shouldSplit = count($photos) > $threshold;
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{{ $title }}</h3>

  @if($shouldSplit)
    <div class="split-note">
      This report contains {{ count($photos) }} photographs. Photographic appendix is compiled as a separate volume due to size limit.
    </div>
  @else
    @forelse($photos as $photo)
      <div class="photo-item">
        @if(!empty($photo['local_path']) && file_exists($photo['local_path']))
          <img src="{{ $photo['local_path'] }}" class="photo-img" alt="Photo #{{ $photo['item_no'] }}">
        @elseif(!empty($photo['file_path']))
          <div class="photo-placeholder">Image file: {{ $photo['file_path'] }}</div>
        @else
          <div class="photo-placeholder">No image file available</div>
        @endif

        <div class="photo-meta">
          <div class="photo-number">Photo #{{ $photo['item_no'] }}</div>
          @if(!empty($photo['title']))
            <div class="photo-title">{{ $photo['title'] }}</div>
          @endif
          @if(!empty($photo['caption']))
            <div class="photo-caption">{{ $photo['caption'] }}</div>
          @endif
          @if(!empty($photo['description']))
            <div class="photo-description">{!! nl2br(e($photo['description'])) !!}</div>
          @endif
          @if(!empty($photo['category_name']))
            <div class="photo-category">Category: {{ $photo['category_name'] }}</div>
          @endif
          @if(!empty($photo['location']))
            <div class="photo-location">Location: {{ $photo['location'] }}</div>
          @endif
        </div>
      </div>
    @empty
      <div class="no-photos" style="font-size:8.5pt;color:#777;font-style:italic;">No photographic records attached.</div>
    @endforelse
  @endif
</div>
