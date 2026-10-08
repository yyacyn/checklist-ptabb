import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, FileCheck, Info, Loader2, Ship } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormOption {
    id: number;
    code: string;
    name: string;
    template_version: number;
    form_version: string;
}

interface VesselTypeItem {
    id: number;
    name: string;
}

interface Props {
    forms: FormOption[];
    vessel_types: VesselTypeItem[];
    known_vessels: string[];
    default_vessel_name?: string;
    default_inspector_name?: string;
}

export const INSPECTION_OPERATIONS = [
    'Loading',
    'Discharging',
    'Bunkering',
    'Deballasting',
    'Ballasting',
    'River transit',
    'IGS in operation',
    'Major repairs/ Drydock',
    'COW in progress',
    'Repairs under way',
    'STS operations',
    'Idle',
    'At anchor',
    'At sea/Sailing',
    'Other',
];

export default function ReportCreate({
    forms,
    vessel_types,
    known_vessels,
    default_vessel_name = '',
    default_inspector_name = '',
}: Props) {
    const defaultForm = forms[0];

    const { data, setData, post, processing, errors } = useForm({
        form_id: defaultForm ? String(defaultForm.id) : '',
        vessel_name: default_vessel_name,
        vessel_imo: '',
        vessel_flag: '',
        vessel_gt: '',
        vessel_built: '',
        vessel_type_id: '',
        vessel_ice_class: false,
        report_date: new Date().toISOString().split('T')[0],
        master_name: '',
        chief_engineer_name: '',
        chief_officer_name: '',
        inspected_by: default_inspector_name,
        port: '',
        sailing_with_vessel: false,
        sailing_from: '',
        sailing_to: '',
        psc_last_port: '',
        psc_last_date: '',
        psc_detained_or_deficiencies: false,
        drydock_last_date: '',
        drydock_next_date: '',
        operations: [] as string[],
    });

    const [vesselSuggestions, setVesselSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleVesselNameChange = (val: string) => {
        setData('vessel_name', val);
        if (val.trim().length > 0) {
            const matches = known_vessels.filter((name) =>
                name.toLowerCase().includes(val.toLowerCase())
            );
            setVesselSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setVesselSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (name: string) => {
        setData('vessel_name', name);
        setShowSuggestions(false);
    };

    const toggleOperation = (op: string) => {
        setData('operations', data.operations.includes(op)
            ? data.operations.filter((o) => o !== op)
            : [...data.operations, op]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/reports');
    };

    return (
        <>
            <Head title="Create New Report" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                        <ArrowLeft className="size-4 mr-1" /> Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">Create Report</h1>
                        <p className="text-sm text-muted-foreground">Initialise a new inspection or audit report (Form D-062 / B-008).</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Summary Banner */}
                    {Object.keys(errors).length > 0 && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                            <p className="font-semibold mb-1">Please review the required details:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs">
                                {Object.entries(errors).map(([key, msg]) => (
                                    <li key={key}>{msg}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Form Template Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileCheck className="size-4 text-primary" />
                                <span>1. Select Report Type & Form Template</span>
                            </CardTitle>
                            <CardDescription>
                                Questions and chapters will be copied from this template version into the new report.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                {forms.map((f) => (
                                    <div
                                        key={f.id}
                                        onClick={() => setData('form_id', String(f.id))}
                                        className={`flex flex-col justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                            String(data.form_id) === String(f.id)
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                : 'border-border hover:border-muted-foreground/40'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <Badge variant="outline" className="font-bold mb-1.5">
                                                    {f.code}
                                                </Badge>
                                                <h4 className="font-semibold text-foreground text-sm">{f.name}</h4>
                                            </div>
                                            {String(data.form_id) === String(f.id) && (
                                                <div className="rounded-full bg-primary p-1 text-primary-foreground">
                                                    <Check className="size-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Paper: {f.form_version}</span>
                                            <span>•</span>
                                            <span>Template: v{f.template_version}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {errors.form_id && (
                                <p className="text-xs text-destructive mt-2">{errors.form_id}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Vessel Particulars */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Ship className="size-4 text-primary" />
                                <span>2. Vessel Particulars</span>
                            </CardTitle>
                            <CardDescription>
                                Vessel particulars resolve template applicability (Tanker vs Cement, Ice Class).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Vessel Name with Autocomplete */}
                                <div className="space-y-1 relative">
                                    <Label htmlFor="vessel_name">Vessel Name *</Label>
                                    <Input
                                        id="vessel_name"
                                        placeholder="e.g. MV AMARIN GLORY"
                                        value={data.vessel_name}
                                        onChange={(e) => handleVesselNameChange(e.target.value)}
                                        onFocus={() => {
                                             if (data.vessel_name.trim().length > 0 && known_vessels.length > 0) {
                                                setShowSuggestions(true);
                                            }
                                        }}
                                        autoComplete="off"
                                        required
                                    />
                                    {showSuggestions && vesselSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md py-1">
                                            {vesselSuggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onClick={() => handleSelectSuggestion(suggestion)}
                                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/80 transition-colors"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {errors.vessel_name && (
                                        <p className="text-xs text-destructive">{errors.vessel_name}</p>
                                    )}
                                </div>

                                {/* IMO Number */}
                                <div className="space-y-1">
                                    <Label htmlFor="vessel_imo">IMO Number *</Label>
                                    <Input
                                        id="vessel_imo"
                                        placeholder="e.g. 9123456"
                                        value={data.vessel_imo}
                                        onChange={(e) => setData('vessel_imo', e.target.value)}
                                        required
                                    />
                                    {errors.vessel_imo && (
                                        <p className="text-xs text-destructive">{errors.vessel_imo}</p>
                                    )}
                                </div>

                                {/* Vessel Type */}
                                <div className="space-y-1">
                                    <Label htmlFor="vessel_type_id">Vessel Type *</Label>
                                    <Select
                                        value={data.vessel_type_id}
                                        onValueChange={(val) => setData('vessel_type_id', val)}
                                        required
                                    >
                                        <SelectTrigger id="vessel_type_id">
                                            <SelectValue placeholder="Select vessel type..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vessel_types.map((vt) => (
                                                 <SelectItem key={vt.id} value={String(vt.id)}>
                                                    {vt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.vessel_type_id && (
                                        <p className="text-xs text-destructive">{errors.vessel_type_id}</p>
                                    )}
                                </div>

                                {/* Flag */}
                                <div className="space-y-1">
                                    <Label htmlFor="vessel_flag">Flag State *</Label>
                                    <Input
                                        id="vessel_flag"
                                        placeholder="e.g. Panama, Indonesia"
                                        value={data.vessel_flag}
                                        onChange={(e) => setData('vessel_flag', e.target.value)}
                                        required
                                    />
                                    {errors.vessel_flag && (
                                        <p className="text-xs text-destructive">{errors.vessel_flag}</p>
                                    )}
                                </div>

                                {/* Gross Tonnage */}
                                <div className="space-y-1">
                                    <Label htmlFor="vessel_gt">Gross Tonnage (GT) *</Label>
                                    <Input
                                        id="vessel_gt"
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 15420"
                                        value={data.vessel_gt}
                                        onChange={(e) => setData('vessel_gt', e.target.value)}
                                        required
                                    />
                                    {errors.vessel_gt && (
                                        <p className="text-xs text-destructive">{errors.vessel_gt}</p>
                                    )}
                                </div>

                                {/* Year Built */}
                                <div className="space-y-1">
                                    <Label htmlFor="vessel_built">Year Built *</Label>
                                    <Input
                                        id="vessel_built"
                                        type="number"
                                        placeholder="e.g. 2012"
                                        value={data.vessel_built}
                                        onChange={(e) => setData('vessel_built', e.target.value)}
                                        required
                                    />
                                    {errors.vessel_built && (
                                        <p className="text-xs text-destructive">{errors.vessel_built}</p>
                                    )}
                                </div>
                            </div>

                            {/* Ice Class Checkbox */}
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    id="vessel_ice_class"
                                    type="checkbox"
                                    checked={data.vessel_ice_class}
                                    onChange={(e) => setData('vessel_ice_class', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="vessel_ice_class" className="cursor-pointer text-sm font-normal">
                                    Vessel has <strong>Ice Class Notation</strong> (Unlocks Chapter 13 Ice Operations checklist)
                                </Label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inspection & Personnel Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                <span>3. Inspection & Personnel Particulars</span>
                            </CardTitle>
                            <CardDescription>
                                Attendance details and senior officer particulars (Form D-062 Chapter 1).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="report_date">Date of Inspection / Audit *</Label>
                                    <Input
                                        id="report_date"
                                        type="date"
                                        value={data.report_date}
                                        onChange={(e) => setData('report_date', e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="port">Port / Location</Label>
                                    <Input
                                        id="port"
                                        placeholder="e.g. Singapore, Cigading, Bojonegara"
                                        value={data.port}
                                        onChange={(e) => setData('port', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="inspected_by">Inspector / Lead Auditor Name</Label>
                                    <Input
                                        id="inspected_by"
                                        placeholder="e.g. Rendy"
                                        value={data.inspected_by}
                                        onChange={(e) => setData('inspected_by', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="master_name">Master Name</Label>
                                    <Input
                                        id="master_name"
                                        placeholder="Capt. Name"
                                        value={data.master_name}
                                        onChange={(e) => setData('master_name', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="chief_engineer_name">Chief Engineer Name</Label>
                                    <Input
                                        id="chief_engineer_name"
                                        placeholder="C/E Name"
                                        value={data.chief_engineer_name}
                                        onChange={(e) => setData('chief_engineer_name', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="chief_officer_name">Chief Officer Name</Label>
                                    <Input
                                        id="chief_officer_name"
                                        placeholder="C/O Name"
                                        value={data.chief_officer_name}
                                        onChange={(e) => setData('chief_officer_name', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Sailing With Vessel */}
                            <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="sailing_with_vessel"
                                        type="checkbox"
                                        checked={Boolean(data.sailing_with_vessel)}
                                        onChange={(e) => setData('sailing_with_vessel', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor="sailing_with_vessel" className="cursor-pointer text-sm font-semibold">
                                        Sailing with Vessel during inspection
                                    </Label>
                                </div>

                                {data.sailing_with_vessel && (
                                    <div className="grid gap-4 md:grid-cols-2 pt-1 pl-6">
                                        <div className="space-y-1">
                                            <Label htmlFor="sailing_from">Sailing From</Label>
                                            <Input
                                                id="sailing_from"
                                                placeholder="e.g. Merak"
                                                value={data.sailing_from}
                                                onChange={(e) => setData('sailing_from', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="sailing_to">Sailing To</Label>
                                            <Input
                                                id="sailing_to"
                                                placeholder="e.g. Batam"
                                                value={data.sailing_to}
                                                onChange={(e) => setData('sailing_to', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Port State Control & Dry Dock Particulars */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileCheck className="size-4 text-primary" />
                                <span>4. Port State Control (PSC) & Dry Dock Dates</span>
                            </CardTitle>
                            <CardDescription>
                                Inspection history and docking dates (Form D-062 Chapter 1).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="psc_last_port">Port of Last PSC Inspection</Label>
                                    <Input
                                        id="psc_last_port"
                                        placeholder="e.g. Tanjung Priok"
                                        value={data.psc_last_port}
                                        onChange={(e) => setData('psc_last_port', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="psc_last_date">Date of Last PSC Inspection</Label>
                                    <Input
                                        id="psc_last_date"
                                        type="date"
                                        value={data.psc_last_date}
                                        onChange={(e) => setData('psc_last_date', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="psc_detained_or_deficiencies"
                                    type="checkbox"
                                    checked={Boolean(data.psc_detained_or_deficiencies)}
                                    onChange={(e) => setData('psc_detained_or_deficiencies', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="psc_detained_or_deficiencies" className="cursor-pointer text-xs font-medium text-muted-foreground">
                                    Vessel was detained or deficiencies were identified during last PSC (verify close out)
                                </Label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                                <div className="space-y-1">
                                    <Label htmlFor="drydock_last_date">Date of Last Dry Dock</Label>
                                    <Input
                                        id="drydock_last_date"
                                        type="date"
                                        value={data.drydock_last_date}
                                        onChange={(e) => setData('drydock_last_date', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="drydock_next_date">Next Dry Dock Date</Label>
                                    <Input
                                        id="drydock_next_date"
                                        type="date"
                                        value={data.drydock_next_date}
                                        onChange={(e) => setData('drydock_next_date', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operations at the time of inspection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Info className="size-4 text-primary" />
                                <span>5. Operations at the Time of Inspection</span>
                            </CardTitle>
                            <CardDescription>
                                Select all operations taking place during attendance (Form D-062 Chapter 1).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                                {INSPECTION_OPERATIONS.map((op) => {
                                    const isSelected = data.operations.includes(op);
                                    return (
                                        <button
                                            key={op}
                                            type="button"
                                            onClick={() => toggleOperation(op)}
                                            className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                                                    : 'border-border hover:bg-muted/60 text-muted-foreground'
                                            }`}
                                        >
                                            <span className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50'
                                            }`}>
                                                {isSelected && <Check className="size-2.5" />}
                                            </span>
                                            <span className="truncate">{op}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit Bar */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button variant="outline" type="button" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing} className="min-w-36">
                            {processing ? (
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="size-4 animate-spin" />
                                    Creating Report...
                                </span>
                            ) : (
                                'Create & Start Filling'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

ReportCreate.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reports & Audits', href: '/reports' },
        { title: 'Create Report', href: '/reports/create' },
    ],
};
