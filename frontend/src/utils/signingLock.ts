/**
 * Global signing lock to prevent background requests during wallet signing.
 * 
 * When the wallet signing popup is open, background requests can interfere
 * with the signing process and cause failures. This module provides a way
 * for all contexts/hooks to check if signing is in progress.
 */

let isSigningInProgress = false;
const listeners: Set<() => void> = new Set();

export const SigningLock = {
    /**
     * Start signing - blocks all background requests
     */
    acquire: () => {
        isSigningInProgress = true;
        console.log('[SigningLock] Acquired - background requests blocked');
        // Notify all listeners
        listeners.forEach(listener => listener());
    },

    /**
     * End signing - resumes background requests
     */
    release: () => {
        isSigningInProgress = false;
        console.log('[SigningLock] Released - background requests resumed');
        // Notify all listeners
        listeners.forEach(listener => listener());
    },

    /**
     * Check if signing is in progress
     */
    isLocked: () => isSigningInProgress,

    /**
     * Subscribe to lock state changes
     */
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
};

export default SigningLock;
