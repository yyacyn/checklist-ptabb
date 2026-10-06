/**
 * Browser Retry Queue & IndexedDB Storage for Shipboard VSAT Resilience (NFR-1, NFR-2).
 *
 * Guarantees that:
 * 1. Every answer save carries an idempotent `client_save_id` (UUID).
 * 2. If a VSAT connection drops or an HTTP request fails, the change is persisted in IndexedDB.
 * 3. On reconnect (window 'online' or periodic retry loop), the queue flushes sequentially.
 * 4. Zero heavy external dependencies (pure browser IndexedDB).
 */

const DB_NAME = 'vessel_checklist_offline';
const DB_VERSION = 1;
const STORE_NAME = 'save_queue';

export interface QueuedSaveItem {
    client_save_id: string;
    report_id: number;
    question_id: number;
    endpoint: string;
    payload: {
        answer?: string | null;
        note?: string | null;
        extra_value?: string | null;
        client_save_id: string;
    };
    timestamp: number;
    attempts: number;
    last_error?: string;
}

export type QueueSyncState = 'idle' | 'saving' | 'saved' | 'retrying' | 'offline';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'client_save_id' });
                store.createIndex('report_id', 'report_id', { unique: false });
                store.createIndex('question_id', 'question_id', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Generate a client UUID for idempotency (NFR-2).
 */
export function generateClientSaveId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'save_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Save an item into the IndexedDB retry queue.
 */
export async function enqueueSave(item: QueuedSaveItem): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Failed to enqueue into IndexedDB:', e);
    }
}

/**
 * Remove an item from the IndexedDB retry queue after successful server acknowledgement.
 */
export async function dequeueSave(clientSaveId: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(clientSaveId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Failed to delete from IndexedDB:', e);
    }
}

/**
 * Retrieve all pending queued items for a specific report.
 */
export async function getPendingSaves(reportId: number): Promise<QueuedSaveItem[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('report_id');
            const req = index.getAll(reportId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Failed to read from IndexedDB:', e);
        return [];
    }
}

/**
 * Get count of pending items for a report.
 */
export async function getPendingCount(reportId: number): Promise<number> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('report_id');
            const req = index.count(reportId);
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return 0;
    }
}

/**
 * Reconcile and flush pending saves sequentially to the server (NFR-1, NFR-2).
 * Small payload, one answer per request to keep payloads under limits on VSAT.
 */
let isFlushing = false;

export async function flushSaveQueue(
    reportId: number,
    onProgress?: (pendingCount: number, errorMsg?: string) => void
): Promise<{ processed: number; remaining: number }> {
    if (isFlushing) {
        return { processed: 0, remaining: await getPendingCount(reportId) };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const count = await getPendingCount(reportId);
        onProgress?.(count, 'Offline: waiting for connection...');
        return { processed: 0, remaining: count };
    }

    isFlushing = true;
    let processed = 0;

    try {
        const pending = await getPendingSaves(reportId);

        // Sort by timestamp so oldest changes are synced first
        pending.sort((a, b) => a.timestamp - b.timestamp);

        for (const item of pending) {
            try {
                // Get fresh CSRF token from meta tag
                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

                const response = await fetch(item.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': token,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(item.payload),
                });

                if (response.ok) {
                    await dequeueSave(item.client_save_id);
                    processed++;
                    const rem = await getPendingCount(reportId);
                    onProgress?.(rem);
                } else if (response.status >= 400 && response.status < 500 && response.status !== 419) {
                    // Client error (validation / unauthorized) - remove to prevent infinite loop
                    console.error('Save rejected by server:', response.status);
                    await dequeueSave(item.client_save_id);
                } else {
                    // 5xx server error or 419 expired session - keep in queue for next retry
                    item.attempts += 1;
                    item.last_error = `Server responded with ${response.status}`;
                    await enqueueSave(item);
                    break; // Pause flushing until next attempt
                }
            } catch (err) {
                // Network failure / disconnected
                item.attempts += 1;
                item.last_error = err instanceof Error ? err.message : 'Network failure';
                await enqueueSave(item);
                const rem = await getPendingCount(reportId);
                onProgress?.(rem, 'Network error. Retrying...');
                break; // Stop loop, connection is down
            }
        }
    } finally {
        isFlushing = false;
    }

    const remaining = await getPendingCount(reportId);
    return { processed, remaining };
}
