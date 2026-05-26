import { View, StyleSheet } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import { useRouter } from "expo-router";

export default function AiSettingsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Surface style={styles.surface} elevation={1}>
                <Text variant="headlineSmall" style={styles.title}>
                    AI 配置
                </Text>
                <Text variant="bodyMedium" style={styles.body}>
                    第一阶段只保留入口占位，不提供完整表单、同步或远程分析配置。
                </Text>
                <Button mode="contained-tonal" onPress={() => router.back()} style={styles.button}>
                    返回设置
                </Button>
            </Surface>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        justifyContent: "center",
    },
    surface: {
        borderRadius: 12,
        backgroundColor: "#ffffff",
        padding: 20,
        gap: 12,
    },
    title: {
        color: "#0f766e",
        fontWeight: "700",
    },
    body: {
        color: "#334155",
        lineHeight: 22,
    },
    button: {
        alignSelf: "flex-start",
    },
});
