<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageOptimizer
{
    /**
     * Store and optimize an uploaded photo, creating an optimized full-size image and a 400px thumbnail.
     *
     * @return array{file_path: string, thumbnail_path: string, file_size: int, mime_type: string, checksum: string}
     */
    public function storeAndOptimize(UploadedFile $file, int $reportId): array
    {
        $hash = hash_file('sha256', $file->getRealPath());
        $extension = strtolower($file->getClientOriginalExtension());
        if (in_array($extension, ['heic', 'heif'])) {
            $extension = 'jpg';
        }
        $filename = Str::uuid() . '.' . ($extension === 'png' ? 'png' : ($extension === 'webp' ? 'webp' : 'jpg'));
        $thumbFilename = 'thumb_' . $filename;

        $directory = "photos/{$reportId}";
        Storage::disk('public')->makeDirectory($directory);

        $targetPath = Storage::disk('public')->path("{$directory}/{$filename}");
        $thumbPath = Storage::disk('public')->path("{$directory}/{$thumbFilename}");

        $image = $this->createImageFromFile($file);

        if ($image !== null) {
            // Auto-orient based on EXIF
            $image = $this->autoOrient($image, $file);

            // Save full optimized image (max 2000px longest edge if larger)
            $image = $this->resizeIfLarger($image, 2000);
            imagejpeg($image, $targetPath, 85);

            // Generate 400px thumbnail
            $thumbImage = $this->resizeIfLarger($image, 400);
            imagejpeg($thumbImage, $thumbPath, 80);

            imagedestroy($image);
            if ($thumbImage !== $image) {
                imagedestroy($thumbImage);
            }

            $finalSize = filesize($targetPath);
            $mimeType = 'image/jpeg';
        } else {
            // Fallback for non-GD convertible files: save directly
            $file->storeAs($directory, $filename, 'public');
            $file->storeAs($directory, $thumbFilename, 'public');
            $finalSize = $file->getSize();
            $mimeType = $file->getMimeType() ?? 'image/jpeg';
        }

        return [
            'file_path' => "{$directory}/{$filename}",
            'thumbnail_path' => "{$directory}/{$thumbFilename}",
            'file_size' => $finalSize ?: $file->getSize(),
            'mime_type' => $mimeType,
            'checksum' => $hash,
        ];
    }

    /**
     * Create a GD resource from an uploaded file.
     *
     * @return \GdImage|resource|null
     */
    protected function createImageFromFile(UploadedFile $file)
    {
        $path = $file->getRealPath();
        $mime = $file->getMimeType();

        try {
            if ($mime === 'image/jpeg' || str_ends_with(strtolower($file->getClientOriginalName()), '.jpg') || str_ends_with(strtolower($file->getClientOriginalName()), '.jpeg')) {
                return @imagecreatefromjpeg($path);
            }
            if ($mime === 'image/png' || str_ends_with(strtolower($file->getClientOriginalName()), '.png')) {
                return @imagecreatefrompng($path);
            }
            if ($mime === 'image/webp' || str_ends_with(strtolower($file->getClientOriginalName()), '.webp')) {
                return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : null;
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }

    /**
     * Correct orientation based on EXIF orientation flag.
     *
     * @param \GdImage|resource $image
     * @return \GdImage|resource
     */
    protected function autoOrient($image, UploadedFile $file)
    {
        if (!function_exists('exif_read_data')) {
            return $image;
        }

        try {
            $exif = @exif_read_data($file->getRealPath());
            if (!empty($exif['Orientation'])) {
                switch ($exif['Orientation']) {
                    case 3:
                        $rotated = imagerotate($image, 180, 0);
                        if ($rotated !== false) {
                            imagedestroy($image);
                            return $rotated;
                        }
                        break;
                    case 6:
                        $rotated = imagerotate($image, -90, 0);
                        if ($rotated !== false) {
                            imagedestroy($image);
                            return $rotated;
                        }
                        break;
                    case 8:
                        $rotated = imagerotate($image, 90, 0);
                        if ($rotated !== false) {
                            imagedestroy($image);
                            return $rotated;
                        }
                        break;
                }
            }
        } catch (\Throwable) {
            // Ignore EXIF read errors
        }

        return $image;
    }

    /**
     * Resize image if width or height exceeds max edge, preserving aspect ratio.
     *
     * @param \GdImage|resource $image
     * @return \GdImage|resource
     */
    protected function resizeIfLarger($image, int $maxEdge)
    {
        $width = imagesx($image);
        $height = imagesy($image);

        if ($width <= $maxEdge && $height <= $maxEdge) {
            return $image;
        }

        if ($width > $height) {
            $newWidth = $maxEdge;
            $newHeight = (int) round(($height / $width) * $maxEdge);
        } else {
            $newHeight = $maxEdge;
            $newWidth = (int) round(($width / $height) * $maxEdge);
        }

        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        return $newImage;
    }
}
