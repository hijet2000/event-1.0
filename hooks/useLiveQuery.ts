import { useState, useEffect, useCallback } from 'react';
import { subscribe } from '../server/db';

/**
 * A hook that fetches data and automatically re-fetches it when specific database tables change.
 * This works across tabs using the underlying BroadcastChannel in db.ts.
 * 
 * @param queryFn The async function to fetch data (e.g., getDashboardStats)
 * @param tablesToWatch Array of table names that should trigger a refresh (e.g., ['registrations', 'transactions'])
 * @param dependencies Array of dependencies for the queryFn (like useEffect deps)
 */
export function useLiveQuery<T>(
    queryFn: () => Promise<T>,
    tablesToWatch: string[] = [],
    dependencies: any[] = []
): { data: T | null; isLoading: boolean; error: string | null; refresh: () => void } {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        // Don't set loading to true on background refreshes to avoid flicker
        // setIsLoading(true); 
        try {
            const result = await queryFn();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    }, [JSON.stringify(dependencies)]); // Deep compare deps if passed as literal arrays

    useEffect(() => {
        // Initial fetch
        setIsLoading(true);
        fetchData();

        // Subscription
        if (tablesToWatch.length > 0) {
            const unsubscribe = subscribe((changedTable) => {
                if (tablesToWatch.includes(changedTable)) {
                    // console.debug(`[LiveQuery] Refreshing due to change in ${changedTable}`);
                    fetchData();
                }
            });
            return () => { unsubscribe(); };
        }
    }, [fetchData, JSON.stringify(tablesToWatch)]);

    return { data, isLoading, error, refresh: fetchData };
}