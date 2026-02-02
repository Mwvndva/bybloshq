/**
 * Global auth state tracker for preventing flash-logouts during rehydration
 */
class AuthStateManager {
    private isRehydrating: boolean = false;
    private queuedErrors: Array<{ error: any; timestamp: number }> = [];

    setRehydrating(value: boolean) {
        this.isRehydrating = value;
        console.log(`[AuthState] Rehydration state: ${value}`);
        
        // Process queued errors if rehydration is complete
        if (!value && this.queuedErrors.length > 0) {
            console.log(`[AuthState] Processing ${this.queuedErrors.length} queued errors`);
            this.queuedErrors = [];
        }
    }

    isCurrentlyRehydrating(): boolean {
        return this.isRehydrating;
    }

    queueError(error: any) {
        this.queuedErrors.push({ error, timestamp: Date.now() });
        console.log(`[AuthState] Queued 401 error during rehydration`);
    }

    clearQueue() {
        this.queuedErrors = [];
    }
}

export const authStateManager = new AuthStateManager();
