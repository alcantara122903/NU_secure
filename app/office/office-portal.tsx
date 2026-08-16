import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth-context";
import {
  loadOfficePortalStats,
  type OfficePortalStats,
} from "@/services/office-portal-stats";

export default function AdmissionsDashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<OfficePortalStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStats = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true;
    if (soft) {
      setRefreshing(true);
    } else {
      setLoadingStats(true);
    }
    try {
      const next = await loadOfficePortalStats();
      setStats(next);
    } catch (e) {
      console.warn("[OfficePortal] failed to load stats", e);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshStats();
    }, [refreshStats]),
  );

  const officeName = stats?.officeName ?? "Office";
  const staffName = stats?.staffName ?? "Office Staff";
  const staffRole = stats?.staffRole ?? "Office Staff";
  const todayVisitors = stats?.todayVisitors ?? 0;
  const pendingScans = stats?.pendingScans ?? 0;
  const expectedVisitors = stats?.expectedVisitors ?? 0;

  const handleScanQr = () => {
    router.push("/office/office-scan");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          void logout().finally(() => {
            router.replace("/(tabs)");
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0646A0" />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshStats({ soft: true })}
            tintColor="#064AA5"
            colors={["#064AA5"]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.officeIconBox}>
              <MaterialCommunityIcons name="office-building" size={34} color="#FFD21E" />
            </View>

            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>{officeName}</Text>
              <Text style={styles.headerSubtitle}>Office Portal</Text>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.8}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={26} color="#FFFFFF" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, styles.profileCard]}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-outline" size={38} color="#064AA5" />
          </View>

          <View>
            <Text style={styles.profileName}>{staffName}</Text>
            <Text style={styles.profileRole}>{staffRole}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.scannerCard]}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            <MaterialCommunityIcons name="qrcode-scan" size={86} color="#064AA5" />

            <Text style={styles.scanTitle}>Ready to Scan</Text>
            <Text style={styles.scanSubtitle}>Position QR code in frame</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          activeOpacity={0.85}
          onPress={handleScanQr}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>Tap to Scan QR Code</Text>
        </TouchableOpacity>

        <View style={[styles.card, styles.tipsCard]}>
          <View style={styles.tipsHeader}>
            <View style={styles.tipsIconCircle}>
              <Ionicons name="bulb-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.tipsTitle}>Quick Tips</Text>
          </View>

          <View style={styles.divider} />

          <TipItem text="Ask visitor to show their QR ticket" />
          <TipItem text="Ensure QR code is clearly visible" />
          <TipItem text="Hold device steady during scan" />
          <TipItem text="Audio feedback sounds once verified" />
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.greenBorder]}>
            <View style={styles.statIconGreen}>
              <FontAwesome5 name="users" size={24} color="#1FA855" />
            </View>

            <View style={styles.statTextCol}>
              <Text style={styles.statLabel}>Today&apos;s Visitors</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color="#1FA855" style={{ marginTop: 6 }} />
              ) : (
                <Text style={[styles.statValue, styles.greenText]}>{todayVisitors}</Text>
              )}
            </View>
          </View>

          <View style={[styles.statCard, styles.orangeBorder]}>
            <View style={styles.statIconOrange}>
              <MaterialCommunityIcons name="clipboard-clock-outline" size={30} color="#F2A100" />
            </View>

            <View style={styles.statTextCol}>
              <Text style={styles.statLabel}>Pending Scans</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color="#F2A100" style={{ marginTop: 6 }} />
              ) : (
                <Text style={[styles.statValue, styles.orangeText]}>{pendingScans}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.expectedCard]}>
          <View style={styles.calendarIconCircle}>
            <Ionicons name="calendar-outline" size={34} color="#064AA5" />
          </View>

          <View style={styles.expectedTextBox}>
            <Text style={styles.expectedTitle}>Expected Visitors</Text>
            {loadingStats ? (
              <ActivityIndicator size="small" color="#064AA5" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.expectedNumber}>{expectedVisitors}</Text>
            )}
            <Text style={styles.expectedSubtitle}>still expected at this office</Text>
          </View>

          <View style={styles.peopleDecor}>
            <FontAwesome5 name="user-friends" size={36} color="#D7E4FF" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TipItem({ text }: { text: string }) {
  return (
    <View style={styles.tipItem}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  scrollContent: {
    paddingBottom: 24,
  },

  header: {
    backgroundColor: "#0646A0",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 18 : 26,
    paddingBottom: 48,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  officeIconBox: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  headerTextBox: {
    flex: 1,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    color: "#DCE8FF",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 7,
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: "#0B2E5E",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 5,
  },

  profileCard: {
    marginTop: -32,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EAF1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  profileRole: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 5,
  },

  scannerCard: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  scanFrame: {
    width: "80%",
    minHeight: 160,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#B8CDF7",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#FCFDFF",
  },

  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: "#064AA5",
  },

  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },

  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },

  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },

  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },

  scanTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },

  scanSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  scanButton: {
    marginHorizontal: 16,
    marginTop: 14,
    height: 50,
    backgroundColor: "#064AA5",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 13,
    shadowColor: "#064AA5",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },

  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  tipsCard: {
    marginTop: 18,
    padding: 14,
  },

  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  tipsIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#064AA5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  tipsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5EAF2",
    marginVertical: 12,
  },

  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#064AA5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    lineHeight: 20,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },

  statCard: {
    flex: 1,
    minHeight: 84,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0B2E5E",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  greenBorder: {
    borderLeftWidth: 5,
    borderLeftColor: "#28B463",
  },

  orangeBorder: {
    borderLeftWidth: 5,
    borderLeftColor: "#F2A100",
  },

  statIconGreen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F7EF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  statIconOrange: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF4D9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  statLabel: {
    fontSize: 11.5,
    color: "#4B5563",
    fontWeight: "700",
  },

  statTextCol: {
    flex: 1,
  },

  statValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  greenText: {
    color: "#1FA855",
  },

  orangeText: {
    color: "#F2A100",
  },

  expectedCard: {
    marginTop: 16,
    padding: 14,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
  },

  calendarIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EAF1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  expectedTextBox: {
    flex: 1,
    alignItems: "center",
  },

  expectedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    alignSelf: "flex-start",
  },

  expectedNumber: {
    fontSize: 30,
    fontWeight: "900",
    color: "#064AA5",
    marginTop: 4,
  },

  expectedSubtitle: {
    fontSize: 11.5,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: -4,
  },

  peopleDecor: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
