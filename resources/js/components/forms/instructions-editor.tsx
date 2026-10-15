import {
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Edit2,
    Eye,
    EyeOff,
    MoreHorizontal,
    Plus,
    RotateCcw,
    Save,
    Square,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface InstructionsEditorProps {
    initialInstructions: string;
    onSave: (instructions: string) => Promise<void> | void;
    isSaving?: boolean;
}

const DEFAULT_D062_INSTRUCTIONS = `1. Read carefully and go through each chapter carefully.
2. For items not seen enter on the comments section the Not Seen items.
3. For items not available onboard enter on the comments section below the Not Applicable Items.
4. For inspections of tanks, etc. please attach form D 024 to this report.
5. In case of negative observations or job orders raised for notified deficiencies, relevant remarks must have cross-reference to the breached relevant numerical item on the Chapter the deficiency has been identified as applicable.
6. Vessels should be inspected at least annually by both shore staff and vessel’s designated personnel, according to this form. During these inspections, the designated Officers (on behalf of the vessel) and the Company’s Superintendents (on behalf of the Company) may inspect as many fields included in this form as possible, depending on their expertise and the available time or the vessel’s operational status.
7. The completion of all parts of this form may be affected during several such inspections.
8. The Master (regarding the inspections carried out by ship Officers) and the Technical Manager (regarding the inspections carried out by shore staff) are responsible to ensure that all parts of this form are reviewed within a period of one year.`;

export function InstructionsEditor({
    initialInstructions,
    onSave,
    isSaving = false,
}: InstructionsEditorProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isSelected, setIsSelected] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(initialInstructions || '');

    const handleSave = async () => {
        await onSave(text);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setText(initialInstructions || '');
        setIsEditing(false);
    };

    const handleToggleEnabled = async () => {
        const nextEnabled = !isEnabled;
        setIsEnabled(nextEnabled);
        if (!nextEnabled) {
            // Save empty to disable rendering in PDF
            await onSave('');
        } else {
            await onSave(text || DEFAULT_D062_INSTRUCTIONS);
        }
    };

    const handleResetDefault = async () => {
        setText(DEFAULT_D062_INSTRUCTIONS);
        await onSave(DEFAULT_D062_INSTRUCTIONS);
    };

    return (
        <section className={!isEnabled ? 'opacity-60' : ''}>
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <button
                        type="button"
                        onClick={() => setIsCollapsed((prev) => !prev)}
                        className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                        title={isCollapsed ? 'Expand Subgroup' : 'Collapse Subgroup'}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="size-3.5" />
                        ) : (
                            <ChevronDown className="size-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSelected((prev) => !prev)}
                        className="text-muted-foreground hover:text-foreground shrink-0 mr-1 cursor-pointer"
                    >
                        {isSelected ? (
                            <CheckSquare className="size-3.5 text-primary" />
                        ) : (
                            <Square className="size-3.5" />
                        )}
                    </button>
                    <h4
                        className="font-semibold text-sm uppercase tracking-wide text-muted-foreground cursor-pointer select-none"
                        onClick={() => setIsCollapsed((prev) => !prev)}
                    >
                        FILL IN INSTRUCTIONS
                    </h4>
                    {!isEnabled && (
                        <Badge variant="destructive" className="text-xs">
                            Disabled
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 cursor-pointer"
                        title={isEnabled ? 'Disable' : 'Enable'}
                        onClick={handleToggleEnabled}
                    >
                        {isEnabled ? (
                            <Eye className="size-3.5" />
                        ) : (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                        )}
                    </Button>

                    {!isEditing ? (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs cursor-pointer"
                            onClick={() => {
                                setIsCollapsed(false);
                                setIsEditing(true);
                            }}
                        >
                            <Edit2 className="size-3 mr-1" /> Instruction
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs cursor-pointer"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                <X className="size-3 mr-1" /> Cancel
                            </Button>
                            <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs cursor-pointer"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                <Save className="size-3 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 cursor-pointer"
                                title="More Options"
                            >
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                                onClick={handleResetDefault}
                                className="cursor-pointer"
                            >
                                <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={async () => {
                                    if (confirm('Clear all fill-in instructions?')) {
                                        setText('');
                                        await onSave('');
                                    }
                                }}
                            >
                                <X className="size-3.5 mr-2" /> Clear Instructions
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {!isCollapsed && (
                <div className="space-y-2 pt-1 pb-2">
                    {isEditing ? (
                        <div className="space-y-2">
                            <textarea
                                value={text}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                                placeholder="Enter numbered fill-in instructions for this form..."
                                rows={8}
                                className="w-full rounded border border-input bg-background px-3 py-2 text-xs leading-relaxed font-mono shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Tip: Enter each instruction on a new line or numbered (1., 2., 3., etc.). These will appear directly below the attendance section in the report PDF.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded border bg-background/50 p-3 text-xs leading-relaxed whitespace-pre-line text-foreground/90">
                            {text.trim() ? (
                                text
                            ) : (
                                <span className="italic text-muted-foreground">
                                    No fill-in instructions configured yet. Click "Edit Instructions" to add them.
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
