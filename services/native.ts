
/**
 * Native Service Abstraction
 * Wraps CapacitorJS plugins for safe usage in both Web and Native environments.
 */

export const isNative = (): boolean => {
    return (window as any).Capacitor?.isNativePlatform() || false;
};

export const getPlatform = (): string => {
    return (window as any).Capacitor?.getPlatform() || 'web';
};

/**
 * Access Native Contacts
 * Requires @capacitor-community/contacts
 */
export const pickContact = async (): Promise<{ name?: string, email?: string } | null> => {
    if (!isNative()) {
        console.warn("Contact picker not available on web.");
        return null;
    }
    
    // In a real Capacitor project, you would import:
    // import { Contacts } from '@capacitor-community/contacts';
    
    try {
        // Simulation of native plugin call
        console.log("[Native] Opening Contact Picker...");
        
        // Mock async delay for native interaction
        return new Promise((resolve) => {
            setTimeout(() => {
                // Return mock data for demonstration if actual plugin isn't present in this web container
                resolve({ name: "Native Contact", email: "mobile@example.com" });
            }, 1000);
        });
    } catch (e) {
        console.error("Failed to pick contact:", e);
        return null;
    }
};

/**
 * Configure Background Fetch
 * Requires @transistorsoft/capacitor-background-fetch
 */
export const configureBackgroundFetch = async (onFetch: () => Promise<void>) => {
    if (!isNative()) {
        console.log("Background fetch not available on web.");
        return;
    }

    try {
        console.log("[Native] Configuring Background Fetch...");
        // const status = await BackgroundFetch.configure({
        //   minimumFetchInterval: 15
        // }, async (taskId) => {
        //   console.log("[BackgroundFetch] Task received: ", taskId);
        //   await onFetch();
        //   BackgroundFetch.finish(taskId);
        // });
    } catch (e) {
        console.error("Background Fetch Error:", e);
    }
};

/**
 * Haptics Feedback
 * Requires @capacitor/haptics
 */
export const hapticImpact = async () => {
    if (isNative()) {
        // await Haptics.impact({ style: ImpactStyle.Medium });
    }
};
