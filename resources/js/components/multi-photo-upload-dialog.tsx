import React, { useState, useRef, useEffect } from 'react';
import {
    Camera,
    Check,
    CheckCircle2,
    FileImage,
    Image as ImageIcon,
    Loader2,
    Plus,
    RotateCcw,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compressImage, formatFileSize } from '@/lib/image-compressor';
import type { PhotoCategoryItem, PhotoRecord } from '@/components/photo-chapter-section';

export interface QueuedUploadItem {
    id: string;
    file: File;
    previewUrl: string;
    title: string;
    category_id?: number | null;
    status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
    errorMsg?: string;
    savingsPercent?: number;
    compressedSize?: number;
    uploadedPhoto?: PhotoRecord;
}

interface MultiPhotoUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reportId: number;
    categories?: PhotoCategoryItem[];
    nextItemNo?: number;
    initialFiles?: File[];
    onUploadSuccess: (newPhotos: PhotoRecord[]) => void;
}

function sanitizeFileNameToTitle(name: string): string {
    const withoutExt = name.replace(/\.[^/.]+$/, '');
    return withoutExt
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MultiPhotoUploadDialog({
    open,
    onOpenChange,
    reportId,
    categories = [],
    nextItemNo = 1,
    initialFiles = [],
    onUploadSuccess,
}: MultiPhotoUploadDialogProps) {
    const [queue, setQueue] = useState<QueuedUploadItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadIndex, setUploadIndex] = useState<number | null>(null);
    const [currentStepMsg, setCurrentStepMsg] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [batchCategory, setBatchCategory] = useState<string>('none');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Load initial files if provided when dialog opens
    useEffect(() => {
        if (open && initialFiles.length > 0 && queue.length === 0) {
            addFilesToQueue(initialFiles);
        }
    }, [open, initialFiles]);

    // Clean up object URLs when dialog is closed or unmounted
    useEffect(() => {
        if (!open) {
            queue.forEach((item) => {
                if (item.previewUrl) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
            setQueue([]);
            setIsUploading(false);
            setUploadIndex(null);
            setCurrentStepMsg(null);
            setBatchCategory('none');
        }
    }, [open]);

    const addFilesToQueue = (files: File[] | FileList) => {
        const fileArr = Array.from(files);
        const newItems: QueuedUploadItem[] = fileArr.map((f, i) => {
            let preview = '';
            try {
                preview = URL.createObjectURL(f);
            } catch {
                preview = '';
            }

            return {
                id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
                file: f,
                previewUrl: preview,
                title: sanitizeFileNameToTitle(f.name) || `Photo #${nextItemNo + queue.length + i}`,
                category_id: batchCategory !== 'none' ? Number(batchCategory) : null,
                status: 'pending',
            };
        });

        setQueue((prev) => [...prev, ...newItems]);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFilesToQueue(e.target.files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFilesToQueue(e.dataTransfer.files);
        }
    };

    const handleRemoveItem = (id: string) => {
        setQueue((prev) => {
            const item = prev.find((x) => x.id === id);
            if (item?.previewUrl) {
                URL.revokeObjectURL(item.previewUrl);
            }
            return prev.filter((x) => x.id !== id);
        });
    };

    const handleUpdateTitle = (id: string, newTitle: string) => {
        setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
        );
    };

    const handleUpdateCategory = (id: string, catId: number | null) => {
        setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, category_id: catId } : item))
        );
    };

    const handleApplyBatchCategory = (catVal: string) => {
        setBatchCategory(catVal);
        const catId = catVal === 'none' ? null : Number(catVal);
        setQueue((prev) =>
            prev.map((item) => (item.status === 'pending' ? { ...item, category_id: catId } : item))
        );
    };

    const handleStartUpload = async () => {
        if (queue.length === 0 || isUploading) return;

        setIsUploading(true);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        const newlyUploaded: PhotoRecord[] = [];
        let runningItemNo = nextItemNo;

        for (let i = 0; i < queue.length; i++) {
            const currentItem = queue[i];
            if (currentItem.status === 'success') continue;

            setUploadIndex(i);

            // 1. Compression phase
            setQueue((prev) =>
                prev.map((it, idx) => (idx === i ? { ...it, status: 'compressing' } : it))
            );
            setCurrentStepMsg(`Optimizing photo ${i + 1} of ${queue.length}: "${currentItem.title}"...`);

            let optimizedFile: File;
            let compressedSize = currentItem.file.size;
            let savings = 0;

            try {
                const compResult = await compressImage(currentItem.file, {
                    maxEdge: 2000,
                    quality: 0.8,
                    onStatus: (st) => setCurrentStepMsg(`${st} (${i + 1}/${queue.length})`),
                });

                optimizedFile = compResult.file;
                compressedSize = compResult.compressedSize;
                savings = compResult.savingsPercent;
            } catch (compErr: any) {
                console.warn('Compression error, attempting with original:', compErr);
                optimizedFile = currentItem.file;
            }

            // 2. Upload phase
            setQueue((prev) =>
                prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it))
            );
            setCurrentStepMsg(`Uploading photo ${i + 1} of ${queue.length} (${formatFileSize(compressedSize)})...`);

            const formData = new FormData();
            formData.append('file', optimizedFile);
            formData.append('title', currentItem.title.trim());
            formData.append('caption', currentItem.title.trim());
            formData.append('item_no', String(runningItemNo));

            if (currentItem.category_id) {
                formData.append('photo_category_id', String(currentItem.category_id));
            }

            try {
                const res = await fetch(`/reports/${reportId}/photos`, {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN': csrfToken,
                        Accept: 'application/json',
                    },
                    body: formData,
                });

                if (!res.ok) {
                    const errJson = await res.json().catch(() => null);
                    throw new Error(errJson?.message || `HTTP ${res.status}`);
                }

                const data = await res.json();
                if (data.photo) {
                    newlyUploaded.push(data.photo);
                    runningItemNo++;

                    setQueue((prev) =>
                        prev.map((it, idx) =>
                            idx === i
                                ? {
                                      ...it,
                                      status: 'success',
                                      savingsPercent: savings,
                                      compressedSize: compressedSize,
                                      uploadedPhoto: data.photo,
                                  }
                                : it
                        )
                    );
                }
            } catch (uploadErr: any) {
                console.error(`Error uploading photo #${i + 1}:`, uploadErr);
                setQueue((prev) =>
                    prev.map((it, idx) =>
                        idx === i
                            ? {
                                  ...it,
                                  status: 'error',
                                  errorMsg: uploadErr?.message || 'Upload failed',
                              }
                            : it
                    )
                );
            }
        }

        setIsUploading(false);
        setUploadIndex(null);
        setCurrentStepMsg(null);

        if (newlyUploaded.length > 0) {
            onUploadSuccess(newlyUploaded);
        }

        // If all succeeded, close after brief delay
        const remainingErrors = queue.some((q) => q.status === 'error');
        if (!remainingErrors && newlyUploaded.length === queue.length) {
            setTimeout(() => {
                onOpenChange(false);
            }, 500);
        }
    };

    const pendingCount = queue.filter((x) => x.status === 'pending' || x.status === 'error').length;
    const successCount = queue.filter((x) => x.status === 'success').length;
    const progressPercent = queue.length > 0 ? Math.round((successCount / queue.length) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={(o) => (!isUploading ? onOpenChange(o) : null)}>
            <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs uppercase font-mono gap-1">
                            <Camera className="size-3 text-primary" /> Batch Photo Upload
                        </Badge>
                        {queue.length > 0 && (
                            <Badge variant="secondary" className="text-xs font-semibold">
                                {queue.length} Image{queue.length !== 1 ? 's' : ''} in Queue
                            </Badge>
                        )}
                        {successCount > 0 && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-xs font-medium">
                                {successCount} Uploaded
                            </Badge>
                        )}
                    </div>
                    <DialogTitle className="text-base font-semibold pt-1">
                        Upload Multiple Photos
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Select multiple images or drag & drop. Each image will be compressed for satellite transfer and uploaded sequentially.
                    </DialogDescription>
                </DialogHeader>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Multi-File Dropzone Area */}
                    <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                            isDragOver
                                ? 'border-primary bg-primary/10 scale-[0.99]'
                                : queue.length === 0
                                ? 'border-border hover:border-primary/50 hover:bg-muted/30 py-8'
                                : 'border-border/60 hover:border-primary/40 bg-muted/10 py-4'
                        }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                            onChange={handleFileInputChange}
                            className="hidden"
                            disabled={isUploading}
                        />

                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                                <UploadCloud className="size-5" />
                            </div>
                            <div className="font-semibold text-xs sm:text-sm text-foreground">
                                {queue.length === 0
                                    ? 'Click to select multiple photos or drag and drop files here'
                                    : '+ Click or drag more photos to append to this queue'}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Select 10, 20, or more photos at once. Supports JPG, PNG, WebP, and iOS HEIC.
                            </p>
                        </div>
                    </div>

                    {/* Batch Actions Bar (when queue is populated) */}
                    {queue.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card shadow-2xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {categories.length > 0 && (
                                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                                        <Label className="text-xs text-muted-foreground shrink-0">
                                            Apply Category to All:
                                        </Label>
                                        <Select
                                            value={batchCategory}
                                            onValueChange={handleApplyBatchCategory}
                                            disabled={isUploading}
                                        >
                                            <SelectTrigger className="text-xs h-8">
                                                <SelectValue placeholder="Set category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None / Individual</SelectItem>
                                                {categories.map((c) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 text-muted-foreground"
                                    onClick={() => {
                                        queue.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
                                        setQueue([]);
                                    }}
                                    disabled={isUploading}
                                >
                                    Clear Queue
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Progress Banner */}
                    {isUploading && (
                        <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                            <div className="flex items-center justify-between text-xs font-medium text-foreground">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                                    <span>{currentStepMsg || 'Processing uploads...'}</span>
                                </span>
                                <span className="font-mono text-primary font-bold">
                                    {progressPercent}%
                                </span>
                            </div>
                            <div className="w-full bg-primary/20 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Queue Items List */}
                    {queue.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                                <span>Selected Photos ({queue.length})</span>
                                <span>Items {nextItemNo} to {nextItemNo + queue.length - 1}</span>
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {queue.map((item, idx) => {
                                    const itemSlot = nextItemNo + idx;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-lg border p-2.5 flex items-center gap-3 transition-colors ${
                                                item.status === 'success'
                                                    ? 'bg-emerald-50/40 border-emerald-500/30 dark:bg-emerald-950/10'
                                                    : item.status === 'error'
                                                    ? 'bg-rose-50/40 border-rose-500/30 dark:bg-rose-950/10'
                                                    : item.status === 'compressing' || item.status === 'uploading'
                                                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                                                    : 'bg-card border-border hover:border-muted-foreground/30'
                                            }`}
                                        >
                                            {/* Preview Thumbnail */}
                                            <div className="relative w-14 h-14 rounded-md border bg-muted/40 overflow-hidden shrink-0">
                                                {item.previewUrl ? (
                                                    <img
                                                        src={item.previewUrl}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                        <FileImage className="size-6" />
                                                    </div>
                                                )}
                                                <Badge className="absolute top-0.5 left-0.5 bg-black/75 text-white font-mono text-[9px] px-1 py-0 border-none">
                                                    #{itemSlot}
                                                </Badge>
                                            </div>

                                            {/* Details & Inputs */}
                                            <div className="flex-1 min-w-0 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={item.title}
                                                        disabled={isUploading || item.status === 'success'}
                                                        onChange={(e) => handleUpdateTitle(item.id, e.target.value)}
                                                        placeholder="Photo title / caption"
                                                        className="h-7 text-xs font-medium flex-1"
                                                    />

                                                    {categories.length > 0 && (
                                                        <div className="w-36 shrink-0">
                                                            <Select
                                                                value={item.category_id ? String(item.category_id) : 'none'}
                                                                disabled={isUploading || item.status === 'success'}
                                                                onValueChange={(val) =>
                                                                    handleUpdateCategory(
                                                                        item.id,
                                                                        val === 'none' ? null : Number(val)
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="text-xs h-7">
                                                                    <SelectValue placeholder="Category" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">No category</SelectItem>
                                                                    {categories.map((c) => (
                                                                        <SelectItem key={c.id} value={String(c.id)}>
                                                                            {c.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span className="truncate max-w-[220px]" title={item.file.name}>
                                                        {item.file.name} ({formatFileSize(item.file.size)})
                                                    </span>

                                                    {/* Status indicator */}
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {item.status === 'pending' && (
                                                            <span className="text-muted-foreground">Ready</span>
                                                        )}
                                                        {item.status === 'compressing' && (
                                                            <span className="text-primary flex items-center gap-1">
                                                                <Loader2 className="size-3 animate-spin" /> Optimizing...
                                                            </span>
                                                        )}
                                                        {item.status === 'uploading' && (
                                                            <span className="text-amber-600 flex items-center gap-1">
                                                                <Loader2 className="size-3 animate-spin" /> Uploading...
                                                            </span>
                                                        )}
                                                        {item.status === 'success' && (
                                                            <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                                                <Check className="size-3" /> Uploaded ({item.savingsPercent}% saved)
                                                            </span>
                                                        )}
                                                        {item.status === 'error' && (
                                                            <span className="text-rose-600 font-semibold" title={item.errorMsg}>
                                                                Failed: {item.errorMsg || 'Upload error'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Remove item button */}
                                            {!isUploading && item.status !== 'success' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-muted cursor-pointer shrink-0"
                                                    title="Remove from queue"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
                    <div className="text-xs text-muted-foreground font-medium">
                        {queue.length === 0 ? (
                            'Select images to begin'
                        ) : (
                            <span>
                                {queue.length} photo{queue.length !== 1 ? 's' : ''} queued
                                {successCount > 0 ? ` (${successCount} completed)` : ''}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isUploading}
                        >
                            {successCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleStartUpload}
                            disabled={isUploading || queue.length === 0 || pendingCount === 0}
                            className="gap-1.5"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Uploading ({uploadIndex !== null ? uploadIndex + 1 : 0}/{queue.length})...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="size-3.5" />
                                    <span>
                                        {pendingCount > 1
                                            ? `Upload All (${pendingCount} Photos)`
                                            : pendingCount === 1
                                            ? 'Upload Photo'
                                            : 'Upload Photos'}
                                    </span>
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
