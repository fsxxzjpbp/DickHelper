import { useEffect, useState } from "react";
import type { UpdateSource } from "@dickhelper/shared";
import { useMobileDatabaseService } from "./useMobileDatabaseService";
import { GetMobileUpdateService } from "../services/MobileUpdateService";
import type { IMobileUpdateState } from "../types/MobileUpdate";

export interface IUseMobileUpdateStateOptions {
    readonly autoCheckOnMount?: boolean;
}

export interface IUseMobileUpdateStateResult {
    readonly updateState: IMobileUpdateState;
    readonly setUpdateSource: (source: UpdateSource) => Promise<IMobileUpdateState>;
    readonly checkForUpdates: () => Promise<IMobileUpdateState>;
    readonly downloadUpdate: () => Promise<IMobileUpdateState>;
    readonly installUpdate: () => Promise<IMobileUpdateState>;
    readonly openInstallPermissionSettings: () => Promise<void>;
}

export function useMobileUpdateState(options?: IUseMobileUpdateStateOptions): IUseMobileUpdateStateResult {
    const database = useMobileDatabaseService();
    const mobileUpdateService = GetMobileUpdateService(database);
    const [updateState, setUpdateState] = useState<IMobileUpdateState>(mobileUpdateService.GetState());

    useEffect(() => {
        const unsubscribe = mobileUpdateService.Subscribe((state: IMobileUpdateState) => {
            setUpdateState(state);
        });

        void mobileUpdateService.Initialize();

        return unsubscribe;
    }, [mobileUpdateService]);

    useEffect(() => {
        if (options?.autoCheckOnMount === true) {
            void mobileUpdateService.StartStartupCheck();
        }
    }, [mobileUpdateService, options?.autoCheckOnMount]);

    const setUpdateSource = async (source: UpdateSource): Promise<IMobileUpdateState> => {
        return mobileUpdateService.SetSource(source);
    };

    const checkForUpdates = async (): Promise<IMobileUpdateState> => {
        return mobileUpdateService.CheckForUpdates();
    };

    const downloadUpdate = async (): Promise<IMobileUpdateState> => {
        return mobileUpdateService.DownloadUpdate();
    };

    const installUpdate = async (): Promise<IMobileUpdateState> => {
        return mobileUpdateService.InstallUpdate();
    };

    const openInstallPermissionSettings = async (): Promise<void> => {
        await mobileUpdateService.OpenUnknownSourcesSettings();
    };

    return {
        updateState,
        setUpdateSource,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        openInstallPermissionSettings,
    };
}
