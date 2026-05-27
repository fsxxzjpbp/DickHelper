import type { UpdateSource } from "@dickhelper/shared";

export interface IMobileUpdateManifest {
    readonly version: string;
    readonly versionCode: number;
    readonly publishedAt: string;
    readonly notes: string;
    readonly apkUrl: string;
    readonly apkSha256: string;
    readonly force?: boolean;
}

export type MobileUpdateStatus =
    | "idle"
    | "checking"
    | "up-to-date"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "permission-required"
    | "error"
    | "disabled";

export interface IMobileUpdateState {
    readonly Status: MobileUpdateStatus;
    readonly Source: UpdateSource;
    readonly CurrentVersion: string;
    readonly CurrentVersionCode: number;
    readonly AvailableVersion: string | null;
    readonly AvailableVersionCode: number | null;
    readonly PublishedAt: string | null;
    readonly Notes: string | null;
    readonly Force: boolean;
    readonly ManifestUrl: string;
    readonly ApkUrl: string | null;
    readonly DownloadProgress: number | null;
    readonly ErrorMessage: string | null;
    readonly IsChecking: boolean;
    readonly IsUpdateAvailable: boolean;
    readonly IsDownloading: boolean;
    readonly IsDownloaded: boolean;
    readonly IsInstalling: boolean;
    readonly IsPermissionRequired: boolean;
}
