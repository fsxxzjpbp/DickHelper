// 遥测上报请求体
export interface ITelemetryLaunchRequest {
    readonly uuid: string;
    readonly platform: "desktop" | "mobile";
    readonly app_version: string;
    readonly os: string;
}

// 遥测上报响应
export interface ITelemetryLaunchResponse {
    readonly success: boolean;
}
