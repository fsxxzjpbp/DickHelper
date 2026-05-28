import type { ISyncStatus } from "@dickhelper/shared";

function GetApi(): Window["electronAPI"] {
    const api: Window["electronAPI"] | undefined = window.electronAPI;

    if (api === undefined) {
        throw new Error(
            "electronAPI is not available. The app must run inside Electron, not a browser. " +
            "The preload script may have failed to load. Check the terminal for [Preload] log messages."
        );
    }

    return api;
}

export class SyncService {
    public static Start(port?: number): Promise<ISyncStatus> {
        return GetApi().SyncStart(port);
    }

    public static Stop(): Promise<ISyncStatus> {
        return GetApi().SyncStop();
    }

    public static GetStatus(): Promise<ISyncStatus> {
        return GetApi().SyncGetStatus();
    }
}
