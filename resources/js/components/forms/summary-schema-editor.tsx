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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SummarySchema, SummarySchemaTextField } from './types';

export interface SummarySchemaEditorProps {
    summaryFormState: SummarySchema;
    setSummaryFormState: React.Dispatch<React.SetStateAction<SummarySchema>>;
    isSavingSummary: boolean;
    onSaveSummarySchema: () => void;
    onRemoveSummaryChapter: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    prevTab: { id: number | 'summary' | 'photo'; title: string } | null;
    nextTab: { id: number | 'summary' | 'photo'; title: string } | null;
    onSelectTab: (tabId: number | 'summary' | 'photo') => void;
}

export function SummarySchemaEditor({
    summaryFormState,
    setSummaryFormState,
    isSavingSummary,
    onSaveSummarySchema,
    onRemoveSummaryChapter,
    collapsed,
    onToggleCollapse,
    prevTab,
    nextTab,
    onSelectTab,
}: SummarySchemaEditorProps) {
    const handleAddRatingOption = () => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: [
                ...(prev.rating_options || []),
                { value: `opt_${Date.now()}`, label: 'New Option' },
            ],
        }));
    };

    const handleRemoveRatingOption = (idx: number) => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: (prev.rating_options || []).filter((_, i) => i !== idx),
        }));
    };

    const handleUpdateRatingOption = (idx: number, field: 'value' | 'label', val: string) => {
        setSummaryFormState((prev) => ({
            ...prev,
            rating_options: (prev.rating_options || []).map((opt, i) =>
                i === idx ? { ...opt, [field]: val } : opt
            ),
        }));
    };

    const handleAddTextField = () => {
        const count = (summaryFormState.text_fields || []).length + 1;
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: [
                ...(prev.text_fields || []),
                {
                    key: `field_${Date.now()}`,
                    label: `${count}. Custom Observation Field`,
                    placeholder: 'Enter comments or observations...',
                    rows: 3,
                    span: 'full',
                },
            ],
        }));
    };

    const handleRemoveTextField = (idx: number) => {
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: (prev.text_fields || []).filter((_, i) => i !== idx),
        }));
    };

    const handleUpdateTextField = (
        idx: number,
        field: keyof SummarySchemaTextField,
        val: any
    ) => {
        setSummaryFormState((prev) => ({
            ...prev,
            text_fields: (prev.text_fields || []).map((tf, i) =>
                i === idx ? { ...tf, [field]: val } : tf
            ),
        }));
    };

    const handleMoveTextField = (idx: number, direction: 'up' | 'down') => {
        const fields = [...(summaryFormState.text_fields || [])];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= fields.length) return;
        const temp = fields[idx];
        fields[idx] = fields[targetIdx];
        fields[targetIdx] = temp;
        setSummaryFormState((prev) => ({ ...prev, text_fields: fields }));
    };

    return (
        <Card
            id="summary-chapter"
            className={`gap-0 overflow-hidden py-0 shadow-xs ${
                !summaryFormState.enabled ? 'opacity-70 bg-muted/20' : 'border-primary/40'
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
                            {summaryFormState.title || 'Summary & Observations'}
                        </h3>
                        {!summaryFormState.enabled && <Badge variant="destructive">Disabled</Badge>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            size="sm"
                            variant="ghost"
                            title={summaryFormState.enabled ? 'Disable' : 'Enable'}
                            onClick={() =>
                                setSummaryFormState((prev) => ({ ...prev, enabled: !prev.enabled }))
                            }
                        >
                            {summaryFormState.enabled ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4 text-muted-foreground" />
                            )}
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSaveSummarySchema}
                            disabled={isSavingSummary}
                            className="text-xs h-8"
                        >
                            {isSavingSummary ? 'Saving...' : 'Save Summary Chapter'}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 text-xs h-8"
                            onClick={onRemoveSummaryChapter}
                            disabled={isSavingSummary}
                            title="Remove Summary Chapter"
                        >
                            <Trash2 className="size-4 mr-1" />
                            <span>Remove Chapter</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="p-4 space-y-6">
                    {/* General Configuration */}
                    <div className="rounded-lg border p-4 space-y-4 bg-background">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="summary_enabled"
                                checked={summaryFormState.enabled}
                                onCheckedChange={(checked) =>
                                    setSummaryFormState((prev) => ({ ...prev, enabled: Boolean(checked) }))
                                }
                            />
                            <Label htmlFor="summary_enabled" className="text-sm font-semibold cursor-pointer">
                                Enable Dedicated Summary Chapter for this Form
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            When enabled, this chapter is automatically appended to reports for executive
                            summaries, chapter ratings, and findings registers.
                        </p>

                        {summaryFormState.enabled && (
                            <div className="space-y-2 pt-2 border-t">
                                <Label htmlFor="summary_title">Summary Chapter Title</Label>
                                <Input
                                    id="summary_title"
                                    value={summaryFormState.title}
                                    onChange={(e) =>
                                        setSummaryFormState((prev) => ({ ...prev, title: e.target.value }))
                                    }
                                    placeholder="e.g. Summary & Observations"
                                    required
                                />
                            </div>
                        )}
                    </div>

                    {summaryFormState.enabled && (
                        <>
                            {/* Ratings Matrix Section */}
                            <div className="rounded-lg border p-4 space-y-3 bg-background">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="summary_has_ratings"
                                        checked={Boolean(summaryFormState.has_ratings_matrix)}
                                        onCheckedChange={(checked) =>
                                            setSummaryFormState((prev) => ({
                                                ...prev,
                                                has_ratings_matrix: Boolean(checked),
                                            }))
                                        }
                                    />
                                    <Label htmlFor="summary_has_ratings" className="font-semibold text-sm cursor-pointer">
                                        Include Chapter Ratings Matrix
                                    </Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Inspectors will evaluate each chapter (e.g. Very Good, Satisfactory,
                                    Unsatisfactory) in a summary matrix.
                                </p>

                                {summaryFormState.has_ratings_matrix && (
                                    <div className="space-y-3 pt-3 border-t">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase text-muted-foreground">
                                                Rating Options
                                            </Label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs"
                                                onClick={handleAddRatingOption}
                                            >
                                                <Plus className="size-3 mr-1" /> Add Option
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            {(summaryFormState.rating_options || []).map((opt, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <Input
                                                        value={opt.value}
                                                        onChange={(e) =>
                                                            handleUpdateRatingOption(idx, 'value', e.target.value)
                                                        }
                                                        placeholder="value (e.g. very_good)"
                                                        className="w-1/3 font-mono text-xs"
                                                    />
                                                    <Input
                                                        value={opt.label}
                                                        onChange={(e) =>
                                                            handleUpdateRatingOption(idx, 'label', e.target.value)
                                                        }
                                                        placeholder="Label (e.g. Very Good)"
                                                        className="flex-1 text-xs"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveRatingOption(idx)}
                                                        disabled={(summaryFormState.rating_options || []).length <= 1}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Executive / Custom Text Fields Section */}
                            <div className="rounded-lg border p-4 space-y-3 bg-background">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="font-semibold text-sm">
                                            Custom Executive & Observation Text Fields
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Configure multi-line observation areas (e.g. "Comments for NO items",
                                            "Positive Comments", etc.)
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs shrink-0"
                                        onClick={handleAddTextField}
                                    >
                                        <Plus className="size-3.5 mr-1" /> Add Field
                                    </Button>
                                </div>

                                <div className="space-y-3 pt-2">
                                    {(summaryFormState.text_fields || []).length === 0 && (
                                        <p className="text-xs text-muted-foreground italic py-2 text-center">
                                            No custom text fields configured yet. Click "Add Field" to add one.
                                        </p>
                                    )}
                                    {(summaryFormState.text_fields || []).map((tf, idx) => (
                                        <div key={idx} className="rounded border bg-muted/20 p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <span className="text-xs font-mono text-muted-foreground">
                                                        #{idx + 1}
                                                    </span>
                                                    <Input
                                                        value={tf.label}
                                                        onChange={(e) =>
                                                            handleUpdateTextField(idx, 'label', e.target.value)
                                                        }
                                                        placeholder="Field Label / Title"
                                                        className="text-xs font-medium"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMoveTextField(idx, 'up')}
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
                                                            idx === (summaryFormState.text_fields || []).length - 1
                                                        }
                                                        onClick={() => handleMoveTextField(idx, 'down')}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveTextField(idx)}
                                                        title="Delete Field"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground">
                                                        Field Key (Identifier)
                                                    </Label>
                                                    <Input
                                                        value={tf.key}
                                                        onChange={(e) =>
                                                            handleUpdateTextField(
                                                                idx,
                                                                'key',
                                                                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                                            )
                                                        }
                                                        placeholder="e.g. comments_no"
                                                        className="text-xs font-mono h-8"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground">
                                                        Width Layout
                                                    </Label>
                                                    <Select
                                                        value={tf.span || 'full'}
                                                        onValueChange={(val: 'full' | 'half') =>
                                                            handleUpdateTextField(idx, 'span', val)
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="full">Full Width (1 Column)</SelectItem>
                                                            <SelectItem value="half">Half Width (2 Columns)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground">
                                                        Default Height (Rows)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min={2}
                                                        max={12}
                                                        value={tf.rows || 3}
                                                        onChange={(e) =>
                                                            handleUpdateTextField(
                                                                idx,
                                                                'rows',
                                                                parseInt(e.target.value) || 3
                                                            )
                                                        }
                                                        className="text-xs h-8"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label className="text-[11px] text-muted-foreground">
                                                    Placeholder Guide Text (Optional)
                                                </Label>
                                                <Input
                                                    value={tf.placeholder || ''}
                                                    onChange={(e) =>
                                                        handleUpdateTextField(idx, 'placeholder', e.target.value)
                                                    }
                                                    placeholder="e.g. Chapter / Item / Observation comments..."
                                                    className="text-xs h-8"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Findings Register Section */}
                            <div className="rounded-lg border p-4 space-y-2 bg-background">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="summary_has_findings"
                                        checked={Boolean(summaryFormState.has_findings_register)}
                                        onCheckedChange={(checked) =>
                                            setSummaryFormState((prev) => ({
                                                ...prev,
                                                has_findings_register: Boolean(checked),
                                            }))
                                        }
                                    />
                                    <Label htmlFor="summary_has_findings" className="font-semibold text-sm cursor-pointer">
                                        Include Summary Findings Register
                                    </Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Automatically compiles negative answers/findings into an executive findings
                                    register table with corrective action tracking.
                                </p>
                            </div>
                        </>
                    )}

                    <div className="pt-2 flex justify-end">
                        <Button
                            type="button"
                            onClick={onSaveSummarySchema}
                            disabled={isSavingSummary}
                        >
                            {isSavingSummary ? 'Saving Summary Chapter...' : 'Save Summary Chapter Settings'}
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
