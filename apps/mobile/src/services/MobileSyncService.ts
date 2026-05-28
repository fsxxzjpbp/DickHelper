import type { IImportResult, ISyncResponse } from "@dickhelper/shared";
import type { MobileDatabaseService } from "./MobileDatabaseService";

export async function SyncWithDesktop(
    address: string,
    port: number,
    database: MobileDatabaseService
): Promise<IImportResult> {
    const localRecords = await database.ExportToJson();
    const url = `http://${address}:${port}/api/sync`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: localRecords }),
    });

    if (!response.ok) {
        throw new Error(`同步请求失败：HTTP ${response.status}`);
    }

    const syncResponse = (await response.json()) as ISyncResponse;

    const desktopImportResult = await database.ImportFromJson(syncResponse.records);

    return {
        Imported: syncResponse.result.Imported + desktopImportResult.Imported,
        Skipped: syncResponse.result.Skipped + desktopImportResult.Skipped,
        Rejected: syncResponse.result.Rejected + desktopImportResult.Rejected,
    };
}
