import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SaveStatusIndicator, SaveStatus } from '@/components/reports/save-status-indicator';
import { csrfHeaders, enqueueSave, generateClientSaveId } from '@/lib/autosave-queue';

export type ColumnInputType =
    | 'text'
    | 'date'
    | 'time'
    | 'number'
    | 'select'
    | 'checkbox';

export interface ColumnOption {
    value: string;
    label: string;
}

export interface ColumnConfig {
    key: string;
    label: string;
    type: ColumnInputType;
    placeholder?: string;
    options?: ColumnOption[];
    width?: string;
    defaultValue?: any;
    min?: number;
    max?: number;
    step?: number;
    disabled?: (row: Record<string, any>, rowIndex: number) => boolean;
    helpText?: string;
}

export interface ConflictInfo {
    serverRowVersion: number;
    serverRows: Array<Record<string, any>>;
}

export interface RowsBlockProps {
    reportId: number;
    datasetKey: string;
    columns: ColumnConfig[];
    initialRows?: Array<Record<string, any>>;
    initialRowVersion?: number;
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    isEditable?: boolean;
    endpoint?: string;
    debounceMs?: number;
    minRows?: number;
    maxRows?: number;
    addButtonLabel?: string;
    emptyMessage?: string;
    allowReorder?: boolean;
    onChange?: (rows: Array<Record<string, any>>) => void;
    onSaveSuccess?: (dataset: any) => void;
    onConflict?: (conflict: ConflictInfo) => void;
    className?: string;
    extraRowContent?: (
        row: Record<string, any>,
        rowIndex: number,
        updateCell: (colKey: string, val: any) => void
    ) => React.ReactNode;
}

