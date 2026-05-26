export function FormatElapsedSeconds(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}时${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`;
    }

    if (minutes > 0) {
        return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
    }

    return `${seconds}秒`;
}

export function FormatDurationMinutes(durationMinutes: number): string {
    return FormatElapsedSeconds(Math.round(durationMinutes * 60));
}

export function FormatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function FormatRelativeDays(daySpan: number): string {
    if (daySpan <= 0) {
        return "今天";
    }

    if (daySpan < 1) {
        const hours = Math.max(1, Math.round(daySpan * 24));
        return `${hours}小时`;
    }

    if (daySpan < 30) {
        return `${daySpan.toFixed(1)}天`;
    }

    return `${Math.round(daySpan)}天`;
}
