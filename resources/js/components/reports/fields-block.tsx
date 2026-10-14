import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export type FieldInputType =
    | 'text'
    | 'date'
    | 'time'
    | 'number'
    | 'select'
    | 'textarea'
    | 'checkbox';

export interface FieldOption {
    value: string;
    label: string;
}

export interface FieldConfig {
    name: string;
    label: string;
    type: FieldInputType;
    placeholder?: string;
    description?: string;
    options?: FieldOption[];
    colSpan?: 1 | 2 | 3 | 4 | 6 | 12;
    min?: number;
    max?: number;
    step?: number;
    rows?: number;
    required?: boolean;
    disabled?: boolean;
    prefix?: string;
    suffix?: string;
}

export interface FieldsBlockProps {
    reportId: number;
    fields: FieldConfig[];
    values: Record<string, any>;
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    isEditable?: boolean;
    endpoint?: string;
    debounceMs?: number;
    columns?: 1 | 2 | 3 | 4;
    onValuesChange?: (newValues: Record<string, any>) => void;
    onSaveSuccess?: (response: any) => void;
    onSaveError?: (error: any) => void;
    className?: string;
    headerActions?: React.ReactNode;
}

export function FieldsBlock({
    reportId,
    fields,
    values,
    title,
    description,
    icon: Icon,
    isEditable = true,
    endpoint,
    debounceMs = 1000,
    columns = 2,
    onValuesChange,
    onSaveSuccess,
    onSaveError,
    className = '',
    headerActions,
}: FieldsBlockProps) {
    const targetEndpoint = endpoint || `/reports/${reportId}/fields`;

    // Local form state
    const [formState, setFormState] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        for (const field of fields) {
            initial[field.name] = values[field.name] ?? (field.type === 'checkbox' ? false : '');
        }
        return initial;
    });

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    // Refs for debounced autosave
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedValues = useRef<Record<string, any>>({ ...formState });
    const formStateRef = useRef<Record<string, any>>(formState);
    formStateRef.current = formState;

    // Sync from outside if values prop changes and differs from lastSavedValues
    useEffect(() => {
        setFormState((prev) => {
            const next = { ...prev };
            let hasChange = false;
            for (const field of fields) {
                if (values[field.name] !== undefined && values[field.name] !== prev[field.name]) {
                    next[field.name] = values[field.name];
                    hasChange = true;
                }
            }
            if (hasChange) {
                lastSavedValues.current = { ...next };
                return next;
            }
            return prev;
        });
    }, [values, fields]);

    const performSave = useCallback(
        async (currentValues: Record<string, any>) => {
            if (!isEditable) return;

            setSaveStatus('saving');
            setErrorMessage(undefined);

            const clientSaveId = generateClientSaveId();
            const payload = {
                fields: currentValues,
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
                    lastSavedValues.current = { ...currentValues };
                    setSaveStatus('saved');
                    setTimeout(() => {
                        setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
                    }, 2500);
                    onSaveSuccess?.(data);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    const msg = errData?.message || `Server responded with ${res.status}`;
                    setSaveStatus('error');
                    setErrorMessage(msg);
                    onSaveError?.(errData);
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
                onSaveError?.(err);
            }
        },
        [isEditable, reportId, targetEndpoint, onSaveSuccess, onSaveError]
    );

    const triggerAutosave = useCallback(
        (nextValues: Record<string, any>, immediate = false) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            if (immediate) {
                performSave(nextValues);
            } else {
                debounceTimer.current = setTimeout(() => {
                    performSave(nextValues);
                }, debounceMs);
            }
        },
        [performSave, debounceMs]
    );

    const handleFieldChange = (fieldName: string, val: any, immediate = false) => {
        const next = { ...formStateRef.current, [fieldName]: val };
        setFormState(next);
        formStateRef.current = next;
        onValuesChange?.(next);
        triggerAutosave(next, immediate);
    };

    const handleBlur = () => {
        // Flush any pending debounce when leaving an input (NFR-1)
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
            performSave(formStateRef.current);
        }
    };

    // Unmount flush
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                performSave(formStateRef.current);
            }
        };
    }, [performSave]);

    // Grid columns class
    const gridColsClass =
        columns === 1
            ? 'grid-cols-1'
            : columns === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : columns === 4
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2';

    return (
        <Card className={className}>
            {(title || description || Icon) && (
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
                        {headerActions}
                        <SaveStatusIndicator status={saveStatus} errorMessage={errorMessage} />
                    </div>
                </CardHeader>
            )}

            <CardContent className="space-y-4 pt-1">
                <div className={`grid gap-4 ${gridColsClass}`}>
                    {fields.map((field) => {
                        const val = formState[field.name] ?? '';
                        const isDisabled = !isEditable || field.disabled;

                        // Grid column span
                        let spanClass = '';
                        if (field.colSpan === 12 || field.colSpan === 4 || field.type === 'textarea') {
                            spanClass = 'sm:col-span-2 md:col-span-full';
                        } else if (field.colSpan === 2 && columns >= 3) {
                            spanClass = 'md:col-span-2';
                        }

                        return (
                            <div key={field.name} className={`space-y-1.5 ${spanClass}`}>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={`field_${field.name}`} className="text-xs font-medium text-foreground">
                                        {field.label}
                                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                                    </Label>
                                    {field.suffix && !field.prefix && (
                                        <span className="text-[10px] text-muted-foreground">{field.suffix}</span>
                                    )}
                                </div>

                                {field.type === 'text' && (
                                    <Input
                                        id={`field_${field.name}`}
                                        value={val}
                                        disabled={isDisabled}
                                        placeholder={field.placeholder}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs"
                                    />
                                )}

                                {field.type === 'date' && (
                                    <Input
                                        id={`field_${field.name}`}
                                        type="date"
                                        value={val}
                                        disabled={isDisabled}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value, true)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs"
                                    />
                                )}

                                {field.type === 'time' && (
                                    <Input
                                        id={`field_${field.name}`}
                                        type="time"
                                        value={val}
                                        disabled={isDisabled}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value, true)}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs"
                                    />
                                )}

                                {field.type === 'number' && (
                                    <Input
                                        id={`field_${field.name}`}
                                        type="number"
                                        min={field.min}
                                        max={field.max}
                                        step={field.step ?? 1}
                                        value={val === null || val === undefined ? '' : val}
                                        disabled={isDisabled}
                                        placeholder={field.placeholder}
                                        onChange={(e) => {
                                            const num = e.target.value === '' ? null : Number(e.target.value);
                                            handleFieldChange(field.name, num);
                                        }}
                                        onBlur={handleBlur}
                                        className="h-8 text-xs"
                                    />
                                )}

                                {field.type === 'select' && (
                                    <Select
                                        value={String(val || '')}
                                        disabled={isDisabled}
                                        onValueChange={(selected) => handleFieldChange(field.name, selected, true)}
                                    >
                                        <SelectTrigger id={`field_${field.name}`} className="h-8 text-xs">
                                            <SelectValue placeholder={field.placeholder || 'Select...'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(field.options || []).map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {field.type === 'checkbox' && (
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox
                                            id={`field_${field.name}`}
                                            checked={Boolean(val)}
                                            disabled={isDisabled}
                                            onCheckedChange={(checked) => handleFieldChange(field.name, Boolean(checked), true)}
                                        />
                                        {field.description && (
                                            <label
                                                htmlFor={`field_${field.name}`}
                                                className="text-xs text-muted-foreground cursor-pointer select-none"
                                            >
                                                {field.description}
                                            </label>
                                        )}
                                    </div>
                                )}

                                {field.type === 'textarea' && (
                                    <textarea
                                        id={`field_${field.name}`}
                                        value={val}
                                        disabled={isDisabled}
                                        rows={field.rows || 3}
                                        placeholder={field.placeholder}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        onBlur={handleBlur}
                                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                )}

                                {field.description && field.type !== 'checkbox' && (
                                    <p className="text-[10px] text-muted-foreground">{field.description}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
