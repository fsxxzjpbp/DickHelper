import { MD3LightTheme, type MD3Theme } from "react-native-paper";

export const appTheme: MD3Theme = {
    ...MD3LightTheme,
    roundness: 6,
    colors: {
        ...MD3LightTheme.colors,
        primary: "#0f766e",
        secondary: "#2563eb",
        tertiary: "#d97706",
        background: "#f8fafc",
        surface: "#ffffff",
        surfaceVariant: "#e2e8f0",
        onSurfaceVariant: "#475569",
        outline: "#cbd5e1",
        error: "#dc2626",
    },
};

