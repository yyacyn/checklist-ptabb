import { Head, Link } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface FormSummary {
    id: number;
    code: string;
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
    return (
        <>
            <Head title="Form Templates" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div>
                    <Heading
                        title="Form Templates"
                        description="Manage checklist questions, chapters, subgroups, and applicability for inspections and internal audits."
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {forms.map((form) => (
                        <Card key={form.id} className="flex flex-col justify-between">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-sm font-bold tracking-wide">
                                        {form.code}
                                    </Badge>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">Paper {form.form_version}</Badge>
                                        <Badge variant="default">{form.code} v{form.template_version}</Badge>
                                    </div>
                                </div>
                                <CardTitle className="mt-3 text-xl">{form.name}</CardTitle>
                                <CardDescription>
                                    Answer set: <span className="font-mono text-xs">{form.answer_set}</span>
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-foreground">{form.groups_count}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Chapters & Subgroups</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-foreground">{form.questions_count}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Questions</p>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="pt-2">
                                <Button asChild className="w-full">
                                    <Link href={`/admin/forms/${form.id}`}>Manage Template & Questions</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

FormsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Form Templates', href: '/admin/forms' },
    ],
};
