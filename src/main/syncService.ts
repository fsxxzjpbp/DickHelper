import http from "node:http";
import os from "node:os";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ParseImportJson, ExportRecordsToJson } from "@dickhelper/core";
import type { IRecordRaw, ISyncResponse, ISyncStatus, IImportResult } from "@dickhelper/shared";
import type { DatabaseService } from "./database";

export class SyncService {
    private readonly _databaseService: DatabaseService;
    private _server: http.Server | null = null;
    private _port: number = 0;

    public constructor(databaseService: DatabaseService) {
        this._databaseService = databaseService;
    }

    public Start(port: number = 9527): void {
        if (this._server !== null) {
            return;
        }

        const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            this.HandleRequest(req, res);
        });

        server.listen(port, "0.0.0.0", () => {
            const addressInfo = server.address() as AddressInfo;
            this._port = addressInfo.port;
            console.log(`[SyncService] Server started on port ${this._port}`);
        });

        server.on("error", (error: NodeJS.ErrnoException) => {
            console.error("[SyncService] Server error:", error.message);
            this._server = null;
            this._port = 0;
        });

        this._server = server;
        this._port = port;
    }

    public Stop(): void {
        if (this._server === null) {
            return;
        }

        this._server.close(() => {
            console.log("[SyncService] Server stopped");
        });

        this._server = null;
        this._port = 0;
    }

    public GetStatus(): ISyncStatus {
        return {
            Running: this._server !== null,
            Port: this._port,
            Addresses: SyncService.GetLanAddresses(),
        };
    }

    private HandleRequest(req: IncomingMessage, res: ServerResponse): void {
        if (req.method !== "POST" || req.url !== "/api/sync") {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not Found" }));
            return;
        }

        let body = "";

        req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
        });

        req.on("end", () => {
            this.HandleSyncRequest(body, res);
        });

        req.on("error", (error: Error) => {
            console.error("[SyncService] Request error:", error.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal Server Error" }));
        });
    }

    private HandleSyncRequest(body: string, res: ServerResponse): void {
        try {
            const parsed = JSON.parse(body) as { records?: unknown };

            if (typeof parsed.records !== "string") {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request: records must be a JSON string" }));
                return;
            }

            const importResult = this.ImportMobileRecords(parsed.records);
            const desktopRecords = this.GetDesktopRecordsAsJson();
            const syncResponse: ISyncResponse = {
                result: importResult,
                records: desktopRecords,
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(syncResponse));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[SyncService] Sync error:", message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Sync failed" }));
        }
    }

    private ImportMobileRecords(jsonText: string): IImportResult {
        const parsed = ParseImportJson(jsonText);

        if (parsed === null) {
            return { Imported: 0, Skipped: 0, Rejected: 0 };
        }

        const result = this._databaseService.ImportRecords(parsed.Records);

        return {
            Imported: result.Imported,
            Skipped: result.Skipped + parsed.DuplicateIds,
            Rejected: result.Rejected + parsed.Rejected,
        };
    }

    private GetDesktopRecordsAsJson(): string {
        const rawRecords = this._databaseService.GetRecords();
        const records: IRecordRaw[] = rawRecords.map((r) => ({
            Id: r.Id,
            StartTime: r.StartTime,
            EndTime: r.EndTime,
            Duration: r.Duration,
            Notes: r.Notes ?? undefined,
        }));
        return ExportRecordsToJson(records);
    }

    private static GetLanAddresses(): string[] {
        const interfaces = os.networkInterfaces();
        const addresses: string[] = [];

        for (const name of Object.keys(interfaces)) {
            const netInterfaces = interfaces[name];
            if (netInterfaces === undefined) {
                continue;
            }

            for (const net of netInterfaces) {
                if (net.family === "IPv4" && !net.internal) {
                    addresses.push(net.address);
                }
            }
        }

        return addresses;
    }
}
