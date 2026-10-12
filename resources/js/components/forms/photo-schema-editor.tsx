import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Plus,
    Trash2,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PhotoSchema } from './types';

export interface PhotoSchemaEditorProps {
    isPhotoForm: boolean;
    formName: string;
    photoFormState: PhotoSchema;
    setPhotoFormState: React.Dispatch<React.SetStateAction<PhotoSchema>>;
    isSavingPhoto: boolean;
    onSavePhotoSchema: () => void;
    onRemovePhotoChapter?: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    prevTab: { id: number | 'summary' | 'photo'; title: string } | null;
    nextTab: { id: number | 'summary' | 'photo'; title: string } | null;
    onSelectTab: (tabId: number | 'summary' | 'photo') => void;
}

export function PhotoSchemaEditor({
    isPhotoForm,
    formName,
    photoFormState,
    setPhotoFormState,
    isSavingPhoto,
    onSavePhotoSchema,
    onRemovePhotoChapter,
    collapsed,
    onToggleCollapse,
    prevTab,
    nextTab,
    onSelectTab,
}: PhotoSchemaEditorProps) {
    const handleAddPhotoItem = () => {
        setPhotoFormState((prev) => {
            const current = prev.items || [];
            return {
                ...prev,
                items: [
                    ...current,
                    {
                        id: String(Date.now()),
                        title: `Photo ${current.length + 1}`,
                        description: '',
                    },
                ],
            };
        });
    };

    const handleUpdatePhotoItem = (
        idx: number,
        field: 'title' | 'description',
        value: string
    ) => {
        setPhotoFormState((prev) => {
            const current = [...(prev.items || [])];
            if (!current[idx]) return prev;
            current[idx] = { ...current[idx], [field]: value };
            return { ...prev, items: current };
        });
    };

    const handleRemovePhotoItem = (idx: number) => {
        setPhotoFormState((prev) => {
            const current = [...(prev.items || [])];
            current.splice(idx, 1);
            return { ...prev, items: current };
        });
    };

    const handleMovePhotoItem = (idx: number, direction: 'up' | 'down') => {
        setPhotoFormState((prev) => {
            const current = [...(prev.items || [])];
            const target = direction === 'up' ? idx - 1 : idx + 1;
            if (target < 0 || target >= current.length) return prev;
            const temp = current[idx];
            current[idx] = current[target];
            current[target] = temp;
            return { ...prev, items: current };
        });
    };

    return (
        <Card
            id="photo-chapter"
            className={`gap-0 overflow-hidden py-0 shadow-xs ${
                !photoFormState.enabled && !isPhotoForm
                    ? 'opacity-70 bg-muted/20'
                    : 'border-primary/40'
            }`}
        >
            <CardHeader className="border-b bg-muted/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                            title={collapsed ? 'Expand Chapter' : 'Collapse Chapter'}
                        >
                            {collapsed ? (
                                <ChevronRight className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </button>
                        <h3
                            className="font-semibold text-lg cursor-pointer select-none"
                            onClick={onToggleCollapse}
                        >
                            {photoFormState.title ||
                                (isPhotoForm ? formName : 'Photographic Records')}
                        </h3>
                        {!photoFormState.enabled && !isPhotoForm && (
                            <Badge variant="destructive">Disabled</Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            size="sm"
                            variant="ghost"
                            title={photoFormState.enabled ? 'Disable' : 'Enable'}
                            onClick={() =>
                                setPhotoFormState((prev) => ({ ...prev, enabled: !prev.enabled }))
                            }
                        >
                            {photoFormState.enabled ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4 text-muted-foreground" />
                            )}
                        </Button>

                        <Button
                            size="sm"
                            onClick={onSavePhotoSchema}
                            disabled={isSavingPhoto}
                            className="text-xs h-8"
                        >
                            {isSavingPhoto ? 'Saving...' : 'Save Photo Settings'}
                        </Button>

                        {!isPhotoForm && onRemovePhotoChapter && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 text-xs h-8"
                                onClick={onRemovePhotoChapter}
                                disabled={isSavingPhoto}
                                title="Remove Photo Chapter"
                            >
                                <Trash2 className="size-4 mr-1" />
                                <span>Remove Chapter</span>
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="p-5 space-y-6">
                    <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="photo_enabled"
                                checked={photoFormState.enabled}
                                onCheckedChange={(checked) =>
                                    setPhotoFormState((prev) => ({
                                        ...prev,
                                        enabled: Boolean(checked),
                                    }))
                                }
                            />
                            <Label htmlFor="photo_enabled" className="text-sm font-semibold cursor-pointer">
                                Include Photo Form / Records in this Report
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                            When enabled, this report will include photo inputs and print photo records in the
                            report.
                        </p>
                    </div>

                    {photoFormState.enabled && (
                        <>
                            <div className="space-y-4 pt-2 border-t">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="photo_title">Section Title</Label>
                                        <Input
                                            id="photo_title"
                                            value={photoFormState.title || ''}
                                            onChange={(e) =>
                                                setPhotoFormState((prev) => ({
                                                    ...prev,
                                                    title: e.target.value,
                                                }))
                                            }
                                            placeholder="e.g. Photographic Records"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="photo_description">
                                            Instructions / Notes (Optional)
                                        </Label>
                                        <textarea
                                            id="photo_description"
                                            value={photoFormState.description || ''}
                                            onChange={(e) =>
                                                setPhotoFormState((prev) => ({
                                                    ...prev,
                                                    description: e.target.value,
                                                }))
                                            }
                                            rows={2}
                                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            placeholder="Instructions for uploading photos..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-3 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">Photo Fields</Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs cursor-pointer"
                                            onClick={handleAddPhotoItem}
                                        >
                                            <Plus className="size-3.5 mr-1" /> Add Photo
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {!photoFormState.items || photoFormState.items.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic py-2 text-center">
                                                No photo fields added yet. Click "Add Photo" to add one.
                                            </p>
                                        ) : (
                                            photoFormState.items.map((item, idx) => (
                                                <div
                                                    key={item.id || idx}
                                                    className="flex items-center gap-2 p-2.5 rounded-md border bg-card"
                                                >
                                                    <span className="text-xs font-mono text-muted-foreground shrink-0 w-6">
                                                        #{idx + 1}
                                                    </span>
                                                    <Input
                                                        value={item.title}
                                                        onChange={(e) =>
                                                            handleUpdatePhotoItem(idx, 'title', e.target.value)
                                                        }
                                                        placeholder="Photo Title / Label"
                                                        className="flex-1 text-xs h-8"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMovePhotoItem(idx, 'up')}
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        disabled={
                                                            idx ===
                                                            (photoFormState.items?.length || 1) - 1
                                                        }
                                                        onClick={() => handleMovePhotoItem(idx, 'down')}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemovePhotoItem(idx)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="pt-2 flex justify-end">
                        <Button
                            type="button"
                            onClick={onSavePhotoSchema}
                            disabled={isSavingPhoto}
                        >
                            {isSavingPhoto ? 'Saving Photo Settings...' : 'Save Photo Settings'}
                        </Button>
                    </div>
                </CardContent>
            )}

            <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                {prevTab ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectTab(prevTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <ChevronLeft className="size-4" />
                        <span className="truncate max-w-[200px]">{prevTab.title}</span>
                    </Button>
                ) : (
                    <div />
                )}
                {nextTab ? (
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onSelectTab(nextTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <span className="truncate max-w-[200px]">{nextTab.title}</span>
                        <ChevronRight className="size-4" />
                    </Button>
                ) : (
                    <div />
                )}
            </CardFooter>
        </Card>
    );
}