export function RowsBlock({
    reportId,
    datasetKey,
    columns,
    initialRows = [],
    initialRowVersion = 1,
    title,
    description,
    icon: Icon,
    isEditable = true,
    endpoint,
    debounceMs = 1000,
    minRows = 0,
    maxRows,
    addButtonLabel = 'Add Row',
    emptyMessage = 'No records entered yet.',
    allowReorder = false,
    onChange,
    onSaveSuccess,
    onConflict,
    className = '',
    extraRowContent,
}: RowsBlockProps) {
    const targetEndpoint = endpoint || `/reports/${reportId}/datasets/${datasetKey}`;

    // Rows and row_version state
    const [rows, setRows] = useState<Array<Record<string, any>>>(initialRows);
    const [rowVersion, setRowVersion] = useState<number>(initialRowVersion);

    // Save and conflict state
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [conflict, setConflict] = useState<ConflictInfo | null>(null);

    // Refs for debounced autosave
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowsRef = useRef<Array<Record<string, any>>>(rows);
    rowsRef.current = rows;
    const rowVersionRef = useRef<number>(rowVersion);
    rowVersionRef.current = rowVersion;

    // Sync from outside if initialRows change externally
    useEffect(() => {
        setRows(initialRows);
        rowsRef.current = initialRows;
    }, [initialRows]);

    useEffect(() => {
        setRowVersion(initialRowVersion);
        rowVersionRef.current = initialRowVersion;
    }, [initialRowVersion]);

    const performSave = useCallback(
        async (currentRows: Array<Record<string, any>>, overrideBaseVersion?: number) => {
            if (!isEditable) return;

            setSaveStatus('saving');
            setErrorMessage(undefined);

            const clientSaveId = generateClientSaveId();
            const baseVer = overrideBaseVersion !== undefined ? overrideBaseVersion : rowVersionRef.current;

            const payload = {
                rows: currentRows,
                base_row_version: baseVer,
                client_save_id: clientSaveId,
            };

            try {
                const res = await fetch(targetEndpoint, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...csrfHeaders(),
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    const newVersion = data?.dataset?.row_version || (baseVer + 1);
                    setRowVersion(newVersion);
                    rowVersionRef.current = newVersion;
                    setConflict(null);
                    setSaveStatus('saved');
                    setTimeout(() => {
                        setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
                    }, 2500);
                    onSaveSuccess?.(data);
                } else if (res.status === 409) {
                    // Stale row_version conflict (NFR-15)
                    const conflictData = await res.json().catch(() => ({}));
                    const serverDataset = conflictData?.server_dataset;
                    const serverVer = serverDataset?.row_version || (baseVer + 1);
                    const serverRows = serverDataset?.rows || [];

                    const info: ConflictInfo = {
                        serverRowVersion: serverVer,
                        serverRows,
                    };

                    setConflict(info);
                    setSaveStatus('conflict');
                    onConflict?.(info);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    const msg = errData?.message || `Server responded with ${res.status}`;
                    setSaveStatus('error');
                    setErrorMessage(msg);
                }
            } catch (err: any) {
                // Network failure: enqueue for offline VSAT retry (NFR-1, NFR-2)
                await enqueueSave({
                    client_save_id: clientSaveId,
                    report_id: reportId,
                    endpoint: targetEndpoint,
                    method: 'PUT',
                    payload,
                    timestamp: Date.now(),
                    attempts: 0,
                    last_error: err?.message || 'Network error',
                });

                setSaveStatus('retrying');
            }
        },
        [isEditable, reportId, targetEndpoint, onSaveSuccess, onConflict]
    );

    const triggerAutosave = useCallback(
        (nextRows: Array<Record<string, any>>, immediate = false) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            if (immediate) {
                performSave(nextRows);
            } else {
                debounceTimer.current = setTimeout(() => {
                    performSave(nextRows);
                }, debounceMs);
            }
        },
        [performSave, debounceMs]
    );

    const handleCellChange = (rowIndex: number, colKey: string, val: any, immediate = false) => {
        const next = rowsRef.current.map((r, i) => {
            if (i === rowIndex) {
                return { ...r, [colKey]: val };
            }
            return r;
        });

        setRows(next);
        rowsRef.current = next;
        onChange?.(next);
        triggerAutosave(next, immediate);
    };

    const handleAddRow = () => {
        if (!isEditable) return;
        if (maxRows && rows.length >= maxRows) return;

        const newRow: Record<string, any> = {
            sort_order: rows.length + 1,
        };

        for (const col of columns) {
            newRow[col.key] = col.defaultValue ?? (col.type === 'checkbox' ? false : col.type === 'number' ? null : '');
        }

        const next = [...rowsRef.current, newRow];
        setRows(next);
        rowsRef.current = next;
        onChange?.(next);
        triggerAutosave(next, true);
    };

    const handleRemoveRow = (rowIndex: number) => {
        if (!isEditable) return;
        if (rows.length <= minRows) return;

        const filtered = rowsRef.current.filter((_, i) => i !== rowIndex);
        const next = filtered.map((r, idx) => ({ ...r, sort_order: idx + 1 }));

        setRows(next);
        rowsRef.current = next;
        onChange?.(next);
        triggerAutosave(next, true);
    };

    const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
        if (!isEditable) return;
        const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
        if (targetIndex < 0 || targetIndex >= rowsRef.current.length) return;

        const reordered = [...rowsRef.current];
        const temp = reordered[rowIndex];
        reordered[rowIndex] = reordered[targetIndex];
        reordered[targetIndex] = temp;

        const next = reordered.map((r, idx) => ({ ...r, sort_order: idx + 1 }));
        setRows(next);
        rowsRef.current = next;
        onChange?.(next);
        triggerAutosave(next, true);
    };

    const handleBlur = () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
            performSave(rowsRef.current);
        }
    };

    // Conflict resolution handlers (NFR-15)
    const handleResolveConflictReload = () => {
        if (!conflict) return;
        setRows(conflict.serverRows);
        rowsRef.current = conflict.serverRows;
        setRowVersion(conflict.serverRowVersion);
        rowVersionRef.current = conflict.serverRowVersion;
        setConflict(null);
        setSaveStatus('idle');
        onChange?.(conflict.serverRows);
    };

    const handleResolveConflictOverwrite = () => {
        if (!conflict) return;
        const serverVer = conflict.serverRowVersion;
        setConflict(null);
        performSave(rowsRef.current, serverVer);
    };

    // Unmount flush
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                performSave(rowsRef.current);
            }
        };
    }, [performSave]);

    const canAdd = isEditable && (!maxRows || rows.length < maxRows);

    return (
        <Card className={className}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                    {title && (
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            {Icon && <Icon className="size-4 text-primary shrink-0" />}
                            <span>{title}</span>
                        </CardTitle>
                    )}
                    {description && (
                        <CardDescription className="text-xs text-muted-foreground">
                            {description}
                        </CardDescription>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <SaveStatusIndicator status={saveStatus} errorMessage={errorMessage} />
                    {canAdd && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddRow}
                            className="h-7 text-xs flex items-center gap-1 shrink-0"
                        >
                            <Plus className="size-3.5" />
                            <span>{addButtonLabel}</span>
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-1">
                {/* 409 Conflict Banner */}
                {conflict && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                            <span>
                                <strong>Save Conflict:</strong> This dataset was modified in another session (Version {conflict.serverRowVersion}).
                            </span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleResolveConflictReload}
                                className="h-7 text-xs flex items-center gap-1"
                            >
                                <RefreshCw className="size-3" />
                                <span>Reload Server Data</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={handleResolveConflictOverwrite}
                                className="h-7 text-xs"
                            >
                                Overwrite Server
                            </Button>
                        </div>
                    </div>
                )}

                {/* Rows Display */}
                {rows.length === 0 ? (
                    <div className="p-6 text-center rounded-lg border border-dashed bg-muted/20">
                        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
                        {canAdd && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleAddRow}
                                className="mt-2 h-7 text-xs text-primary hover:text-primary/80"
                            >
                                <Plus className="size-3.5 mr-1" />
                                <span>{addButtonLabel}</span>
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View (Hidden on mobile) */}
                        <div className="hidden md:block overflow-x-auto rounded-md border">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/50 border-b text-[11px] font-medium text-muted-foreground uppercase">
                                    <tr>
                                        {allowReorder && <th className="py-2 px-2 w-12 text-center">#</th>}
                                        {columns.map((col) => (
                                            <th key={col.key} className={`py-2 px-3 ${col.width || ''}`}>
                                                {col.label}
                                            </th>
                                        ))}
                                        {isEditable && <th className="py-2 px-2 w-12 text-center"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.map((row, rIdx) => (
                                        <React.Fragment key={rIdx}>
                                            <tr className="hover:bg-muted/30 transition-colors">
                                                {allowReorder && (
                                                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-0.5">
                                                            <button
                                                                type="button"
                                                                disabled={!isEditable || rIdx === 0}
                                                                onClick={() => handleMoveRow(rIdx, 'up')}
                                                                className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                                                                title="Move up"
                                                            >
                                                                <ArrowUp className="size-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={!isEditable || rIdx === rows.length - 1}
                                                                onClick={() => handleMoveRow(rIdx, 'down')}
                                                                className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                                                                title="Move down"
                                                            >
                                                                <ArrowDown className="size-3" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}

                                                {columns.map((col) => {
                                                    const cellVal = row[col.key] ?? '';
                                                    const isDisabled = !isEditable || (col.disabled ? col.disabled(row, rIdx) : false);

                                                    return (
                                                        <td key={col.key} className="py-1.5 px-3">
                                                            {col.type === 'text' && (
                                                                <Input
                                                                    value={cellVal}
                                                                    disabled={isDisabled}
                                                                    placeholder={col.placeholder}
                                                                    onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                                                                    onBlur={handleBlur}
                                                                    className="h-7 text-xs"
                                                                />
                                                            )}

                                                            {col.type === 'date' && (
                                                                <Input
                                                                    type="date"
                                                                    value={cellVal}
                                                                    disabled={isDisabled}
                                                                    onChange={(e) => handleCellChange(rIdx, col.key, e.target.value, true)}
                                                                    onBlur={handleBlur}
                                                                    className="h-7 text-xs"
                                                                />
                                                            )}

                                                            {col.type === 'time' && (
                                                                <Input
                                                                    type="time"
                                                                    value={cellVal}
                                                                    disabled={isDisabled}
                                                                    onChange={(e) => handleCellChange(rIdx, col.key, e.target.value, true)}
                                                                    onBlur={handleBlur}
                                                                    className="h-7 text-xs"
                                                                />
                                                            )}

                                                            {col.type === 'number' && (
                                                                <Input
                                                                    type="number"
                                                                    min={col.min}
                                                                    max={col.max}
                                                                    step={col.step ?? 1}
                                                                    value={cellVal === null || cellVal === undefined ? '' : cellVal}
                                                                    disabled={isDisabled}
                                                                    placeholder={col.placeholder}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? null : Number(e.target.value);
                                                                        handleCellChange(rIdx, col.key, val);
                                                                    }}
                                                                    onBlur={handleBlur}
                                                                    className="h-7 text-xs"
                                                                />
                                                            )}

                                                            {col.type === 'select' && (
                                                                <Select
                                                                    value={String(cellVal || '')}
                                                                    disabled={isDisabled}
                                                                    onValueChange={(selected) => handleCellChange(rIdx, col.key, selected, true)}
                                                                >
                                                                    <SelectTrigger className="h-7 text-xs">
                                                                        <SelectValue placeholder={col.placeholder || 'Select...'} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(col.options || []).map((opt) => (
                                                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                                {opt.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}

                                                            {col.type === 'checkbox' && (
                                                                <div className="flex items-center justify-center">
                                                                    <Checkbox
                                                                        checked={Boolean(cellVal)}
                                                                        disabled={isDisabled}
                                                                        onCheckedChange={(checked) => handleCellChange(rIdx, col.key, Boolean(checked), true)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {isEditable && (
                                                    <td className="py-1.5 px-2 text-center">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={rows.length <= minRows}
                                                            onClick={() => handleRemoveRow(rIdx)}
                                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-20"
                                                            title="Delete row"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>

                                            {extraRowContent && (
                                                <tr className="bg-muted/10 border-b">
                                                    <td colSpan={columns.length + (allowReorder ? 1 : 0) + (isEditable ? 1 : 0)} className="p-3">
                                                        {extraRowContent(row, rIdx, (k, v) => handleCellChange(rIdx, k, v))}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card List View (Visible on small screens) */}
                        <div className="block md:hidden space-y-3">
                            {rows.map((row, rIdx) => (
                                <div key={rIdx} className="p-3 rounded-lg border bg-muted/10 space-y-2">
                                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                                        <span className="text-[11px] font-semibold text-muted-foreground">
                                            Row #{rIdx + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {allowReorder && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={!isEditable || rIdx === 0}
                                                        onClick={() => handleMoveRow(rIdx, 'up')}
                                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                                                    >
                                                        <ArrowUp className="size-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!isEditable || rIdx === rows.length - 1}
                                                        onClick={() => handleMoveRow(rIdx, 'down')}
                                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                                                    >
                                                        <ArrowDown className="size-3" />
                                                    </button>
                                                </>
                                            )}
                                            {isEditable && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={rows.length <= minRows}
                                                    onClick={() => handleRemoveRow(rIdx)}
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        {columns.map((col) => {
                                            const cellVal = row[col.key] ?? '';
                                            const isDisabled = !isEditable || (col.disabled ? col.disabled(row, rIdx) : false);

                                            return (
                                                <div key={col.key} className="space-y-1">
                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                        {col.label}
                                                    </span>
                                                    {col.type === 'text' && (
                                                        <Input
                                                            value={cellVal}
                                                            disabled={isDisabled}
                                                            placeholder={col.placeholder}
                                                            onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                                                            onBlur={handleBlur}
                                                            className="h-7 text-xs"
                                                        />
                                                    )}
                                                    {col.type === 'date' && (
                                                        <Input
                                                            type="date"
                                                            value={cellVal}
                                                            disabled={isDisabled}
                                                            onChange={(e) => handleCellChange(rIdx, col.key, e.target.value, true)}
                                                            onBlur={handleBlur}
                                                            className="h-7 text-xs"
                                                        />
                                                    )}
                                                    {col.type === 'time' && (
                                                        <Input
                                                            type="time"
                                                            value={cellVal}
                                                            disabled={isDisabled}
                                                            onChange={(e) => handleCellChange(rIdx, col.key, e.target.value, true)}
                                                            onBlur={handleBlur}
                                                            className="h-7 text-xs"
                                                        />
                                                    )}
                                                    {col.type === 'number' && (
                                                        <Input
                                                            type="number"
                                                            min={col.min}
                                                            max={col.max}
                                                            step={col.step ?? 1}
                                                            value={cellVal === null || cellVal === undefined ? '' : cellVal}
                                                            disabled={isDisabled}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? null : Number(e.target.value);
                                                                handleCellChange(rIdx, col.key, val);
                                                            }}
                                                            onBlur={handleBlur}
                                                            className="h-7 text-xs"
                                                        />
                                                    )}
                                                    {col.type === 'select' && (
                                                        <Select
                                                            value={String(cellVal || '')}
                                                            disabled={isDisabled}
                                                            onValueChange={(selected) => handleCellChange(rIdx, col.key, selected, true)}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs">
                                                                <SelectValue placeholder={col.placeholder || 'Select...'} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(col.options || []).map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                        {opt.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    {col.type === 'checkbox' && (
                                                        <div className="flex items-center space-x-2 pt-1">
                                                            <Checkbox
                                                                checked={Boolean(cellVal)}
                                                                disabled={isDisabled}
                                                                onCheckedChange={(checked) => handleCellChange(rIdx, col.key, Boolean(checked), true)}
                                                            />
                                                            <span className="text-xs">{col.label}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {extraRowContent && (
                                        <div className="pt-2 border-t border-border/50">
                                            {extraRowContent(row, rIdx, (k, v) => handleCellChange(rIdx, k, v))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
