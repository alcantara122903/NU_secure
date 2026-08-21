import {
    ArrowLeft,
    Building2,
    Check,
    ChevronRight,
    ClipboardList,
    Download,
    IdCard,
    Info,
    MapPin,
    Printer,
    Shield,
    Target,
    User,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

export type EnhancedQrRouteOffice = {
  id: number;
  /** Office / destination name shown as primary line */
  name: string;
  /** Enrollee step description shown under the office name */
  stepName?: string;
  /** Optional progress status for resume tickets */
  status?: "done" | "current" | "pending";
  stepOrder?: number;
};

export type EnhancedQrTicketViewProps = {
  fullName: string;
  passNumber: string;
  controlNumber: string;
  purpose: string;
  destination: string;
  visitorTypeLabel: string;
  photoUri?: string | null;
  visitRoute: EnhancedQrRouteOffice[];
  /** Encoded QR value (payload JSON or token) */
  qrValue: string;
  onBack: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onCompleteReturn: () => void;
  isDownloading?: boolean;
  isPrinting?: boolean;
};

function HeaderPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 210"
      preserveAspectRatio="none"
    >
      <Path
        d="M-40 150 C50 95, 140 215, 270 135 C340 92, 395 102, 470 52"
        stroke="rgba(142,209,230,0.16)"
        strokeWidth="1.5"
        fill="none"
      />
      <Path
        d="M-20 32 L55 -15 L132 32 L132 88 L-20 88 Z"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="2"
        fill="none"
      />
      <Path
        d="M310 35
           C340 30, 360 18, 376 3
           C392 18, 412 30, 442 35
           L442 86
           C442 126, 408 152, 376 165
           C344 152, 310 126, 310 86
           Z"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
        fill="none"
      />
      <Circle cx="376" cy="82" r="25" fill="rgba(255,255,255,0.045)" />
    </Svg>
  );
}

function ProfileInfoItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.profileInfoItem}>
      <View style={styles.profileIconBox}>{icon}</View>
      <View style={styles.profileTextWrapper}>
        <Text style={styles.profileLabel}>{label}</Text>
        <Text
          style={[
            styles.profileValue,
            highlight && styles.profileValueHighlight,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export function EnhancedQrTicketView({
  fullName,
  passNumber,
  controlNumber,
  purpose,
  destination,
  visitorTypeLabel,
  photoUri,
  visitRoute,
  qrValue,
  onBack,
  onDownload,
  onPrint,
  onCompleteReturn,
  isDownloading = false,
  isPrinting = false,
}: EnhancedQrTicketViewProps) {
  const insets = useSafeAreaInsets();
  const isEnrollee = visitorTypeLabel === 'Enrollee';
  const qrSize = useMemo(() => {
    const w = Dimensions.get('window').width;
    // URL QR needs more pixels so phone cameras can open the progress website
    return isEnrollee
      ? Math.min(168, Math.max(140, Math.round(w * 0.38)))
      : Math.min(124, Math.max(100, Math.round(w * 0.3)));
  }, [isEnrollee]);

  const progressUrlHint = isEnrollee && /^https?:\/\//i.test(qrValue) ? qrValue : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

      <View style={styles.layout}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <HeaderPattern />

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backButton}
            onPress={onBack}
          >
            <ArrowLeft size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>QR Ticket</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          removeClippedSubviews={false}
        >
        <View style={styles.floatingSheet}>
          <View style={styles.successBanner}>
            <View style={styles.successIconCluster}>
              <View style={styles.successRippleOuter} />
              <View style={styles.successRippleInner} />
              <View style={styles.successIconRing}>
                <View style={styles.successIconInner}>
                  <Check size={22} color="#FFFFFF" strokeWidth={2.8} />
                </View>
              </View>
            </View>

            <View style={styles.successTextWrapper}>
              <Text style={styles.successTitle}>
                Visitor Registered Successfully
              </Text>
              <View style={styles.visitorBadge}>
                <Text style={styles.visitorBadgeText}>{visitorTypeLabel}</Text>
              </View>
            </View>

            <View style={styles.faintShield}>
              <Shield size={30} color="#10B981" strokeWidth={1.8} />
            </View>
          </View>

          <View style={styles.ticketCard}>
            <View style={styles.ticketMainRow}>
              <View style={styles.profileColumn}>
                <View style={styles.photoFrame}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.visitorPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <User size={28} color="#0648A8" strokeWidth={2} />
                    </View>
                  )}
                </View>

                <ProfileInfoItem
                  icon={<User size={15} color="#0648A8" fill="#0648A8" />}
                  label="Full Name"
                  value={fullName}
                />

                <View style={styles.infoDivider} />

                <ProfileInfoItem
                  icon={<IdCard size={15} color="#0648A8" strokeWidth={2} />}
                  label="ID Pass Number"
                  value={passNumber}
                />

                <View style={styles.infoDivider} />

                <ProfileInfoItem
                  icon={
                    <ClipboardList size={15} color="#0648A8" strokeWidth={2} />
                  }
                  label="Control Number"
                  value={controlNumber}
                  highlight
                />
              </View>

              <View style={styles.qrColumn}>
                <Text style={styles.qrInstruction}>Present this QR code</Text>

                <View
                  style={[
                    styles.qrBox,
                    { width: qrSize + 20, height: qrSize + 20 },
                  ]}
                >
                  <View style={[styles.qrCorner, styles.qrCornerTopLeft]} />
                  <View style={[styles.qrCorner, styles.qrCornerTopRight]} />
                  <View style={[styles.qrCorner, styles.qrCornerBottomLeft]} />
                  <View style={[styles.qrCorner, styles.qrCornerBottomRight]} />
                  <View collapsable={false} style={styles.qrSvgHost}>
                    <QRCode
                      key={qrValue}
                      value={qrValue || ' '}
                      size={qrSize}
                      ecl="M"
                    />
                  </View>
                </View>

                <Text style={styles.qrFooter}>at each stop on your route.</Text>
                {progressUrlHint ? (
                  <Text style={styles.qrUrlHint} numberOfLines={3}>
                    {progressUrlHint}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.bottomInfoBox}>
              <View style={styles.bottomInfoItem}>
                <Target size={20} color="#0648A8" strokeWidth={2.2} />
                <View style={styles.bottomTextWrapper}>
                  <Text style={styles.bottomLabel}>Purpose</Text>
                  <Text style={styles.bottomValue} numberOfLines={3}>
                    {purpose || "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.bottomInfoItem}>
                <Building2 size={20} color="#0648A8" fill="#0648A8" />
                <View style={styles.bottomTextWrapper}>
                  <Text style={styles.bottomLabel}>Destination</Text>
                  <Text style={styles.bottomValue} numberOfLines={3}>
                    {destination || "—"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <MapPin size={18} color="#0648A8" fill="#0648A8" />
              <Text style={styles.routeTitle}>Visit route (in order)</Text>
            </View>

            {visitRoute.map((office, index) => {
              const status = office.status;
              const isDone = status === "done";
              const isCurrent = status === "current";
              return (
                <View
                  key={`${office.id}-${office.stepOrder ?? index}`}
                  style={[
                    styles.routeItem,
                    isDone && styles.routeItemDone,
                    isCurrent && styles.routeItemCurrent,
                  ]}
                >
                  <View
                    style={[
                      styles.routeNumberCircle,
                      isDone && styles.routeNumberCircleDone,
                      isCurrent && styles.routeNumberCircleCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.routeNumberText,
                        (isDone || isCurrent) && styles.routeNumberTextOn,
                      ]}
                    >
                      {isDone ? "✓" : (office.stepOrder ?? index + 1)}
                    </Text>
                  </View>
                  <View style={styles.routeTextWrapper}>
                    <Text style={styles.routeOfficeText}>{office.name}</Text>
                    {office.stepName ? (
                      <Text style={styles.routeStepText} numberOfLines={3}>
                        {office.stepName}
                      </Text>
                    ) : null}
                  </View>
                  {status ? (
                    <Text
                      style={[
                        styles.routeStatusText,
                        isDone && styles.routeStatusDone,
                        isCurrent && styles.routeStatusCurrent,
                      ]}
                    >
                      {isDone ? "Done" : isCurrent ? "Current" : "Pending"}
                    </Text>
                  ) : (
                    <ChevronRight size={16} color="#4B5563" strokeWidth={2.2} />
                  )}
                </View>
              );
            })}

            <View style={styles.noticeBox}>
              <View style={styles.noticeIconCircle}>
                <Info size={14} color="#0648A8" strokeWidth={2.4} />
              </View>
              <Text style={styles.noticeText}>
                Keep this pass ready. Staff will scan the code at each office to
                record your visit.
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.actionButton, styles.downloadButton]}
              onPress={onDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Download size={17} color="#FFFFFF" strokeWidth={2.5} />
              )}
              <Text style={styles.downloadText}>
                {isDownloading ? "Please wait…" : "Download"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.actionButton, styles.printButton]}
              onPress={onPrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#0648A8" />
              ) : (
                <Printer size={17} color="#0648A8" strokeWidth={2.5} />
              )}
              <Text style={styles.printText}>
                {isPrinting ? "Please wait…" : "Print"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.completeButton}
            onPress={onCompleteReturn}
          >
            <View style={styles.completeIconCircle}>
              <Check size={16} color="#0648A8" strokeWidth={2.6} />
            </View>
            <Text style={styles.completeText}>Complete & return</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0648A8",
  },
  layout: {
    flex: 1,
    backgroundColor: "#0648A8",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: {
    backgroundColor: "#0648A8",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 22,
    position: "relative",
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    zIndex: 2,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    zIndex: 2,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 40,
  },
  floatingSheet: {
    backgroundColor: "transparent",
    marginTop: 0,
    marginHorizontal: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
  },
  successBanner: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 14,
    shadowColor: "#0648A8",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  successIconCluster: {
    width: 58,
    height: 58,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successRippleOuter: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.22)",
    backgroundColor: "rgba(16,185,129,0.04)",
  },
  successRippleInner: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
  },
  successIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  successIconInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  successTextWrapper: {
    flex: 1,
  },
  successTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  visitorBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  visitorBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  faintShield: {
    opacity: 0.38,
    marginLeft: 4,
  },
  ticketCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    /* overflow visible: avoids Fabric + react-native-svg QR clipping bugs ("child already has a parent") */
    overflow: "visible",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ticketMainRow: {
    flexDirection: "row",
    padding: 8,
  },
  profileColumn: {
    width: "40%",
    paddingRight: 6,
  },
  photoFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5EAF2",
    overflow: "hidden",
    backgroundColor: "#EAF2FF",
    marginBottom: 6,
  },
  visitorPhoto: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  profileIconBox: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  profileTextWrapper: {
    flex: 1,
  },
  profileLabel: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 1,
  },
  profileValue: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
  },
  profileValueHighlight: {
    color: "#0648A8",
    fontSize: 11,
    letterSpacing: 0.1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#E5EAF2",
  },
  qrColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#BED4F6",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  qrInstruction: {
    color: "#0648A8",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  qrBox: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  qrSvgHost: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrCorner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "#0648A8",
  },
  qrCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 4,
  },
  qrCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 4,
  },
  qrCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 4,
  },
  qrCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 4,
  },
  qrFooter: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  qrUrlHint: {
    color: "#0648A8",
    fontSize: 8,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  bottomInfoBox: {
    borderTopWidth: 1,
    borderTopColor: "#E5EAF2",
    backgroundColor: "#F8FBFF",
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BED4F6",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomInfoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomTextWrapper: {
    flex: 1,
    marginLeft: 6,
  },
  bottomLabel: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 1,
  },
  bottomValue: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#BED4F6",
    marginHorizontal: 6,
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routeTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
  },
  routeItem: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E0EA",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  routeItemDone: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  routeItemCurrent: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
  },
  routeNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0648A8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  routeNumberCircleDone: {
    backgroundColor: "#10B981",
  },
  routeNumberCircleCurrent: {
    backgroundColor: "#F59E0B",
  },
  routeNumberText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  routeNumberTextOn: {
    color: "#FFFFFF",
  },
  routeStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    marginLeft: 4,
  },
  routeStatusDone: {
    color: "#047857",
  },
  routeStatusCurrent: {
    color: "#C2410C",
  },
  routeTextWrapper: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 4,
  },
  routeOfficeText: {
    color: "#0648A8",
    fontSize: 13,
    fontWeight: "800",
  },
  routeStepText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    marginTop: 2,
  },
  noticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BED4F6",
    backgroundColor: "#F4F9FF",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  noticeIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#0648A8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  noticeText: {
    flex: 1,
    color: "#111827",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  downloadButton: {
    backgroundColor: "#0648A8",
  },
  printButton: {
    backgroundColor: "#EAF2FF",
  },
  downloadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  printText: {
    color: "#0648A8",
    fontSize: 12,
    fontWeight: "800",
  },
  completeButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#0648A8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  completeIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  completeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
