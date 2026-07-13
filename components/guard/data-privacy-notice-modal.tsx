import { Shield } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type DataPrivacyNoticeModalProps = {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
};

const COLLECT_ITEMS = [
  "Identification details from your scanned or uploaded ID (such as name, birthday, and address)",
  "Contact information and visit details (phone number, destination, reason for visit)",
  "A photo of your face with your ID for visitor verification",
  "A QR ticket / control number used for entry monitoring and exit scanning",
];

const USE_ITEMS = [
  "To verify your identity and complete visitor check-in",
  "To record your visit and destination within the campus",
  "To support security monitoring, alerts, and incident response",
  "To generate and validate your temporary visitor QR ticket",
];

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bodyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Full-screen overlay (not RN Modal) so ImagePicker/camera can open
 * immediately after Agree without hanging behind a Modal.
 */
export function DataPrivacyNoticeModal({
  visible,
  onAgree,
  onDecline,
}: DataPrivacyNoticeModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.badge}>
          <Shield size={14} color="#0648A8" strokeWidth={2.4} />
          <Text style={styles.badgeText}>Data Privacy Notice</Text>
        </View>

        <Text style={styles.title}>
          Consent to Collect and Process Your Data
        </Text>
        <Text style={styles.subtitle}>
          Please read this notice before continuing with visitor registration.
        </Text>

        <View style={styles.contentBox}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.bodyText}>
              National University uses the Visitor Monitoring System (VMS) to
              register campus visitors for security and safety. By continuing,
              you agree that the University may collect and process your
              personal information for this purpose, in line with the Data
              Privacy Act of 2012 (RA 10173).
            </Text>

            <Text style={styles.sectionTitle}>
              What we collect during registration
            </Text>
            <BulletList items={COLLECT_ITEMS} />

            <Text style={styles.sectionTitle}>How we use your information</Text>
            <BulletList items={USE_ITEMS} />

            <Text style={styles.sectionTitle}>
              Who can access your information
            </Text>
            <Text style={styles.bodyText}>
              Authorized University personnel (such as security guards and
              system administrators) may access your registration data only as
              needed for campus security and visitor management.
            </Text>

            <Text style={styles.sectionTitle}>Your consent</Text>
            <Text style={styles.bodyText}>
              Registration is voluntary. If you do not agree, please select{" "}
              <Text style={styles.bodyBold}>Decline</Text> and ask the on-duty
              guard for assistance. If you select{" "}
              <Text style={styles.bodyBold}>I Agree</Text>, you confirm that you
              understand this notice and consent to the collection and
              processing of your data for visitor registration.
            </Text>
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={onDecline}
            activeOpacity={0.85}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.agreeButton}
            onPress={onAgree}
            activeOpacity={0.85}
          >
            <Text style={styles.agreeText}>I Agree</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    maxHeight: "92%",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F1FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  badgeText: {
    color: "#0648A8",
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#0648A8",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 6,
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 14,
  },
  contentBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    maxHeight: 340,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  sectionTitle: {
    color: "#0648A8",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 2,
  },
  bodyText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
  bodyBold: {
    color: "#111827",
    fontWeight: "800",
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6B7280",
    marginTop: 7,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  declineButton: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#0648A8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  declineText: {
    color: "#0648A8",
    fontSize: 14,
    fontWeight: "700",
  },
  agreeButton: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#0648A8",
    alignItems: "center",
  },
  agreeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
