import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { consumePendingOfficeVisitorPhotoUri } from "@/lib/office-visitor-photo-handoff";
import { supabase } from "@/services/database";
import { resolveVisitorPhotoDisplayUri } from "@/services/storage/upload";

const formatDateTime = (value: string): string => {
  if (!value) {
    return "(not available)";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function decodePhotoParam(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

function initialsFromName(name: string): string {
  const parts = name
    .replace(/[()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default function VisitorInformationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const visitorName = (params.visitorName as string) || "(visitor not found)";
  const visitorIdParam = String(params.visitorId ?? "").trim();
  const passNumber = (params.passNumber as string) || "";
  const destinationOffice = (params.destinationOffice as string) || "(not available)";
  const expectedOffice = (params.expectedOffice as string) || "";
  const purposeReason = (params.purposeReason as string) || "(not provided)";
  const purposeLabel = (params.purposeLabel as string) || "Purpose of Visit";
  const scanTimeRaw = (params.scanTime as string) || (params.entryTime as string) || "";
  const entryTime = formatDateTime(scanTimeRaw);
  const controlNumber = (params.controlNumber as string) || "(not available)";
  const registeredBy = (params.registeredBy as string) || "(not available)";
  const destinationStatusLabel = (params.destinationStatusLabel as string) || "Wrong office destination";
  const enrolleeStatusLabel = (params.enrolleeStatusLabel as string) || "";
  const isCorrectDestination = (params.isCorrectDestination as string) === "true";
  const idLabel = passNumber || visitorIdParam || "";

  const visitIdParam = String(params.visitId ?? "").trim();
  const photoParamRaw = useMemo(
    () => decodePhotoParam(String(params.visitorPhotoUrl ?? "")),
    [params.visitorPhotoUrl],
  );
  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [photoLoading, setPhotoLoading] = useState(true);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhotoLoadFailed(false);
    setPhotoReady(false);
    setPhotoLoading(true);
    setProfilePhotoUri("");

    const finish = (uri: string) => {
      if (cancelled) return;
      setProfilePhotoUri(uri);
      setPhotoLoading(false);
      if (!uri) {
        setPhotoLoadFailed(true);
      }
    };

    void (async () => {
      try {
        let uri = "";

        // 0) In-memory handoff from office-scan (signed URL, not truncated)
        const handedOff = consumePendingOfficeVisitorPhotoUri();
        if (handedOff) {
          uri = handedOff;
        }

        // 1) Prefer DB lookup by numeric visitor_id
        const numericVisitorId = Number(visitorIdParam);
        if (!uri && Number.isFinite(numericVisitorId) && numericVisitorId > 0) {
          const { data: visitorRow, error } = await supabase
            .from("visitor")
            .select("visitor_photo_with_id_url")
            .eq("visitor_id", numericVisitorId)
            .maybeSingle();
          if (error && __DEV__) {
            console.warn("[VisitorInfo] visitor photo by id:", error.message);
          }
          uri =
            (await resolveVisitorPhotoDisplayUri(
              visitorRow?.visitor_photo_with_id_url,
            )) || "";
        }

        // 2) Route photo param (short relative path preferred)
        if (!uri && photoParamRaw) {
          uri = (await resolveVisitorPhotoDisplayUri(photoParamRaw)) || "";
        }

        // 3) visit → visitor (most reliable when visitorId param was wrong/missing)
        if (!uri && visitIdParam) {
          const vid = Number(visitIdParam);
          if (Number.isFinite(vid) && vid > 0) {
            const { data: visitRow, error: visitErr } = await supabase
              .from("visit")
              .select("visitor_id")
              .eq("visit_id", vid)
              .maybeSingle();
            if (visitErr && __DEV__) {
              console.warn("[VisitorInfo] visit lookup:", visitErr.message);
            }
            const linkedVisitorId = Number(visitRow?.visitor_id);
            if (Number.isFinite(linkedVisitorId) && linkedVisitorId > 0) {
              const { data: visitorRow } = await supabase
                .from("visitor")
                .select("visitor_photo_with_id_url")
                .eq("visitor_id", linkedVisitorId)
                .maybeSingle();
              uri =
                (await resolveVisitorPhotoDisplayUri(
                  visitorRow?.visitor_photo_with_id_url,
                )) || "";
            }
          }
        }

        if (__DEV__) {
          console.log("[VisitorInfo] photo resolve", {
            visitorIdParam,
            visitIdParam,
            photoParamPreview: photoParamRaw.slice(0, 80),
            resolved: uri ? uri.slice(0, 100) : "(none)",
          });
        }

        finish(uri);
      } catch (err) {
        if (__DEV__) console.warn("[VisitorInfo] photo load failed", err);
        finish("");
      }
    })();

    // Never leave the avatar stuck on a spinner
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setPhotoLoading(false);
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [photoParamRaw, visitIdParam, visitorIdParam]);

  const officeCardLabel = isCorrectDestination ? "DESTINATION OFFICE" : "EXPECTED OFFICE";
  const officeCardValue = isCorrectDestination
    ? destinationOffice
    : expectedOffice || destinationOffice || "(not available)";
  const scannedOfficeValue = (params.scanningOffice as string) || "";
  const showPhoto = Boolean(profilePhotoUri) && !photoLoadFailed;
  const avatarInitials = initialsFromName(visitorName);

  const handleDone = () => {
    router.replace("/office/office-portal");
  };

  const headerPaddingTop = insets.top + 14;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#064AA5" />

      <View style={styles.layout}>
        <View
          style={[
            styles.header,
            { paddingTop: headerPaddingTop },
            Platform.OS === "ios" ? styles.headerCurveIOS : null,
          ]}
        >
          <View style={styles.headerDecorDeep} />
          <View style={styles.headerDecorOne} />
          <View style={styles.headerDecorTwo} />

          <TouchableOpacity style={styles.backRow} activeOpacity={0.75} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            <Text style={styles.backText}>Back to Scanner</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Visitor Information</Text>
        </View>

        <ScrollView
          style={styles.scrollPanel}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            {/* Always keep initials so the circle never looks empty */}
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            </View>

            {showPhoto ? (
              <Image
                source={{ uri: profilePhotoUri }}
                style={[
                  styles.avatarImage,
                  !photoReady ? styles.avatarImageHidden : null,
                ]}
                resizeMode="cover"
                onLoad={() => setPhotoReady(true)}
                onError={() => {
                  setPhotoLoadFailed(true);
                  setPhotoReady(false);
                }}
              />
            ) : null}

            {photoLoading ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : null}
          </View>

          <View style={styles.profileTextBox}>
            <Text style={styles.visitorName} numberOfLines={2}>
              {visitorName}
            </Text>

            {idLabel ? (
              <View style={styles.visitorBadge}>
                <Ionicons name="id-card-outline" size={14} color="#FFFFFF" />
                <Text style={styles.visitorBadgeText}>{idLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="office-building" size={24} color="#064AA5" />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>{officeCardLabel}</Text>
            <Text style={styles.cardValue} numberOfLines={3}>
              {officeCardValue}
            </Text>

            {isCorrectDestination ? (
              <View style={styles.successChip}>
                <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                <Text style={styles.successText}>{destinationStatusLabel || "Correct destination"}</Text>
              </View>
            ) : (
              <View style={styles.warningChip}>
                <Ionicons name="warning" size={15} color="#EA580C" />
                <Text style={styles.warningText}>{destinationStatusLabel}</Text>
              </View>
            )}

            {isCorrectDestination && enrolleeStatusLabel ? (
              <View style={[styles.successChip, styles.successChipFollow]}>
                <Ionicons name="shield-checkmark" size={15} color="#15803D" />
                <Text style={styles.successText}>{enrolleeStatusLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!isCorrectDestination && scannedOfficeValue ? (
          <View style={styles.infoCard}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="qrcode-scan" size={24} color="#064AA5" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>SCANNED OFFICE</Text>
              <Text style={styles.cardValue} numberOfLines={3}>
                {scannedOfficeValue}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="target" size={24} color="#064AA5" />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>{purposeLabel.toUpperCase()}</Text>
            <Text style={styles.cardValue} numberOfLines={4}>
              {purposeReason}
            </Text>
          </View>
        </View>

        {isCorrectDestination ? (
          <View style={styles.infoCard}>
            <View style={styles.iconBox}>
              <Ionicons name="time-outline" size={24} color="#064AA5" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>TIME IN</Text>
              <Text style={styles.cardValue}>{entryTime}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.splitCard}>
          <View style={styles.splitItem}>
            <View style={styles.smallIconBox}>
              <Ionicons name="id-card-outline" size={20} color="#064AA5" />
            </View>

            <View style={styles.splitTextBox}>
              <Text style={styles.splitLabel}>CONTROL NUMBER</Text>
              <Text style={styles.splitValue}>{controlNumber}</Text>
            </View>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.splitItem}>
            <View style={styles.smallIconBox}>
              <Ionicons name="person-outline" size={20} color="#064AA5" />
            </View>

            <View style={styles.splitTextBox}>
              <Text style={styles.splitLabel}>REGISTERED BY</Text>
              <Text style={styles.splitValue}>{registeredBy}</Text>
            </View>
          </View>
        </View>

        {!isCorrectDestination ? (
          <View style={styles.actionCard}>
            <View style={styles.actionIconBox}>
              <Ionicons name="information" size={22} color="#FFFFFF" />
            </View>

            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>What to do:</Text>

              <Bullet text="Ask visitor to wait for security" />
              <Bullet text="Do not allow entry without verification" />
              <Bullet text="Provide directions to correct office if needed" />
            </View>
          </View>
        ) : null}

        <TouchableOpacity style={styles.doneButton} activeOpacity={0.85} onPress={handleDone}>
          <View style={styles.doneIconCircle}>
            <Ionicons name="checkmark" size={22} color="#064AA5" />
          </View>

          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const BLUE = "#064AA5";
const HEADER_BOTTOM_RADIUS = 38;
const TEXT_DARK = "#111827";
const ORANGE = "#EA580C";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  layout: {
    flex: 1,
    backgroundColor: BLUE,
  },

  scrollPanel: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  scrollContent: {
    paddingBottom: 22,
    flexGrow: 1,
  },

  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 18,
    paddingBottom: 30,
    borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
    borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
    overflow: "hidden",
    position: "relative",
  },

  headerCurveIOS: {
    borderCurve: "continuous",
  },

  headerDecorDeep: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(4, 60, 134, 0.38)",
    right: -72,
    bottom: -118,
    zIndex: 0,
  },

  headerDecorOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)",
    right: -48,
    bottom: -88,
    zIndex: 1,
  },

  headerDecorTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    right: 28,
    bottom: -52,
    zIndex: 1,
  },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },

  backText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 14,
    letterSpacing: -0.3,
    zIndex: 2,
  },

  profileCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: BLUE,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0B2E5E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
    overflow: "hidden",
  },

  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "#0B3A7A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
    position: "relative",
  },

  avatarImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },

  avatarImageHidden: {
    opacity: 0,
  },

  avatarFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B3A7A",
  },

  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 58, 122, 0.35)",
  },

  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  profileTextBox: {
    flex: 1,
    minWidth: 0,
  },

  visitorName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
  },

  visitorBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },

  visitorBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  infoCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#0B2E5E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E7EDF6",
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EAF1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },

  cardContent: {
    flex: 1,
    minWidth: 0,
  },

  cardLabel: {
    color: BLUE,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.85,
  },

  cardValue: {
    color: TEXT_DARK,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 22,
  },

  warningChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF1E8",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },

  warningText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },

  successChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },

  successChipFollow: {
    marginTop: 6,
  },

  successText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },

  splitCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0B2E5E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E7EDF6",
  },

  splitItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  smallIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EAF1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  splitTextBox: {
    flex: 1,
    minWidth: 0,
  },

  splitLabel: {
    color: BLUE,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.55,
  },

  splitValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 18,
  },

  verticalDivider: {
    width: 1,
    height: 52,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },

  actionCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDBA74",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },

  actionTextBox: {
    flex: 1,
    minWidth: 0,
  },

  actionTitle: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },

  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ORANGE,
    marginTop: 7,
    marginRight: 8,
  },

  bulletText: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },

  doneButton: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: BLUE,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },

  doneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
