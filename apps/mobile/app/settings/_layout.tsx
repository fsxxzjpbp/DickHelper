import { Stack } from "expo-router";
import { appTheme } from "../../src/theme";

export default function SettingsLayout() {
    return (
        <Stack
            screenOptions={{
                headerTitleAlign: "center",
                headerShadowVisible: false,
                headerStyle: {
                    backgroundColor: appTheme.colors.background,
                },
                contentStyle: {
                    backgroundColor: appTheme.colors.background,
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: "设置" }} />
            <Stack.Screen name="ai" options={{ title: "AI 配置" }} />
        </Stack>
    );
}
