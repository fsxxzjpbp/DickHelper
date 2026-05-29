import type { IRecord } from "@dickhelper/shared";

// Get date string in UTC+8 (YYYY-MM-DD).
export function getDateInUTC8(date: Date): string {
    const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const year = utc8.getUTCFullYear();
    const month = String(utc8.getUTCMonth() + 1).padStart(2, "0");
    const day = String(utc8.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Get current ISO week string in UTC+8 (YYYY-Www). Monday is the first day.
export function getCurrentWeekUTC8(): string {
    const now = new Date();
    const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return getWeekString(utc8);
}

// Convert a Date (already in UTC+8 context) to ISO week string.
function getWeekString(utc8Date: Date): string {
    // Get the date components in UTC (since we already shifted to UTC+8)
    const year = utc8Date.getUTCFullYear();
    const month = utc8Date.getUTCMonth();
    const day = utc8Date.getUTCDate();

    // Create a date at noon to avoid DST issues
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

    // ISO week calculation
    // Set to nearest Thursday (current date + 4 - current day number, make Sunday = 7)
    const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);

    // January 1st of the year containing the Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

    // Calculate week number
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    const weekYear = d.getUTCFullYear();
    return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

// Get Monday-Sunday date range for a given ISO week string (YYYY-MM-DD in UTC+8).
export function getWeekDates(week: string): { monday: string; sunday: string } {
    // Parse "YYYY-Www"
    const match = /^(\d{4})-W(\d{2})$/.exec(week);
    if (match === null) {
        throw new Error(`Invalid week format: ${week}`);
    }

    const weekYearStr = match[1];
    const weekNumStr = match[2];
    if (weekYearStr === undefined || weekNumStr === undefined) {
        throw new Error(`Invalid week format: ${week}`);
    }
    const weekYear = parseInt(weekYearStr, 10);
    const weekNum = parseInt(weekNumStr, 10);

    // Find January 4th of the given year (always in ISO week 1)
    const jan4 = new Date(Date.UTC(weekYear, 0, 4, 12, 0, 0));

    // Find Monday of week 1
    const dayNum = jan4.getUTCDay() || 7; // Make Sunday = 7
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayNum + 1);

    // Monday of the target week
    const monday = new Date(mondayOfWeek1);
    monday.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNum - 1) * 7);

    // Sunday of the target week
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const formatDate = (d: Date): string => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    return { monday: formatDate(monday), sunday: formatDate(sunday) };
}

// Aggregate daily stats from records for a given UTC+8 date string.
export function aggregateDailyStats(records: IRecord[], date: string): { count: number; duration: number } {
    let count = 0;
    let duration = 0;

    for (const record of records) {
        const recordDate = getDateInUTC8(record.EndTime);
        if (recordDate === date) {
            count++;
            duration += record.Duration;
        }
    }

    return { count, duration };
}

// Aggregate all records into daily stats grouped by UTC+8 date.
export function aggregateAllDailyStats(records: IRecord[]): Map<string, { count: number; duration: number }> {
    const grouped = new Map<string, { count: number; duration: number }>();

    for (const record of records) {
        const date = getDateInUTC8(record.EndTime);
        const existing = grouped.get(date);
        if (existing) {
            existing.count++;
            existing.duration += record.Duration;
        } else {
            grouped.set(date, { count: 1, duration: record.Duration });
        }
    }

    return grouped;
}
