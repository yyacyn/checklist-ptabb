import { Head } from '@inertiajs/react';
import { Link } from '@inertiajs/react';

export default function About() {
    return (
        <>
            <Head title="About" />
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">
                <h1 className="text-3xl font-bold text-gray-900">About</h1>
                <Link href="/" className="mt-6 text-indigo-600 hover:underline">
                    Back home
                </Link>
            </div>
        </>
    );
}