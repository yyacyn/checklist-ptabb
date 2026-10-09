import { Head, Link, router } from '@inertiajs/react';
import {
    Camera,
    ExternalLink,
    Filter,
    Image as ImageIcon,
    Maximize2,
    RefreshCw,
    Search,
    Ship,
    Tag,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PhotoItem {
    id: number;
    report_id: number;
    report_reference?: string;
    report_date?: string;
    vessel_name: string;
    item_no: number;
    title: string | null;
    caption: string | null;
    description: string | null;
    category_id: number | null;
    category_name?: string;
    category_code?: string;
    file_url: string;
    thumbnail_url: string;
    original_filename: string;
    file_size: number;
    created_at: string;
    uploaded_by?: string;
    report_question_id?: number | null;
    question_item_no?: string | null;
    finding_id?: number | null;
    finding_no?: string | null;
}

interface CategoryOption {
    id: number;
    name: string;
    code: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    photos: PaginatedData<PhotoItem>;
    categories: CategoryOption[];
    known_vessels: string[];
    filters: {
        vessel_name?: string;
        category_id?: string;
        report_id?: string;
        search?: string;
    };
}

export default function PhotoGalleryIndex({
    photos,
    categories = [],
    known_vessels = [],
    filters = {},
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [selectedVessel, setSelectedVessel] = useState(filters.vessel_name || 'all');
    const [selectedCategory, setSelectedCategory] = useState(filters.category_id || 'all');
    const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

    const handleApplyFilters = () => {
        router.get(
            '/photos',
            {
                search: search || undefined,
                vessel_name: selectedVessel !== 'all' ? selectedVessel : undefined,
                category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleClearFilters = () => {
        setSearch('');
        setSelectedVessel('all');
        setSelectedCategory('all');
        router.get('/photos');
    };

    return (
        <>
            <Head title="Fleet Photographic Records" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-semibold gap-1">
                                <Camera className="size-3" /> Fleet Evidence
                            </Badge>
                            <Badge variant="secondary">{photos.total} Photographs</Badge>
                        </div>
                        <Heading
                            title="Fleet Photographic Records"
                            description="Browse, filter, and inspect photographic walkaround evidence and defect documentation across vessels."
                        />
                    </div>
                </div>

                {/* Filters Bar */}
                <Card className="p-4 bg-card/60 backdrop-blur-xs border shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                        {/* Search Input */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                    placeholder="Search title, remarks, vessel..."
                                    className="pl-8 text-xs h-9"
                                />
                            </div>
                        </div>

                        {/* Vessel Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Vessel</Label>
                            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                                <SelectTrigger className="text-xs h-9">
                                    <SelectValue placeholder="All Vessels" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vessels</SelectItem>
                                    {known_vessels.map((v) => (
                                        <SelectItem key={v} value={v}>
                                            {v}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Photo Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="text-xs h-9">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleApplyFilters}
                                className="h-9 text-xs flex-1 gap-1"
                            >
                                <Filter className="size-3.5" />
                                <span>Apply</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleClearFilters}
                                className="h-9 text-xs"
                                title="Reset filters"
                            >
                                <RefreshCw className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Photo Grid */}
                {photos.data.length === 0 ? (
                    <Card className="p-12 text-center text-muted-foreground space-y-3">
                        <ImageIcon className="size-12 mx-auto opacity-30" />
                        <h3 className="text-base font-semibold text-foreground">No photos found</h3>
                        <p className="text-xs max-w-sm mx-auto">
                            No photographic records match the current filter criteria.
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                        {photos.data.map((photo) => (
                            <div
                                key={photo.id}
                                className="group relative rounded-xl border bg-card overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <div className="relative aspect-4/3 bg-muted overflow-hidden">
                                    <img
                                        src={photo.thumbnail_url || photo.file_url}
                                        alt={photo.title || `Photo #${photo.item_no}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-70" />

                                    <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                                        <Badge className="bg-black/70 backdrop-blur-xs text-white border-none text-[10px] font-mono">
                                            #{photo.item_no}
                                        </Badge>
                                        {photo.category_name && (
                                            <Badge variant="secondary" className="bg-card/85 backdrop-blur-xs text-[10px] font-semibold">
                                                {photo.category_name}
                                            </Badge>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setPreviewPhoto(photo)}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                                        title="View Preview"
                                    >
                                        <Maximize2 className="size-3.5" />
                                    </button>

                                    <div className="absolute bottom-2 left-2 text-[11px] text-white font-medium flex items-center gap-1 drop-shadow-xs truncate max-w-[90%]">
                                        <Ship className="size-3 shrink-0" />
                                        <span className="truncate">{photo.vessel_name}</span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs text-foreground line-clamp-1">
                                            {photo.title || photo.caption || `Photo #${photo.item_no}`}
                                        </h4>
                                        {photo.description && (
                                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                                                {photo.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                                        <Link
                                            href={`/reports/${photo.report_id}?chapter=-888`}
                                            className="font-mono text-[10px] text-primary hover:underline truncate max-w-[130px] flex items-center gap-1"
                                        >
                                            <ExternalLink className="size-2.5 shrink-0" />
                                            <span>{photo.report_reference}</span>
                                        </Link>
                                        <span>{photo.created_at.split('T')[0]}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {photos.last_page > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
                        <div>
                            Page {photos.current_page} of {photos.last_page} ({photos.total} photos)
                        </div>
                        <div className="flex items-center gap-2">
                            {photos.prev_page_url && (
                                <Button size="sm" variant="outline" asChild className="text-xs h-8">
                                    <Link href={photos.prev_page_url}>Previous</Link>
                                </Button>
                            )}
                            {photos.next_page_url && (
                                <Button size="sm" variant="outline" asChild className="text-xs h-8">
                                    <Link href={photos.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Lightbox / Preview Modal */}
            {previewPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
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
                        src={previewPhoto.file_url || previewPhoto.thumbnail_url}
                        alt={previewPhoto.title || `Photo #${previewPhoto.item_no}`}
                        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                    <div className="mt-4 text-center text-white space-y-1.5 max-w-lg">
                        <div className="font-bold text-base flex items-center justify-center gap-2">
                            <span>#{previewPhoto.item_no} {previewPhoto.title || previewPhoto.caption}</span>
                            {previewPhoto.category_name && (
                                <Badge variant="secondary" className="text-xs">
                                    {previewPhoto.category_name}
                                </Badge>
                            )}
                        </div>
                        <div className="text-xs text-white/80">
                            Vessel: {previewPhoto.vessel_name} • Report: {previewPhoto.report_reference} ({previewPhoto.report_date})
                        </div>
                        {previewPhoto.description && (
                            <p className="text-xs text-white/90 bg-white/10 p-2 rounded max-h-24 overflow-y-auto">
                                {previewPhoto.description}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
