import { router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    Anchor,
    ArrowRight,
    Camera,
    Check,
    ClipboardList,
    RotateCcw,
    Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface VesselSummaryItem {
    name: string;
    users_count: number;
    reports_count: number;
    photos_count: number;
    total_records: number;
}

interface RenameVesselDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    knownVessels: string[];
    vesselsSummary?: VesselSummaryItem[];
    initialVessel?: string | null;
}

export function RenameVesselDialog({
    open,
    onOpenChange,
    knownVessels,
    vesselsSummary = [],
    initialVessel,
}: RenameVesselDialogProps) {
    const [oldName, setOldName] = useState<string>('');
    const [newName, setNewName] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialise when dialog opens
    useEffect(() => {
        if (open) {
            const defaultOld = initialVessel || (knownVessels.length > 0 ? knownVessels[0] : '');
            setOldName(defaultOld);
            setNewName('');
            setError(null);
            setIsSubmitting(false);
        }
    }, [open, initialVessel, knownVessels]);

    // Lookup summary for currently selected old vessel
    const currentSummary = vesselsSummary.find(
        (v) => v.name.toLowerCase().trim() === oldName.toLowerCase().trim()
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedOld = oldName.trim();
        const trimmedNew = newName.trim();

        if (!trimmedOld) {
            setError('Please select a current vessel name.');
            return;
        }

        if (!trimmedNew) {
            setError('Please enter a new vessel name.');
            return;
        }

        if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) {
            setError('The new vessel name is identical to the current vessel name.');
            return;
        }

        setIsSubmitting(true);

        router.post(
            '/admin/vessels/rename',
            {
                old_name: trimmedOld,
                new_name: trimmedNew,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onOpenChange(false);
                    setNewName('');
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errors)[0];
                    setError(typeof firstError === 'string' ? firstError : 'Failed to rename vessel.');
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-amber-500/10 rounded-full text-amber-600 dark:text-amber-400">
                                <Anchor className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold">Rename Vessel Fleetwide</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Cascade a vessel name change across reports, photos, and accounts (SRS §2.1).
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {error && (
                            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Current Vessel Selection */}
                        <div className="space-y-1.5">
                            <Label htmlFor="old_vessel_name" className="text-xs font-medium">
                                Current Vessel <span className="text-destructive">*</span>
                            </Label>
                            {knownVessels.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No vessels currently found in the system.</p>
                            ) : (
                                <Select value={oldName} onValueChange={(val) => { setOldName(val); setError(null); }}>
                                    <SelectTrigger id="old_vessel_name" className="w-full text-sm">
                                        <SelectValue placeholder="Select vessel to rename" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-56">
                                        {knownVessels.map((name) => {
                                            const item = vesselsSummary.find(
                                                (v) => v.name.toLowerCase().trim() === name.toLowerCase().trim()
                                            );
                                            return (
                                                <SelectItem key={name} value={name} className="text-xs">
                                                    <span className="font-medium">{name}</span>
                                                    {item && item.total_records > 0 && (
                                                        <span className="ml-2 text-muted-foreground text-[10px]">
                                                            ({item.total_records} record{item.total_records === 1 ? '' : 's'})
                                                        </span>
                                                    )}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Affected Records Impact Preview */}
                        {oldName && currentSummary && (
                            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                    <span>Affected Records</span>
                                    <Badge variant="outline" className="text-[10px] font-medium">
                                        {currentSummary.total_records} total
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-md border bg-background p-2">
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                            <Users className="size-3" />
                                            <span className="text-[10px]">Accounts</span>
                                        </div>
                                        <span className="text-sm font-bold text-foreground">{currentSummary.users_count}</span>
                                    </div>
                                    <div className="rounded-md border bg-background p-2">
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                            <ClipboardList className="size-3" />
                                            <span className="text-[10px]">Reports</span>
                                        </div>
                                        <span className="text-sm font-bold text-foreground">{currentSummary.reports_count}</span>
                                    </div>
                                    <div className="rounded-md border bg-background p-2">
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                            <Camera className="size-3" />
                                            <span className="text-[10px]">Photos</span>
                                        </div>
                                        <span className="text-sm font-bold text-foreground">{currentSummary.photos_count}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* New Vessel Name Input */}
                        <div className="space-y-1.5">
                            <Label htmlFor="new_vessel_name" className="text-xs font-medium">
                                New Vessel Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="new_vessel_name"
                                value={newName}
                                onChange={(e) => { setNewName(e.target.value); setError(null); }}
                                placeholder="e.g. MV AMARIN GLORY"
                                className="text-sm"
                                autoFocus
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Names are automatically trimmed and spacing normalized.
                            </p>
                        </div>

                        {/* Visual Name Transition */}
                        {oldName && newName.trim() && (
                            <div className="flex items-center justify-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs">
                                <span className="font-medium text-foreground truncate max-w-[140px]">{oldName}</span>
                                <ArrowRight className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="font-bold text-amber-700 dark:text-amber-300 truncate max-w-[140px]">{newName.trim()}</span>
                            </div>
                        )}

                        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
                            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span>
                                This action is atomic and logged to the system audit trail. Cached report PDFs will automatically be regenerated on next view.
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !oldName || !newName.trim() || oldName.toLowerCase().trim() === newName.toLowerCase().trim()}
                            className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <RotateCcw className="size-3.5 animate-spin" />
                                    <span>Renaming...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="size-3.5" />
                                    <span>Rename Fleetwide</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
