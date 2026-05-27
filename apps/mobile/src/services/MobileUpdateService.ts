import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { File as ExpoFile } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";
import type { UpdateSource } from "@dickhelper/shared";
import { MobileDatabaseService } from "./MobileDatabaseService";
import type { IMobileUpdateManifest, IMobileUpdateState, MobileUpdateStatus } from "../types/MobileUpdate";

const DEFAULT_UPDATE_SOURCE: UpdateSource = "mirror";
const MOBILE_UPDATE_SOURCE_SETTING_KEY = "mobile_update_source";
const MOBILE_LATEST_RELEASE_BASE_URL = "https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/";
const MOBILE_LATEST_MANIFEST_URL = `${MOBILE_LATEST_RELEASE_BASE_URL}mobile-update.json`;
const MOBILE_MIRROR_PREFIX = "https://ghfast.top/";
const UNKNOWN_SOURCES_PACKAGE_PREFIX = "package:";
const APK_MIME_TYPE = "application/vnd.android.package-archive";

let mobileUpdateService: MobileUpdateService | null = null;

export function GetMobileUpdateService(database: MobileDatabaseService): MobileUpdateService {
    if (mobileUpdateService === null) {
        mobileUpdateService = new MobileUpdateService(database);
    }

    return mobileUpdateService;
}

export class MobileUpdateService {
    private readonly _database: MobileDatabaseService;
    private readonly _installedVersion: string;
    private readonly _installedVersionCode: number;
    private _source: UpdateSource;
    private _state: IMobileUpdateState;
    private _manifest: IMobileUpdateManifest | null = null;
    private _downloadedFileUri: string | null = null;
    private _initializePromise: Promise<void> | null = null;
    private _startupCheckPerformed: boolean = false;
    private _checkOperationId: number = 0;
    private _downloadOperationId: number = 0;
    private readonly _listeners: Set<(state: IMobileUpdateState) => void> = new Set();

    public constructor(database: MobileDatabaseService) {
        this._database = database;
        this._installedVersion = this.GetInstalledVersionName();
        this._installedVersionCode = this.GetInstalledVersionCode();
        this._source = DEFAULT_UPDATE_SOURCE;
        this._state = this.CreateState("idle");

        if (!this.IsSupportedPlatform()) {
            this._state = this.CreateState("disabled", "仅支持 Android APK 更新");
        }
    }

    public GetState(): IMobileUpdateState {
        return { ...this._state };
    }

