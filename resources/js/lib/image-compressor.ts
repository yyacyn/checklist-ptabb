/**
 * Client-side Image Optimization & Compression Utility (SRS §8, IMG-2, IMG-2a)
 * Resizes images to max 2000px longest edge, compresses to JPEG 0.8 quality,
 * and converts HEIC/HEIF files when supported.
 */

export interface CompressionOptions {
    maxEdge?: number;
    quality?: number;
}

export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<{ file: File; originalSize: number; compressedSize: number; wasCompressed: boolean }> {
    const maxEdge = options.maxEdge ?? 2000;
    const quality = options.quality ?? 0.8;
    const originalSize = file.size;

    // Check if image file
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const isHeic = fileType.includes('heic') || fileType.includes('heif') || fileName.endsWith('.heic') || fileName.endsWith('.heif');
    const isImage = fileType.startsWith('image/') || isHeic;

    if (!isImage) {
        return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    try {
        const imageBitmap = await createImageBitmapOrFallback(file);
        const { width, height } = calculateAspectRatioFit(imageBitmap.width, imageBitmap.height, maxEdge);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
        }

        ctx.drawImage(imageBitmap, 0, 0, width, height);

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });

        if (!blob) {
            return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
        }

        const outFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
        const compressedFile = new File([blob], outFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });

        return {
            file: compressedFile,
            originalSize,
            compressedSize: compressedFile.size,
            wasCompressed: true,
        };
    } catch (error) {
        console.warn('Client-side compression fallback to original file:', error);
        return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }
}

async function createImageBitmapOrFallback(file: File): Promise<{ width: number; height: number } & (ImageBitmap | HTMLImageElement)> {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file);
        } catch {
            // Fall back to Image element
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

function calculateAspectRatioFit(srcWidth: number, srcHeight: number, maxEdge: number) {
    if (srcWidth <= maxEdge && srcHeight <= maxEdge) {
        return { width: srcWidth, height: srcHeight };
    }

    if (srcWidth > srcHeight) {
        const ratio = maxEdge / srcWidth;
        return {
            width: maxEdge,
            height: Math.round(srcHeight * ratio),
        };
    } else {
        const ratio = maxEdge / srcHeight;
        return {
            width: Math.round(srcWidth * ratio),
            height: maxEdge,
        };
    }
}
