import React, { useState, useRef } from 'react';
import {
    Camera,
    Check,
    FileImage,
    Image as ImageIcon,
    Link2,
    Loader2,
    Maximize2,
    Plus,
    Search,
    Trash2,
    UploadCloud,
    Unlink,
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
import {
    getPhotoFullSrc,
    getPhotoThumbnailSrc,
    type PhotoCategoryItem,
    type PhotoRecord,
} from '@/components/photo-chapter-section';

interface PhotoEvidenceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reportId: number;
    targetType: 'question' | 'finding';
    targetId: number;
    targetTitle: string;
    reportPhotos: PhotoRecord[];
    categories?: PhotoCategoryItem[];
    onPhotosUpdated: (allUpdatedPhotos: PhotoRecord[]) => void;
}

export function PhotoEvidenceDialog({
    open,
    onOpenChange,
    reportId,
    targetType,
    targetId,
    targetTitle,
    reportPhotos = [],
    categories = [],
    onPhotosUpdated,
}: PhotoEvidenceDialogProps) {
    const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadTitle, setUploadTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('none');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [linkingPhotoId, setLinkingPhotoId] = useState<number | null>(null);
    const [librarySearch, setLibrarySearch] = useState('');
    const [previewPhoto, setPreviewPhoto] = useState<PhotoRecord | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Photos currently attached to this question / finding
    const attachedPhotos = reportPhotos.filter((p) =>
        targetType === 'question' ? p.report_question_id === targetId : p.finding_id === targetId
    );

    // Filter library photos
    const filteredLibraryPhotos = reportPhotos.filter((p) => {
        if (!librarySearch.trim()) return true;
        const query = librarySearch.toLowerCase();
        return (
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.caption && p.caption.toLowerCase().includes(query)) ||
            (p.description && p.description.toLowerCase().includes(query)) ||
            (p.category?.name && p.category.name.toLowerCase().includes(query))
        );
    });

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (uploadFiles.length === 0) return;

        setIsUploading(true);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        let currentPhotos = [...reportPhotos];

        try {
            for (let i = 0; i < uploadFiles.length; i++) {
                const currentFile = uploadFiles[i];
                setUploadProgress(`Optimizing photo ${i + 1} of ${uploadFiles.length}...`);

                const { file: optimizedFile, compressedSize, savingsPercent } = await compressImage(currentFile, {
                    maxEdge: 2000,
                    quality: 0.8,
                    onStatus: (status) => setUploadProgress(`${status} (${i + 1}/${uploadFiles.length})`),
                });

                setUploadProgress(`Uploading photo ${i + 1} of ${uploadFiles.length} (${formatFileSize(compressedSize)})...`);

                const fileCleanName = currentFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
                let titleToUse: string;
                if (uploadFiles.length === 1) {
                    titleToUse = uploadTitle.trim() || `Evidence - ${targetTitle}`;
                } else {
                    titleToUse = uploadTitle.trim()
                        ? `${uploadTitle.trim()} (${i + 1})`
                        : fileCleanName || `Evidence - ${targetTitle} (${i + 1})`;
                }

                const formData = new FormData();
                formData.append('file', optimizedFile);
                formData.append('title', titleToUse);
                formData.append('caption', titleToUse);

                if (targetType === 'question') {
                    formData.append('report_question_id', String(targetId));
                } else {
                    formData.append('finding_id', String(targetId));
                }

                if (selectedCategory && selectedCategory !== 'none') {
                    formData.append('photo_category_id', selectedCategory);
                }

                const res = await fetch(`/reports/${reportId}/photos`, {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN': csrfToken,
                        Accept: 'application/json',
                    },
                    body: formData,
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => null);
                    throw new Error(errData?.message || `Upload failed on photo ${i + 1} with status ${res.status}`);
                }

                const data = await res.json();
                if (data.photo) {
                    currentPhotos.push(data.photo);
                }
            }

            onPhotosUpdated(currentPhotos);
            setUploadFiles([]);
            setUploadTitle('');
            setSelectedCategory('none');
            if (fileInputRef.current) fileInputRef.current.value = '';
            onOpenChange(false);
        } catch (err: any) {
            console.error('Error uploading photo evidence:', err);
            alert(err?.message || 'Failed to upload photo evidence.');
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const handleToggleLink = async (photo: PhotoRecord) => {
        const isCurrentlyLinked =
            targetType === 'question' ? photo.report_question_id === targetId : photo.finding_id === targetId;

        setLinkingPhotoId(photo.id);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const payload: Record<string, any> = {};

            if (targetType === 'question') {
                payload.report_question_id = isCurrentlyLinked ? null : targetId;
            } else {
                payload.finding_id = isCurrentlyLinked ? null : targetId;
            }

            const res = await fetch(`/reports/${reportId}/photos/${photo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || `Link update failed with status ${res.status}`);
            }

            const data = await res.json();
            if (data.photo) {
                const updatedPhotos = reportPhotos.map((p) => (p.id === photo.id ? data.photo : p));
                onPhotosUpdated(updatedPhotos);
            }
        } catch (err: any) {
            console.error('Error updating photo link:', err);
            alert(err?.message || 'Failed to link photo.');
        } finally {
            setLinkingPhotoId(null);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs uppercase font-mono">
                                {targetType === 'question' ? 'Question Evidence' : 'Finding Evidence'}
                            </Badge>
                            {attachedPhotos.length > 0 && (
                                <Badge variant="secondary" className="text-xs font-semibold">
                                    {attachedPhotos.length} Attached
                                </Badge>
                            )}
                        </div>
                        <DialogTitle className="text-base font-semibold truncate pt-1">
                            {targetTitle}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Upload new photo evidence or 1-click link from existing report photos.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab Navigation */}
                    <div className="flex border-b px-5 bg-muted/10">
                        <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'upload'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <UploadCloud className="size-3.5" />
                            <span>Upload New Photo</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('library')}
                            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'library'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <ImageIcon className="size-3.5" />
                            <span>Report Photo Library ({reportPhotos.length})</span>
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto flex-1">
                        {activeTab === 'upload' ? (
                            <form onSubmit={handleUploadSubmit} className="space-y-4">
                                {/* Dropzone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                            const files = Array.from(e.dataTransfer.files);
                                            setUploadFiles(files);
                                            if (!uploadTitle && files.length === 1) {
                                                const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
                                                setUploadTitle(cleanName);
                                            }
                                        }
                                    }}
                                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                                        uploadFiles.length > 0
                                            ? 'border-primary/50 bg-primary/5'
                                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        multiple
                                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                const files = Array.from(e.target.files);
                                                setUploadFiles(files);
                                                if (!uploadTitle && files.length === 1) {
                                                    const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
                                                    setUploadTitle(cleanName);
                                                }
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    {uploadFiles.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                                                <Check className="size-6" />
                                            </div>
                                            <div className="font-semibold text-sm text-foreground">
                                                {uploadFiles.length === 1
                                                    ? uploadFiles[0].name
                                                    : `${uploadFiles.length} Photos Selected for Evidence`}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Total size: {formatFileSize(uploadFiles.reduce((acc, f) => acc + f.size, 0))} (client-compressed to &le; 2000px)
                                            </p>
                                            <div className="flex items-center justify-center gap-2 pt-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="text-xs h-7"
                                                >
                                                    Select Different Photos
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setUploadFiles([]);
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                    }}
                                                    className="text-xs h-7 text-destructive hover:bg-destructive/10"
                                                >
                                                    Clear
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                                                <Camera className="size-6" />
                                            </div>
                                            <div className="font-semibold text-sm text-foreground">
                                                Click to select photo(s) or drag & drop images
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Select one or multiple photos (JPG, PNG, WebP, HEIC). Automatically compressed for VSAT satellite bandwidth.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Title / Caption */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="evidence_title" className="text-xs">
                                        Title / Description (Optional)
                                    </Label>
                                    <Input
                                        id="evidence_title"
                                        placeholder={`e.g. Evidence for ${targetTitle}`}
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                        className="text-xs h-9"
                                    />
                                </div>

                                {/* Category */}
                                {categories.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="evidence_category" className="text-xs">
                                            Photo Category (Optional)
                                        </Label>
                                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                            <SelectTrigger id="evidence_category" className="text-xs h-9">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No specific category</SelectItem>
                                                {categories.map((c) => (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {uploadProgress && (
                                    <div className="p-3 rounded-lg bg-primary/10 text-primary text-xs flex items-center gap-2">
                                        <Loader2 className="size-4 animate-spin shrink-0" />
                                        <span>{uploadProgress}</span>
                                    </div>
                                )}

                                <DialogFooter className="pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onOpenChange(false)}
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isUploading || uploadFiles.length === 0}
                                        className="gap-1.5"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="size-3.5 animate-spin" />
                                                <span>Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="size-3.5" />
                                                <span>
                                                    {uploadFiles.length > 1
                                                        ? `Upload & Attach ${uploadFiles.length} Photos`
                                                        : 'Upload & Attach'}
                                                </span>
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        ) : (
                            /* Library Tab */
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search existing photos by title or category..."
                                        value={librarySearch}
                                        onChange={(e) => setLibrarySearch(e.target.value)}
                                        className="text-xs h-9 pl-8"
                                    />
                                </div>

                                {filteredLibraryPhotos.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground space-y-2">
                                        <ImageIcon className="size-10 mx-auto opacity-30" />
                                        <p className="text-xs font-medium">No report photos match your query.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {filteredLibraryPhotos.map((photo) => {
                                            const isLinked =
                                                targetType === 'question'
                                                    ? photo.report_question_id === targetId
                                                    : photo.finding_id === targetId;

                                            const isLinking = linkingPhotoId === photo.id;

                                            return (
                                                <div
                                                    key={photo.id}
                                                    className={`rounded-lg border overflow-hidden flex flex-col justify-between transition-all ${
                                                        isLinked
                                                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                                            : 'border-border bg-card hover:border-muted-foreground/30'
                                                    }`}
                                                >
                                                    <div
                                                        className="relative aspect-4/3 bg-muted cursor-pointer group"
                                                        onClick={() => setPreviewPhoto(photo)}
                                                    >
                                                        <img
                                                            src={getPhotoThumbnailSrc(photo)}
                                                            alt={photo.title || `Photo #${photo.item_no}`}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                                                            <Maximize2 className="size-4" />
                                                        </div>
                                                        <Badge className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0">
                                                            #{photo.item_no}
                                                        </Badge>
                                                    </div>

                                                    <div className="p-2 space-y-2 flex-1 flex flex-col justify-between">
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-semibold text-foreground truncate">
                                                                {photo.title || `Photo #${photo.item_no}`}
                                                            </div>
                                                            {photo.category && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {photo.category.name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={isLinked ? 'default' : 'outline'}
                                                            disabled={isLinking}
                                                            onClick={() => handleToggleLink(photo)}
                                                            className="w-full text-xs h-7 gap-1"
                                                        >
                                                            {isLinking ? (
                                                                <Loader2 className="size-3 animate-spin" />
                                                            ) : isLinked ? (
                                                                <>
                                                                    <Check className="size-3" />
                                                                    <span>Attached</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Plus className="size-3" />
                                                                    <span>Attach</span>
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Lightbox Preview */}
            {previewPhoto && (
                <div
                    className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10"
                    >
                        <X className="size-6" />
                    </button>
                    <img
                        src={getPhotoFullSrc(previewPhoto)}
                        alt={previewPhoto.title || `Photo #${previewPhoto.item_no}`}
                        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                    <div className="mt-4 text-center text-white space-y-1">
                        <div className="font-semibold text-sm">
                            #{previewPhoto.item_no} {previewPhoto.title}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Compact inline strip showing attached photo thumbnails with preview, direct multi-upload, and detach options
 */
interface PhotoEvidenceStripProps {
    photos: PhotoRecord[];
    isEditable?: boolean;
    onAttachClick: () => void;
    onDetachPhoto?: (photo: PhotoRecord) => void;
    onUploadPhotos?: (files: FileList | File[]) => void;
    isUploading?: boolean;
}

export function PhotoEvidenceStrip({
    photos = [],
    isEditable = true,
    onAttachClick,
    onDetachPhoto,
    onUploadPhotos,
    isUploading = false,
}: PhotoEvidenceStripProps) {
    const [previewPhoto, setPreviewPhoto] = useState<PhotoRecord | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <>
            <div className="flex items-center gap-2 flex-wrap">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="group relative rounded-md border bg-muted/30 overflow-hidden w-12 h-12 shadow-2xs hover:border-primary/50 transition-all shrink-0"
                    >
                        <img
                            src={getPhotoThumbnailSrc(photo)}
                            alt={photo.title || `Photo #${photo.item_no}`}
                            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                            onClick={() => setPreviewPhoto(photo)}
                            title={photo.title || `Photo #${photo.item_no} (Click to enlarge)`}
                        />

                        {/* Hover Overlay with Lightbox and Detach */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto(photo)}
                                className="p-0.5 text-white hover:text-primary transition-colors cursor-pointer"
                                title="Enlarge"
                            >
                                <Maximize2 className="size-3" />
                            </button>
                            {isEditable && onDetachPhoto && (
                                <button
                                    type="button"
                                    onClick={() => onDetachPhoto(photo)}
                                    className="p-0.5 text-white hover:text-destructive transition-colors cursor-pointer"
                                    title="Detach photo"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {isEditable && onUploadPhotos && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    onUploadPhotos(e.target.files);
                                    e.target.value = '';
                                }
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 text-xs gap-1.5 border-dashed text-primary hover:text-primary hover:border-primary/50 font-medium"
                            title="Upload multiple photos directly"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin text-primary" />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="size-3.5 text-primary" />
                                    <span>Upload Photos</span>
                                </>
                            )}
                        </Button>
                    </>
                )}

                {isEditable && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onAttachClick}
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        title="Link from report photo library"
                    >
                        <Camera className="size-3.5 text-muted-foreground" />
                        <span>Library</span>
                    </Button>
                )}
            </div>

            {/* Lightbox Preview */}
            {previewPhoto && (
                <div
                    className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10"
                    >
                        <X className="size-6" />
                    </button>
                    <img
                        src={getPhotoFullSrc(previewPhoto)}
                        alt={previewPhoto.title || `Photo #${previewPhoto.item_no}`}
                        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                    <div className="mt-4 text-center text-white space-y-1">
                        <div className="font-semibold text-sm">
                            #{previewPhoto.item_no} {previewPhoto.title}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
