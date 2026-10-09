import { Head, Link, useForm } from '@inertiajs/react';
import { Camera, FileText, Plus } from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormSummary {
    id: number;
    code: string;
    form_type?: 'standard' | 'photo';
    name: string;
    form_version: string;
    template_version: number;
    answer_set: string;
    groups_count: number;
    questions_count: number;
}

interface Props {
    forms: FormSummary[];
}

export default function FormsIndex({ forms }: Props) {
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        form_type: 'photo' as 'standard' | 'photo',
        code: '',
        name: '',
        form_version: '1.0',
        answer_set: 'none',
    });

    const handleOpenCreate = (type: 'standard' | 'photo' = 'photo') => {
        setData({
            form_type: type,
            code: type === 'photo' ? 'P-' : '',
            name: '',
            form_version: '1.0',
            answer_set: type === 'photo' ? 'none' : 'ynnsna',
        });
        setCreateModalOpen(true);
    };

    const handleCreateForm = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/forms', {
            onSuccess: () => {
                setCreateModalOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <Head title="Form Templates" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <Heading
                        title="Form Templates"
                        description="Manage checklist questions, chapters, photo forms, and applicability for inspections and internal audits."
                    />

                    <div className="flex items-center gap-2">
                        <Button onClick={() => handleOpenCreate('photo')} className="flex items-center gap-1.5">
                            <Plus className="size-4" />
                            <span>Add Photo Form</span>
                        </Button>
                        <Button variant="outline" onClick={() => handleOpenCreate('standard')} className="flex items-center gap-1.5">
                            <Plus className="size-4" />
                            <span>Add Checklist Form</span>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {forms.map((form) => {
                        const isPhoto = form.form_type === 'photo';

                        return (
                            <Card key={form.id} className="flex flex-col justify-between">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-sm font-bold tracking-wide">
                                            {form.code}
                                        </Badge>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={isPhoto ? 'secondary' : 'outline'}>
                                                {isPhoto ? 'Photo Form' : 'Checklist'}
                                            </Badge>
                                            <Badge variant="secondary">v{form.template_version}</Badge>
                                        </div>
                                    </div>
                                    <CardTitle className="mt-3 text-xl flex items-center gap-2">
                                        {isPhoto ? <Camera className="size-5 text-primary shrink-0" /> : <FileText className="size-5 text-primary shrink-0" />}
                                        <span>{form.name}</span>
                                    </CardTitle>
                                    <CardDescription>
                                        {isPhoto ? (
                                            <span>Standalone or embeddable photo form template</span>
                                        ) : (
                                            <span>Answer set: <span className="font-mono text-xs">{form.answer_set}</span></span>
                                        )}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 text-center">
                                        <div>
                                            <p className="text-2xl font-bold text-foreground">{form.groups_count}</p>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{isPhoto ? 'Sections' : 'Chapters'}</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-foreground">{form.questions_count}</p>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{isPhoto ? 'Fields' : 'Questions'}</p>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="pt-2">
                                    <Button asChild className="w-full">
                                        <Link href={`/admin/forms/${form.id}`}>
                                            {isPhoto ? 'Edit Photo Fields' : 'Manage Template & Questions'}
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Create Form Dialog */}
            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {data.form_type === 'photo' ? 'Create New Photo Form' : 'Create New Checklist Form'}
                        </DialogTitle>
                        <DialogDescription>
                            {data.form_type === 'photo'
                                ? 'Create a new photo form template with photo inputs.'
                                : 'Create a new inspection or audit checklist template with chapters and questions.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateForm} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="form_type_select">Form Type</Label>
                            <Select
                                value={data.form_type}
                                onValueChange={(val: 'standard' | 'photo') => {
                                    setData((prev) => ({
                                        ...prev,
                                        form_type: val,
                                        code: val === 'photo' ? 'P-' : '',
                                        answer_set: val === 'photo' ? 'none' : 'ynnsna',
                                    }));
                                }}
                            >
                                <SelectTrigger id="form_type_select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="photo">Photo Form (Photo inputs with labels)</SelectItem>
                                    <SelectItem value="standard">Standard Checklist Form (Chapters & Questions)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="form_code">Form Code</Label>
                                <Input
                                    id="form_code"
                                    value={data.code}
                                    onChange={(e) => setData('code', e.target.value)}
                                    placeholder={data.form_type === 'photo' ? 'e.g. P-002' : 'e.g. D-063'}
                                    required
                                />
                                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="form_version">Version (Optional)</Label>
                                <Input
                                    id="form_version"
                                    value={data.form_version}
                                    onChange={(e) => setData('form_version', e.target.value)}
                                    placeholder="1.0"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="form_name">Form Name</Label>
                            <Input
                                id="form_name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder={data.form_type === 'photo' ? 'e.g. Engine Room Photo Record' : 'e.g. Navigation Audit Form'}
                                required
                            />
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Creating...' : 'Create Form'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

FormsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Form Templates', href: '/admin/forms' },
    ],
};
