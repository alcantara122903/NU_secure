import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { authSessionService } from "@/services/auth-session";
import { supabase } from "@/services/database";
import { processOfficeCheckInScan } from "@/services/office-checkin-scan";

type Phase = "loading_office" | "ready" | "processing" | "error";

const BLUE = "#064AA5";
const TEXT_DARK = "#111827";
const TEXT_MUTED = "#6B7280";

export default function OfficeCheckInScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("loading_office");
  const [officeData, setOfficeData] = useState<{ office_id: number; office_name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRaw, setManualRaw] = useState("");
  const isProcessingRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  const loadOfficeData = useCallback(async () => {
    try {
      const userId = authSessionService.getCurrentUserId();
      if (!userId) {
        setErrorMessage("Not signed in. Please log in again.");
        setPhase("error");
        return;
      }

      const { data, error } = await supabase
        .from("office_staff")
        .select("office_id, office:office_id(office_id, office_name)")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data?.office_id) {
        setErrorMessage("Your account is not linked to an office.");
        setPhase("error");
        return;
      }

      const embedded = data.office;
      const officeRow = Array.isArray(embedded) ? embedded[0] : embedded;
      const office = officeRow as { office_id?: number; office_name?: string } | null;

      setOfficeData({
        office_id: Number(data.office_id),
        office_name: office?.office_name || "Admissions Office",
      });
      setPhase("ready");
    } catch (error) {
      console.error("[OfficeScan] loadOfficeData", error);
      setErrorMessage("Failed to load office information.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void loadOfficeData();
  }, [loadOfficeData]);

  useFocusEffect(
    useCallback(() => {
      hasNavigatedRef.current = false;
      if (officeData) {
        setPhase("ready");
      }
      return undefined;
    }, [officeData]),
  );

  const runScan = async (rawQrValue: string) => {
    if (!rawQrValue?.trim() || isProcessingRef.current || hasNavigatedRef.current || !officeData) {
      return;
    }

    const userId = authSessionService.getCurrentUserId();
    if (!userId) {
      setErrorMessage("Session expired. Please log in again.");
      setPhase("error");
      return;
    }

    isProcessingRef.current = true;
    setPhase("processing");
    setErrorMessage("");

    try {
      const result = await processOfficeCheckInScan({
        rawQrValue: rawQrValue.trim(),
        scanningOfficeId: officeData.office_id,
        scannedByUserId: userId,
      });

      if (!result.success || !result.visitId) {
        setErrorMessage(result.message || "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }

      router.push({
        pathname: "/office/visitor-info",
        params: {
          visitId: String(result.visitId),
          visitorId: result.passNumber || "",
          visitorName: result.visitorName || "(visitor not found)",
          passNumber: result.passNumber || "",
          controlNumber: result.controlNumber || "",
          destinationOffice: result.destinationOffice || result.scanningOfficeName || "",
          expectedOffice: result.expectedOfficeName || "",
          purposeReason: result.purposeReason || "",
          purposeLabel: result.purposeLabel || "Purpose of Visit",
          entryTime: result.entryTime || "",
          scanTime: result.scanTime || "",
          registeredBy: result.registeredBy || "",
          isCorrectDestination: result.isCorrectDestination ? "true" : "false",
          destinationStatusLabel: result.destinationStatusLabel || "",
          enrolleeStatusLabel: result.enrolleeStatusLabel || "",
        },
      });

      hasNavigatedRef.current = true;
    } catch (error) {
      console.error("[OfficeScan] runScan", error);
      setErrorMessage("Something went wrong. Please try again.");
      setPhase("error");
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (phase !== "ready" || isProcessingRef.current || hasNavigatedRef.current) {
      return;
    }
    void runScan(data);
  };

  const handleManualSubmit = () => {
    if (!manualRaw.trim()) {
      return;
    }
    void runScan(manualRaw);
  };

  const resetScan = () => {
    hasNavigatedRef.current = false;
    setErrorMessage("");
    setManualRaw("");
    if (officeData) {
      setPhase("ready");
    } else {
      setPhase("loading_office");
      void loadOfficeData();
    }
  };

  const cameraPermissionGranted = permission?.granted;
  const isLoadingOffice = phase === "loading_office";
  const officeName = officeData?.office_name || "Admissions Office";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Office check-in</Text>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCircleOne} />
          <View style={styles.headerCircleTwo} />
        </View>

        <View style={styles.contentWrapper}>
          <TouchableOpacity style={styles.officeCard} activeOpacity={0.85}>
            <View style={styles.officeIconBox}>
              <MaterialCommunityIcons name="office-building" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.officeName}>{officeName}</Text>
            <Ionicons name="chevron-forward" size={24} color={BLUE} />
          </TouchableOpacity>

          <View style={styles.scannerCard}>
            <View style={styles.cameraPreview}>
              {cameraPermissionGranted ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={phase === "ready" ? handleBarcodeScanned : undefined}
                />
              ) : (
                <View style={styles.cameraPermissionBox}>
                  <Ionicons name="camera-outline" size={46} color="#FFFFFF" />
                  <Text style={styles.permissionTitle}>Camera permission needed</Text>
                  <Text style={styles.permissionSubtitle}>Allow camera access to scan visitor QR tickets.</Text>
                  <TouchableOpacity style={styles.permissionButton} activeOpacity={0.85} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Allow Camera</Text>
                  </TouchableOpacity>
                </View>
              )}

              {cameraPermissionGranted && <View style={styles.cameraOverlay} />}

              <View style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.cornerTopLeft]} />
                <View style={[styles.scanCorner, styles.cornerTopRight]} />
                <View style={[styles.scanCorner, styles.cornerBottomLeft]} />
                <View style={[styles.scanCorner, styles.cornerBottomRight]} />
              </View>

              <View style={styles.scanHelperPill}>
                <View style={styles.scanIconBox}>
                  {isLoadingOffice || phase === "processing" ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="scan-outline" size={19} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.scanHelperText}>
                  {isLoadingOffice
                    ? "Loading office data..."
                    : phase === "processing"
                      ? "QR detected. Processing..."
                      : phase === "error"
                        ? errorMessage || "Scan failed. Please try again."
                        : "Align QR code within the frame"}
                </Text>
              </View>
            </View>
          </View>

          {phase === "error" ? (
            <TouchableOpacity style={styles.rescanButton} activeOpacity={0.85} onPress={resetScan}>
              <Ionicons name="refresh-outline" size={22} color={BLUE} />
              <Text style={styles.rescanButtonText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <Ionicons name="information" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.infoTextBox}>
              <Text style={styles.infoTitle}>Point the camera at the visitor ticket QR.</Text>
              <Text style={styles.infoSubtitle}>The next expected office on their route must match this office.</Text>
            </View>
          </View>

          {!showManualEntry ? (
            <TouchableOpacity style={styles.manualButton} activeOpacity={0.85} onPress={() => setShowManualEntry(true)}>
              <View style={styles.manualIconBox}>
                <Ionicons name="keypad" size={22} color={BLUE} />
              </View>
              <Text style={styles.manualButtonText}>Enter QR payload manually</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.manualEntryCard}>
              <Text style={styles.manualEntryTitle}>Raw QR contents</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="Paste JSON or token"
                placeholderTextColor={TEXT_MUTED}
                value={manualRaw}
                onChangeText={setManualRaw}
                multiline
                editable={phase === "ready"}
              />
              <TouchableOpacity
                style={[styles.permissionButton, { opacity: phase === "ready" ? 1 : 0.6, alignSelf: "stretch" }]}
                activeOpacity={0.85}
                onPress={handleManualSubmit}
                disabled={phase !== "ready"}
              >
                <Text style={styles.permissionButtonText}>Validate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualCancelButton} activeOpacity={0.85} onPress={() => setShowManualEntry(false)}>
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F7FB" },
  container: { flex: 1, backgroundColor: "#F4F7FB" },
  scrollContent: { paddingBottom: 24 },
  header: {
    height: 104,
    backgroundColor: BLUE,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) / 2 : 0,
    position: "relative",
    overflow: "hidden",
  },
  headerBackButton: { width: 36, height: 36, justifyContent: "center", alignItems: "center", zIndex: 2 },
  headerTitle: { flex: 1, textAlign: "center", color: "#FFFFFF", fontSize: 18, fontWeight: "800", letterSpacing: 0.2, zIndex: 2 },
  headerSpacer: { width: 36, zIndex: 2 },
  headerCircleOne: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", right: -55, top: -65 },
  headerCircleTwo: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.04)", right: 20, top: -45 },
  contentWrapper: { backgroundColor: "#F4F7FB", marginTop: -2, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  officeCard: {
    marginHorizontal: 14, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E1E7F0",
    shadowColor: "#0B2E5E", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  officeIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: BLUE, justifyContent: "center", alignItems: "center", marginRight: 10 },
  officeName: { flex: 1, fontSize: 16, fontWeight: "800", color: TEXT_DARK },
  scannerCard: {
    marginHorizontal: 14, marginTop: 14, borderRadius: 16, backgroundColor: "#FFFFFF",
    shadowColor: "#0B2E5E", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5,
  },
  cameraPreview: { height: 320, borderRadius: 16, overflow: "hidden", backgroundColor: "#111827", justifyContent: "center", alignItems: "center", position: "relative" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)", zIndex: 1 },
  cameraPermissionBox: { flex: 1, width: "100%", backgroundColor: "#111827", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  permissionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginTop: 12, textAlign: "center" },
  permissionSubtitle: { color: "#D1D5DB", fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 18, marginTop: 8 },
  permissionButton: { marginTop: 14, backgroundColor: BLUE, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  permissionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  scanFrame: { width: "72%", height: 200, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.72)", position: "relative", justifyContent: "center", alignItems: "center", zIndex: 2 },
  scanCorner: { position: "absolute", width: 28, height: 28, borderColor: "#FFFFFF" },
  cornerTopLeft: { top: 12, left: 12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTopRight: { top: 12, right: 12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBottomLeft: { bottom: 12, left: 12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBottomRight: { bottom: 12, right: 12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  scanHelperPill: { position: "absolute", bottom: 16, left: 12, right: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.58)", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20, zIndex: 3 },
  scanIconBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: BLUE, justifyContent: "center", alignItems: "center", marginRight: 8 },
  scanHelperText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", flex: 1 },
  rescanButton: { alignSelf: "center", marginTop: 12, flexDirection: "row", alignItems: "center", backgroundColor: "#EAF1FF", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, gap: 6 },
  rescanButtonText: { color: BLUE, fontSize: 13, fontWeight: "800" },
  infoCard: {
    marginHorizontal: 14, marginTop: 14, backgroundColor: "#F8FBFF", borderRadius: 14, padding: 12, flexDirection: "row",
    alignItems: "center", borderWidth: 1, borderColor: "#CFE1FF", shadowColor: "#0B2E5E", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  infoIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE, justifyContent: "center", alignItems: "center", marginRight: 10 },
  infoTextBox: { flex: 1 },
  infoTitle: { fontSize: 14, color: TEXT_DARK, fontWeight: "800", lineHeight: 19 },
  infoSubtitle: { fontSize: 12, color: TEXT_MUTED, fontWeight: "600", lineHeight: 17, marginTop: 2 },
  manualButton: {
    marginHorizontal: 14, marginTop: 14, minHeight: 52, borderRadius: 12, borderWidth: 2, borderColor: BLUE, backgroundColor: "#FFFFFF",
    flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: "#0B2E5E", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  manualIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#EAF1FF", justifyContent: "center", alignItems: "center", marginRight: 8 },
  manualButtonText: { fontSize: 14, color: BLUE, fontWeight: "800" },
  manualEntryCard: { marginHorizontal: 14, marginTop: 14, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#DBE4F0", padding: 12 },
  manualEntryTitle: { color: TEXT_DARK, fontWeight: "700", fontSize: 13, marginBottom: 8 },
  manualInput: { borderWidth: 1, borderColor: "#DBE4F0", borderRadius: 10, padding: 10, minHeight: 80, textAlignVertical: "top", color: TEXT_DARK },
  manualCancelButton: { marginTop: 10, alignItems: "center", paddingVertical: 6 },
  manualCancelText: { color: TEXT_MUTED, fontSize: 12, fontWeight: "600" },
});

