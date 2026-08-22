import { useRef, useState, useCallback } from "react";

/**
 * A reusable hook to prevent concurrent execution of asynchronous functions.
 * Uses a synchronous ref-based lock to prevent race conditions during state updates.
 */
export function useAsyncLock() {
    const lockRef = useRef(false);
    const [isLocked, setIsLocked] = useState(false);

    const runWithLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
        // Synchronous guard to prevent overlapping calls
        if (lockRef.current) return undefined;

        lockRef.current = true;
        setIsLocked(true);

        try {
            return await fn();
        } finally {
            // Always release the lock, even if the function fails
            lockRef.current = false;
            setIsLocked(false);
        }
    }, []);

    return { runWithLock, isLocked };
}