    public Subscribe(listener: (state: IMobileUpdateState) => void): () => void {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    public async Initialize(): Promise<void> {
        await this.EnsureInitialized();
    }

    public async SetSource(source: UpdateSource): Promise<IMobileUpdateState> {
        await this.EnsureInitialized();

        if (!this.IsSupportedPlatform() || this._state.IsChecking || this._state.IsDownloading || this._state.IsInstalling) {
            return this.GetState();
        }

        const nextSource: UpdateSource = this.ParseSource(source);
        if (nextSource === this._source) {
            return this.GetState();
        }

        await this._database.SetSetting(MOBILE_UPDATE_SOURCE_SETTING_KEY, nextSource);

        const previousDownloadedFileUri = this.GetDownloadedFileUri();
        await this.DeleteFileIfExists(previousDownloadedFileUri);

        this._manifest = null;
        this._downloadedFileUri = null;
        this._source = nextSource;
        this.UpdateState({
            Status: "idle",
            Source: nextSource,
            AvailableVersion: null,
            AvailableVersionCode: null,
            PublishedAt: null,
            Notes: null,
            Force: false,
            ManifestUrl: this.GetManifestUrl(nextSource),
            ApkUrl: null,
            DownloadProgress: null,
            ErrorMessage: null,
        });

        return this.GetState();
    }

    public StartStartupCheck(): void {
        if (this._startupCheckPerformed) {
            return;
        }

        this._startupCheckPerformed = true;
        void this.CheckForUpdates();
    }

    public async CheckForUpdates(): Promise<IMobileUpdateState> {
        await this.EnsureInitialized();

        if (!this.IsSupportedPlatform()) {
            this.UpdateState({
                Status: "disabled",
                ErrorMessage: "仅支持 Android APK 更新",
            });
            return this.GetState();
        }

        if (this._state.IsChecking || this._state.IsDownloading || this._state.IsInstalling) {
            return this.GetState();
        }

        const operationId = ++this._checkOperationId;
        this.UpdateState({
            Status: "checking",
            DownloadProgress: null,
            ErrorMessage: null,
        });

        try {
            const manifest = await this.FetchManifest();
            if (operationId !== this._checkOperationId) {
                return this.GetState();
            }

            this._manifest = manifest;

            if (manifest.versionCode <= this._installedVersionCode) {
                const staleFileUri = this.GetDownloadedFileUri(manifest);
                await this.DeleteFileIfExists(staleFileUri);
                this._manifest = null;
                this._downloadedFileUri = null;
                this.UpdateState({
                    Status: "up-to-date",
                    AvailableVersion: null,
                    AvailableVersionCode: null,
                    PublishedAt: null,
                    Notes: null,
                    Force: false,
                    ApkUrl: null,
                    DownloadProgress: null,
                    ErrorMessage: null,
                });
                return this.GetState();
            }

            const downloadedFileUri = this.BuildDownloadedFileUri(manifest);
            const isDownloaded = await this.IsDownloadedFileValid(downloadedFileUri, manifest.apkSha256);
            if (operationId !== this._checkOperationId) {
                return this.GetState();
            }

            if (isDownloaded) {
                this._downloadedFileUri = downloadedFileUri;
                this.UpdateState({
                    Status: "downloaded",
                    AvailableVersion: manifest.version,
                    AvailableVersionCode: manifest.versionCode,
                    PublishedAt: manifest.publishedAt,
                    Notes: manifest.notes,
                    Force: manifest.force ?? false,
                    ApkUrl: this.ResolveApkUrl(manifest.apkUrl),
                    DownloadProgress: 100,
                    ErrorMessage: null,
                });
                return this.GetState();
            }

            await this.DeleteFileIfExists(downloadedFileUri);
            this._downloadedFileUri = null;
            this.UpdateState({
                Status: "available",
                AvailableVersion: manifest.version,
                AvailableVersionCode: manifest.versionCode,
                PublishedAt: manifest.publishedAt,
                Notes: manifest.notes,
                Force: manifest.force ?? false,
                ApkUrl: this.ResolveApkUrl(manifest.apkUrl),
                DownloadProgress: null,
                ErrorMessage: null,
            });
        } catch (error: unknown) {
            if (operationId !== this._checkOperationId) {
                return this.GetState();
            }

            this.UpdateState({
                Status: "error",
                DownloadProgress: null,
                ErrorMessage: this.FormatError(error, "可切换更新源后重试。"),
            });
        }

        return this.GetState();
    }

    public async DownloadUpdate(): Promise<IMobileUpdateState> {
        await this.EnsureInitialized();

        if (!this.IsSupportedPlatform()) {
            this.UpdateState({
                Status: "disabled",
                ErrorMessage: "仅支持 Android APK 更新",
            });
            return this.GetState();
        }

        if (this._state.IsChecking || this._state.IsDownloading || this._state.IsInstalling) {
            return this.GetState();
        }

        if (this._manifest === null || this._state.AvailableVersionCode === null) {
            return this.GetState();
        }

        const operationId = ++this._downloadOperationId;
        const fileUri = this.BuildDownloadedFileUri(this._manifest);
        await this.DeleteFileIfExists(fileUri);

        this.UpdateState({
            Status: "downloading",
            DownloadProgress: 0,
            ErrorMessage: null,
        });

        try {
            await this.DownloadFile(fileUri, this._manifest.apkUrl, operationId);
            if (operationId !== this._downloadOperationId) {
                return this.GetState();
            }

            const isValid = await this.IsDownloadedFileValid(fileUri, this._manifest.apkSha256);
            if (!isValid) {
                await this.DeleteFileIfExists(fileUri);
                throw new Error("下载完成后校验失败");
            }

            this._downloadedFileUri = fileUri;
            this.UpdateState({
                Status: "downloaded",
                DownloadProgress: 100,
                ErrorMessage: null,
            });
        } catch (error: unknown) {
            if (operationId !== this._downloadOperationId) {
                return this.GetState();
            }

            this._downloadedFileUri = null;
            this.UpdateState({
                Status: "error",
                DownloadProgress: null,
                ErrorMessage: this.FormatError(error, "可稍后重试下载。"),
            });
        }

        return this.GetState();
    }

    public async InstallUpdate(): Promise<IMobileUpdateState> {
        await this.EnsureInitialized();

        if (!this.IsSupportedPlatform()) {
            this.UpdateState({
                Status: "disabled",
                ErrorMessage: "仅支持 Android APK 更新",
            });
            return this.GetState();
        }

        const fileUri = this.GetDownloadedFileUri();
        if (fileUri === null || this._manifest === null) {
            return this.GetState();
        }

        const isValid = await this.IsDownloadedFileValid(fileUri, this._manifest.apkSha256);
        if (!isValid) {
            await this.DeleteFileIfExists(fileUri);
            this._downloadedFileUri = null;
            this.UpdateState({
                Status: "error",
                DownloadProgress: null,
                ErrorMessage: "下载包校验失败，请重新下载更新。",
            });
            return this.GetState();
        }

        this.UpdateState({
            Status: "installing",
            ErrorMessage: null,
        });

        try {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                data: contentUri,
                type: APK_MIME_TYPE,
                flags: 1,
            });
            this.UpdateState({
                Status: "downloaded",
                ErrorMessage: null,
            });
        } catch (error: unknown) {
            if (this.IsPermissionError(error)) {
                this.UpdateState({
                    Status: "permission-required",
                    ErrorMessage: "需要先在系统设置中允许安装未知应用，再继续安装更新。",
                });
            } else {
                this.UpdateState({
                    Status: "error",
                    ErrorMessage: this.FormatError(error, "可重新打开安装器后重试。"),
                });
            }
        }

