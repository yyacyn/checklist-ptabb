export {};

declare module '@inertiajs/core' {
    interface PageProps {
        appName: string;
        auth: {
            user: {
                id: number;
                name: string;
                email: string;
            } | null;
        };
    }
}