import { Head, Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

export default function Layout({ title, children }: PropsWithChildren<{ title?: string }>) {
    const { appName } = usePage().props;

    return (
        <div className="min-h-screen bg-gray-100">
            <Head title={title} />
            <header className="border-b border-gray-200 bg-white">
                <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                    <Link href="/" className="text-lg font-semibold text-gray-900">
                        {appName}
                    </Link>
                    <div className="flex gap-6 text-sm font-medium text-gray-600">
                        <Link href="/" className="hover:text-gray-900">
                            Home
                        </Link>
                        <Link href="/about" className="hover:text-gray-900">
                            About
                        </Link>
                    </div>
                </nav>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </div>
    );
}