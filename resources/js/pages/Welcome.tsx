import { Link, Head } from '@inertiajs/react';

export default function Welcome({ name }: { name?: string }) {
    return (
        <>
            <Head title="Welcome" />
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">
                <div className="max-w-xl text-center">
                    <h1 className="text-4xl font-bold text-gray-900">
                        Welcome{name ? `, ${name}` : ''}!
                    </h1>
                    <p className="mt-4 text-lg text-gray-600">
                        This is Inertia.js with React and Tailwind CSS.
                    </p>
                    <Link
                        href="/about"
                        className="mt-8 inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    >
                        Go to About
                    </Link>
                </div>
            </div>
        </>
    );
}