import { Camera, ShieldCheck } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type PhotoCaptureConsentKind = "face" | "id";

export type PhotoCaptureConsentModalProps = {
  visible: boolean;
  kind: PhotoCaptureConsentKind;
  onAgree: () => void;
  onDecline: () => void;
};

/**
 * Full-screen overlay (not RN Modal) so ImagePicker/camera can open
 * immediately after Agree without hanging behind a native Modal.
 */
export function PhotoCaptureConsentModal({
  visible,
  kind,
  onAgree,
  onDecline,
}: PhotoCaptureConsentModalProps) {
  if (!visible) {
    return null;
  }

  const isFace = kind === "face";
  const title = isFace
    ? "Photo Capture Consent"
    : "ID Document Capture Consent";
  const question = isFace
    ? "Are you comfortable with having your photo taken for visitor verification?"
    : "Are you comfortable with having your ID document photographed for visitor registration?";
  const purpose = isFace
    ? "This photo will appear on your visitor ticket and may be used by security staff to confirm your identity during your visit."
    : "This image will be used only to extract visitor details and for verification. It is not shared for marketing purposes.";

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.badge}>
          <Camera size={14} color="#0648A8" strokeWidth={2.4} />
          <Text style={styles.badgeText}>Camera Permission Notice</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.question}>{question}</Text>

        <View style={styles.contentBox}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.purposeRow}>
              <View style={styles.purposeIcon}>
                <ShieldCheck size={18} color="#0648A8" strokeWidth={2.3} />
              </View>
              <Text style={styles.bodyText}>{purpose}</Text>
            </View>

            <Text style={styles.sectionLabel}>Before we continue</Text>
            <View style={styles.bulletList}>
              {(isFace
                ? [
                    "Face the camera clearly with good lighting",
                    "Remove sunglasses or face coverings if possible",
                    "You may recapture the photo if you are not satisfied",
                  ]
                : [
                    "Place the ID flat and fully inside the frame",
                    "Avoid glare, blur, and cut-off edges",
                    "You may recapture if the image is unclear",
                  ]
              ).map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bodyText}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.agreeButton}
            onPress={onAgree}
            activeOpacity={0.9}
          >
            <Text style={styles.agreeText}>
              {isFace ? "Yes, take my photo" : "Yes, capture my ID"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineButton}
            onPress={onDecline}
            activeOpacity={0.9}
          >
            <Text style={styles.declineText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 18,
    zIndex: 1000,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    maxHeight: "86%",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  badgeText: {
    color: "#0648A8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  title: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  question: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 14,
  },
  contentBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 260,
    overflow: "hidden",
  },
  scroll: {
    maxHeight: 260,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  purposeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  purposeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  sectionLabel: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  bodyText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0648A8",
    marginTop: 7,
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  agreeButton: {
    backgroundColor: "#0648A8",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  agreeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  declineButton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  declineText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "700",
  },
});
