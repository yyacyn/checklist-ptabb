/**
 * Client-side Image Optimization & Compression Utility (SRS §8, IMG-2, IMG-2a, IMG-4)
 * - Resizes images to max 2000px longest edge, compresses to JPEG 0.8 quality
 * - Converts HEIC/HEIF files (iOS/Safari) to JPEG before processing
 * - Preserves EXIF orientation
 * - Drastically saves VSAT satellite bandwidth by shrinking 15-20MB originals to ~300-600KB
 */

export interface CompressionOptions {
    maxEdge?: number;
    quality?: number;
    maxOriginalSizeBytes?: number; // default: 50MB safety limit
    onStatus?: (status: string) => void;
}

export interface CompressionResult {
    file: File;
    originalSize: number;
    compressedSize: number;
    savingsPercent: number;
    width: number;
    height: number;
    wasCompressed: boolean;
}

export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<CompressionResult> {
    const maxEdge = options.maxEdge ?? 2000;
    const quality = options.quality ?? 0.8;
    const maxOriginalSize = options.maxOriginalSizeBytes ?? 50 * 1024 * 1024; // 50MB
    const originalSize = file.size;

    if (originalSize > maxOriginalSize) {
        throw new Error(
            `File is too large (${(originalSize / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${(maxOriginalSize / (1024 * 1024)).toFixed(0)} MB.`
        );
    }

    const fileNameLower = file.name.toLowerCase();
    const fileTypeLower = file.type.toLowerCase();

    const isHeic =
        fileTypeLower.includes('heic') ||
        fileTypeLower.includes('heif') ||
        fileNameLower.endsWith('.heic') ||
        fileNameLower.endsWith('.heif');

    const isStandardImage =
        fileTypeLower.startsWith('image/') ||
        fileNameLower.endsWith('.jpg') ||
        fileNameLower.endsWith('.jpeg') ||
        fileNameLower.endsWith('.png') ||
        fileNameLower.endsWith('.webp');

    if (!isHeic && !isStandardImage) {
        throw new Error(`Unsupported file type (${file.type || 'unknown'}). Please select a JPEG, PNG, WebP, or HEIC photo.`);
    }

    let workingBlob: Blob = file;

    // 1. Convert HEIC/HEIF to JPEG if needed
    if (isHeic) {
        options.onStatus?.('Converting HEIC image to JPEG...');
        try {
            // Dynamic import to support SSR and avoid bundling overhead when not needed
            // @ts-ignore
            const heic2anyModule = await import('heic2any');
            const heic2any = heic2anyModule.default || heic2anyModule;
            const converted = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9,
            });

            workingBlob = Array.isArray(converted) ? converted[0] : converted;
        } catch (heicErr) {
            console.warn('HEIC conversion failed, trying direct bitmap fallback:', heicErr);
            // Will attempt standard bitmap loading below
        }
    }

    // 2. Decode image and determine dimensions
    options.onStatus?.('Analyzing image dimensions...');
    try {
        const { bitmapOrImage, width: origW, height: origH } = await decodeImage(workingBlob);

        const { width: targetW, height: targetH } = calculateAspectRatioFit(origW, origH, maxEdge);

        // If already within dimensions and not converted from HEIC and under 1MB, we could skip re-encoding
        // but re-encoding ensures uniform JPEG compression & EXIF strip
        options.onStatus?.(`Resizing image to ${targetW}x${targetH}px...`);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
            throw new Error('Canvas 2D context is not available.');
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(bitmapOrImage, 0, 0, targetW, targetH);

        // Clean up ImageBitmap if applicable
        if ('close' in bitmapOrImage && typeof (bitmapOrImage as ImageBitmap).close === 'function') {
            (bitmapOrImage as ImageBitmap).close();
        }

        options.onStatus?.('Compressing image for VSAT transfer...');
        const compressedBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });

        if (!compressedBlob) {
            throw new Error('Failed to encode image to JPEG blob.');
        }

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const outputFilename = `${baseName}.jpg`;

        const finalFile = new File([compressedBlob], outputFilename, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });

        const compressedSize = finalFile.size;
        const savingsPercent = originalSize > 0
            ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
            : 0;

        options.onStatus?.('Optimization complete');

        return {
            file: finalFile,
            originalSize,
            compressedSize,
            savingsPercent,
            width: targetW,
            height: targetH,
            wasCompressed: true,
        };
    } catch (error: any) {
        console.warn('Client-side compression fallback to original file:', error);

        // If compression failed but it's a valid standard image, return original as fallback
        if (isStandardImage && !isHeic) {
            return {
                file,
                originalSize,
                compressedSize: originalSize,
                savingsPercent: 0,
                width: 0,
                height: 0,
                wasCompressed: false,
            };
        }

        throw new Error(error?.message || 'Failed to process and compress selected image.');
    }
}

/**
 * Decode blob using modern createImageBitmap with EXIF orientation support,
 * falling back to HTMLImageElement.
 */
async function decodeImage(
    blob: Blob
): Promise<{ bitmapOrImage: ImageBitmap | HTMLImageElement; width: number; height: number }> {
    if (typeof createImageBitmap === 'function') {
        try {
            // imageOrientation: 'from-image' automatically respects EXIF rotation tag
            const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
            return {
                bitmapOrImage: bitmap,
                width: bitmap.width,
                height: bitmap.height,
            };
        } catch {
            // Fall back to Image element
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                bitmapOrImage: img,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
            });
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode image data. The file may be corrupt or an unsupported format.'));
        };

        img.src = url;
    });
}

/**
 * Calculate proportional dimensions bounded by maxEdge on the longest side.
 */
function calculateAspectRatioFit(srcWidth: number, srcHeight: number, maxEdge: number) {
    if (srcWidth <= 0 || srcHeight <= 0) {
        return { width: maxEdge, height: maxEdge };
    }

    if (srcWidth <= maxEdge && srcHeight <= maxEdge) {
        return { width: srcWidth, height: srcHeight };
    }

    if (srcWidth >= srcHeight) {
        const ratio = maxEdge / srcWidth;
        return {
            width: maxEdge,
            height: Math.max(1, Math.round(srcHeight * ratio)),
        };
    } else {
        const ratio = maxEdge / srcHeight;
        return {
            width: Math.max(1, Math.round(srcWidth * ratio)),
            height: maxEdge,
        };
    }
}

/**
 * Format bytes into human readable KB / MB string.
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
