import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { FormVesselTypeItem } from './types';

export interface ApplicabilityTarget {
    type: 'group' | 'question';
    id: number;
    title: string;
}

export interface ApplicabilityModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    target: ApplicabilityTarget | null;
    vesselTypes: FormVesselTypeItem[];
    selectedVesselTypes: number[];
    onSelectedVesselTypesChange: (types: number[]) => void;
    selectedIceClassOnly: boolean;
    onSelectedIceClassOnlyChange: (iceOnly: boolean) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function ApplicabilityModalDialog({
    open,
    onOpenChange,
    target,
    vesselTypes,
    selectedVesselTypes,
    onSelectedVesselTypesChange,
    selectedIceClassOnly,
    onSelectedIceClassOnlyChange,
    onSubmit,
}: ApplicabilityModalDialogProps) {
    if (!target) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Applicability</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        <strong>Target:</strong> {target.title}
                    </p>

                    <div className="space-y-2">
                        <Label>Applicable Vessel Types</Label>
                        <p className="text-xs text-muted-foreground">
                            Leave all unselected to apply to all vessel types.
                        </p>
                        <div className="space-y-1.5 rounded border p-3">
                            {vesselTypes.map((vt) => (
                                <div key={vt.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id={`vt_${vt.id}`}
                                        checked={selectedVesselTypes.includes(vt.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                onSelectedVesselTypesChange([...selectedVesselTypes, vt.id]);
                                            } else {
                                                onSelectedVesselTypesChange(
                                                    selectedVesselTypes.filter((id) => id !== vt.id)
                                                );
                                            }
                                        }}
                                        className="rounded border-gray-300 cursor-pointer"
                                    />
                                    <Label htmlFor={`vt_${vt.id}`} className="cursor-pointer text-sm font-normal">
                                        {vt.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="app_ice_class"
                            checked={selectedIceClassOnly}
                            onChange={(e) => onSelectedIceClassOnlyChange(e.target.checked)}
                            className="rounded border-gray-300 cursor-pointer"
                        />
                        <Label htmlFor="app_ice_class" className="cursor-pointer">
                            Ice Class Vessels Only
                        </Label>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save Applicability</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