        return this.GetState();
    }

    public async OpenUnknownSourcesSettings(): Promise<void> {
        await this.EnsureInitialized();

        if (!this.IsSupportedPlatform()) {
            return;
        }

        const packageName = Application.applicationId;
        if (packageName === null || packageName.trim().length === 0) {
            throw new Error("无法读取应用包名，不能打开安装权限设置");
        }

        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
            data: `${UNKNOWN_SOURCES_PACKAGE_PREFIX}${packageName}`,
        });
    }

    private async EnsureInitialized(): Promise<void> {
        if (this._initializePromise === null) {
            this._initializePromise = this.InitializeAsync();
        }

        await this._initializePromise;
    }

    private async InitializeAsync(): Promise<void> {
        try {
            const storedSource = await this._database.GetSetting(MOBILE_UPDATE_SOURCE_SETTING_KEY);
            const nextSource = this.ParseSource(storedSource);
            this._source = nextSource;
            this.UpdateState({
                Source: nextSource,
                ManifestUrl: this.GetManifestUrl(nextSource),
            });
        } catch {
            this._source = DEFAULT_UPDATE_SOURCE;
            this.UpdateState({
                Source: DEFAULT_UPDATE_SOURCE,
                ManifestUrl: this.GetManifestUrl(DEFAULT_UPDATE_SOURCE),
            });
        }
    }

    private async FetchManifest(): Promise<IMobileUpdateManifest> {
        const response = await fetch(this.GetManifestUrl(this._source));
        if (!response.ok) {
            throw new Error(`更新清单请求失败（HTTP ${response.status}）`);
        }

        const payload: unknown = await response.json();
        return this.ParseManifest(payload);
    }

    private ParseManifest(payload: unknown): IMobileUpdateManifest {
        if (!this.IsRecord(payload)) {
            throw new Error("更新清单格式无效");
        }

        const version = payload.version;
        const versionCode = payload.versionCode;
        const publishedAt = payload.publishedAt;
        const notes = payload.notes;
        const apkUrl = payload.apkUrl;
        const apkSha256 = payload.apkSha256;
        const force = payload.force;

        if (!this.IsString(version) || version.trim().length === 0) {
            throw new Error("更新清单 version 无效");
        }

        if (!this.IsNumber(versionCode) || !Number.isInteger(versionCode) || versionCode <= 0) {
            throw new Error("更新清单 versionCode 无效");
        }

        if (!this.IsString(publishedAt) || Number.isNaN(Date.parse(publishedAt))) {
            throw new Error("更新清单 publishedAt 无效");
        }

        if (!this.IsString(notes)) {
            throw new Error("更新清单 notes 无效");
        }

        if (!this.IsString(apkUrl) || apkUrl.trim().length === 0) {
            throw new Error("更新清单 apkUrl 无效");
        }

        if (!this.IsString(apkSha256) || !/^[0-9a-fA-F]{64}$/.test(apkSha256.trim())) {
            throw new Error("更新清单 apkSha256 无效");
        }

        if (force !== undefined && !this.IsBoolean(force)) {
            throw new Error("更新清单 force 无效");
        }

        return {
            version: version.trim(),
            versionCode,
            publishedAt,
            notes,
            apkUrl: apkUrl.trim(),
            apkSha256: apkSha256.trim().toLowerCase(),
            force: force === true ? true : undefined,
        };
    }

    private UpdateState(nextState: Partial<IMobileUpdateState>): void {
        const status: MobileUpdateStatus = nextState.Status ?? this._state.Status;
        const source: UpdateSource = nextState.Source ?? this._source;
        this._source = source;

        this._state = {
            ...this._state,
            ...nextState,
            Status: status,
            Source: source,
            CurrentVersion: this._installedVersion,
            CurrentVersionCode: this._installedVersionCode,
            ManifestUrl: nextState.ManifestUrl ?? this.GetManifestUrl(source),
            IsChecking: status === "checking",
            IsUpdateAvailable:
                status === "available" ||
                status === "downloading" ||
                status === "downloaded" ||
                status === "installing" ||
                status === "permission-required",
            IsDownloading: status === "downloading",
            IsDownloaded: status === "downloaded",
            IsInstalling: status === "installing",
            IsPermissionRequired: status === "permission-required",
        };

        this.SendState();
    }

    private SendState(): void {
        const snapshot = this.GetState();
        for (const listener of this._listeners) {
            listener(snapshot);
        }
    }

    private CreateState(status: MobileUpdateStatus, errorMessage: string | null = null): IMobileUpdateState {
        const manifestUrl = this.GetManifestUrl(this._source);

        return {
            Status: status,
            Source: this._source,
            CurrentVersion: this._installedVersion,
            CurrentVersionCode: this._installedVersionCode,
            AvailableVersion: null,
            AvailableVersionCode: null,
            PublishedAt: null,
            Notes: null,
            Force: false,
            ManifestUrl: manifestUrl,
            ApkUrl: null,
            DownloadProgress: null,
            ErrorMessage: errorMessage,
            IsChecking: status === "checking",
            IsUpdateAvailable:
                status === "available" ||
                status === "downloading" ||
                status === "downloaded" ||
                status === "installing" ||
                status === "permission-required",
            IsDownloading: status === "downloading",
            IsDownloaded: status === "downloaded",
            IsInstalling: status === "installing",
            IsPermissionRequired: status === "permission-required",
        };
    }

    private GetManifestUrl(source: UpdateSource): string {
        if (source === "github") {
            return MOBILE_LATEST_MANIFEST_URL;
        }

        return `${MOBILE_MIRROR_PREFIX}${MOBILE_LATEST_MANIFEST_URL}`;
    }

    private ResolveApkUrl(apkUrl: string): string {
        if (this._source !== "mirror") {
            return apkUrl;
        }

        if (apkUrl.startsWith(MOBILE_MIRROR_PREFIX)) {
            return apkUrl;
        }

        if (apkUrl.startsWith("http://") || apkUrl.startsWith("https://")) {
            return `${MOBILE_MIRROR_PREFIX}${apkUrl}`;
        }

        const resolved = new URL(apkUrl, this.GetManifestUrl(this._source));
        return this.ApplyMirrorUrl(resolved.toString());
    }

    private ApplyMirrorUrl(url: string): string {
        if (url.startsWith(MOBILE_MIRROR_PREFIX)) {
            return url;
        }

        return `${MOBILE_MIRROR_PREFIX}${url}`;
    }

    private GetDownloadedFileUri(manifest: IMobileUpdateManifest | null = this._manifest): string | null {
        if (this._downloadedFileUri !== null) {
            return this._downloadedFileUri;
        }

        if (manifest === null) {
            return null;
        }

        return this.BuildDownloadedFileUri(manifest);
    }

    private BuildDownloadedFileUri(manifest: IMobileUpdateManifest): string {
        const cacheDirectory = FileSystem.cacheDirectory;
        if (cacheDirectory === null) {
            throw new Error("当前设备无法写入缓存目录");
        }

        return `${cacheDirectory}dickhelper-mobile-update-${manifest.versionCode}.apk`;
    }

    private async DownloadFile(fileUri: string, apkUrl: string, operationId: number): Promise<void> {
        const downloadResumable = FileSystem.createDownloadResumable(
            this.ResolveApkUrl(apkUrl),
            fileUri,
            {},
            (progress) => {
                if (operationId !== this._downloadOperationId) {
                    return;
                }

                if (progress.totalBytesExpectedToWrite <= 0) {
                    this.UpdateState({
                        Status: "downloading",
                    });
                    return;
                }

                const percent = Math.max(0, Math.min(100, Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100)));
                this.UpdateState({
                    Status: "downloading",
                    DownloadProgress: percent,
                });
            }
        );

        await downloadResumable.downloadAsync();
    }

    private async IsDownloadedFileValid(fileUri: string, expectedSha256: string): Promise<boolean> {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) {
            return false;
        }

        const bytes = await new ExpoFile(fileUri).bytes();
        const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
        const actualSha256 = this.ArrayBufferToHex(digest);
        return actualSha256.toLowerCase() === expectedSha256.toLowerCase();
    }

    private ArrayBufferToHex(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let result = "";

        for (const byte of bytes) {
            result += byte.toString(16).padStart(2, "0");
        }

        return result;
    }

    private async DeleteFileIfExists(fileUri: string | null): Promise<void> {
        if (fileUri === null) {
            return;
        }

        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) {
            return;
        }

        await FileSystem.deleteAsync(fileUri, {
            idempotent: true,
        });
    }

    private FormatError(error: unknown, suffix: string): string {
        if (error instanceof Error && error.message.trim().length > 0) {
            return `${error.message}。${suffix}`;
        }

        return `操作失败。${suffix}`;
    }

    private IsPermissionError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const message = error.message.toLowerCase();
        return message.includes("permission") || message.includes("unknown") || message.includes("install");
    }

    private ParseSource(source: string | null): UpdateSource {
        if (source === "github" || source === "mirror") {
            return source;
        }

        return DEFAULT_UPDATE_SOURCE;
    }

    private IsSupportedPlatform(): boolean {
        return Platform.OS === "android";
    }

    private GetInstalledVersionName(): string {
        return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0";
    }

    private GetInstalledVersionCode(): number {
        const fallbackVersionCode = Constants.expoConfig?.android?.versionCode;
        const rawVersionCode = Application.nativeBuildVersion ?? (fallbackVersionCode !== undefined && fallbackVersionCode !== null ? String(fallbackVersionCode) : "0");
        const parsedVersionCode = Number.parseInt(rawVersionCode, 10);

        if (Number.isNaN(parsedVersionCode)) {
            return 0;
        }

        return parsedVersionCode;
    }

    private IsRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }

    private IsString(value: unknown): value is string {
        return typeof value === "string";
    }

    private IsNumber(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value);
    }

    private IsBoolean(value: unknown): value is boolean {
        return typeof value === "boolean";
    }
}
