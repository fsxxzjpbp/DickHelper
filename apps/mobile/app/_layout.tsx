import { Suspense } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { Stack } from "expo-router";
import { PaperProvider, Text } from "react-native-paper";
import { appTheme } from "../src/theme";
import { InitializeDatabase } from "../src/services/MobileDatabaseService";
import { useMobileUpdateState } from "../src/hooks/useMobileUpdateState";

function AppLoadingScreen() {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appTheme.colors.primary} />
            <Text variant="bodyMedium" style={styles.loadingText}>
                正在准备数据库
            </Text>
        </View>
    );
}

function MobileUpdateBootstrap() {
    useMobileUpdateState({
        autoCheckOnMount: true,
    });

    return null;
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <PaperProvider theme={appTheme}>
                    <StatusBar style="dark" />
                    <Suspense fallback={<AppLoadingScreen />}>
                        <SQLiteProvider databaseName="dickhelper.db" onInit={InitializeDatabase} useSuspense>
                            <MobileUpdateBootstrap />
                            <Stack
                                screenOptions={{
                                    contentStyle: {
                                        backgroundColor: appTheme.colors.background,
                                    },
                                }}
                            >
                                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                <Stack.Screen name="settings" options={{ headerShown: false }} />
                            </Stack>
                        </SQLiteProvider>
                    </Suspense>
                </PaperProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: appTheme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: appTheme.colors.background,
    },
    loadingText: {
        color: appTheme.colors.onSurfaceVariant,
    },
});
