
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Contacts } from '@capacitor-community/contacts';
import { BackgroundFetch } from '@transistorsoft/capacitor-background-fetch';

/**
 * Native Service Abstraction
 * Wraps CapacitorJS plugins for safe usage in both Web and Native environments.
 */

export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

export const getPlatform = (): string => {
    return Capacitor.getPlatform();
};

/**
 * Access Native Contacts
 * Requires @capacitor-community/contacts
 */
export const pickContact = async (): Promise<{ name?: string, email?: string } | null> => {
    if (!isNative()) {
        console.warn("Contact picker not available on web. Using mock data.");
        // Mock async delay for web testing
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ name: "Web Mock Contact", email: "mock@example.com" });
            }, 500);
        });
    }
    
    try {
        const permission = await Contacts.requestPermissions();
        if (!permission.contacts) {
            console.warn("Contact permission denied");
            return null;
        }

        const result = await Contacts.pickContact({
            projection: {
                name: true,
                phones: true,
                emails: true
            }
        });

        if (result && result.contact) {
            const name = result.contact.name?.display || result.contact.name?.given;
            const email = result.contact.emails?.[0]?.address;
            return { name, email };
        }
    } catch (e) {
        console.error("Failed to pick contact:", e);
    }
    return null;
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
        const status = await BackgroundFetch.configure({
            minimumFetchInterval: 15, // minutes
            stopOnTerminate: false,
            startOnBoot: true,
            enableHeadless: true,
            forceAlarmManager: false, // Android specific
            requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY
        }, async (taskId) => {
            console.log("[BackgroundFetch] Task received: ", taskId);
            
            try {
                await onFetch();
            } catch (error) {
                console.error("[BackgroundFetch] Task error: ", error);
            }
            
            // Required: Signal completion of your task to OS
            BackgroundFetch.finish(taskId);
        }, (taskId) => {
            console.log("[BackgroundFetch] TIMEOUT: ", taskId);
            BackgroundFetch.finish(taskId);
        });

        console.log("[BackgroundFetch] Status: ", status);
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
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) {
            console.warn("Haptics failed", e);
        }
    }
};
