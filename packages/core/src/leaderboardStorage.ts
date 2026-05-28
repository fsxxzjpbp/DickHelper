import type { IOnlineConfig } from "@dickhelper/shared";

const STORAGE_KEY = "dickhelper_online_config";
const DEFAULT_BASE_URL = "https://dickhelper-api.djangb.workers.dev";

// Generate UUID v4 — uses crypto.randomUUID() if available, manual fallback otherwise.
export function generateUUID(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    // Fallback: manual UUID v4 generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c: string): string => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Get online config from localStorage, returns default if nothing stored.
export function getOnlineConfig(): IOnlineConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
            const parsed: unknown = JSON.parse(raw);
            if (IsOnlineConfig(parsed)) {
                return parsed;
            }
        }
    } catch {
        // Ignore parse errors
    }

    return {
        enabled: false,
        uuid: null,
        nickname: null,
        baseUrl: DEFAULT_BASE_URL,
    };
}

// Save online config to localStorage.
export function setOnlineConfig(config: IOnlineConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function IsOnlineConfig(value: unknown): value is IOnlineConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const obj = value as Record<string, unknown>;
    return (
        typeof obj.enabled === "boolean" &&
        (obj.uuid === null || typeof obj.uuid === "string") &&
        (obj.nickname === null || typeof obj.nickname === "string") &&
        typeof obj.baseUrl === "string"
    );
}
