import type { ReturningVisitorMatch } from "@/services/visitor/visitor-lookup";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ReturningVisitorModalProps = {
  visible: boolean;
  match: ReturningVisitorMatch | null;
  /**
   * enrollee-resume: show enrollment progress (registering as enrollee).
   * identity-confirm: Existing Visitor Found — photo + basic info only
   *   (registering as contractor/normal, including former enrollees).
   */
  mode?: "enrollee-resume" | "identity-confirm";
  onConfirmResume: () => void;
  onCancelNewVisitor: () => void;
};

const ENROLLEE_COPY = {
  title: "Returning Enrollee Found",
  subtitle:
    "This enrollee was registered before. Confirm to resume their enrollment record on the new QR pass.",
  progressLabel: "Enrollment Progress",
  confirmText: "Yes, Resume Enrollment",
};

const IDENTITY_COPY = {
  title: "Existing Visitor Found",
  subtitle:
    "We found a matching visitor record. Please confirm whether this is the same person before continuing. Tap Cancel to create a new visitor record instead.",
  confirmText: "Yes, Continue",
};

function formatProgressLine(match: ReturningVisitorMatch): string {
  if (match.progress) {
    const {
      completedSteps,
      totalSteps,
      nextStepName,
      nextOfficeName,
      allCompleted,
    } = match.progress;
    if (allCompleted) {
      return `${completedSteps}/${totalSteps} done · All steps complete`;
    }
    const next =
      nextOfficeName || nextStepName
        ? ` · Next: ${nextOfficeName || nextStepName}`
        : "";
    return `${completedSteps}/${totalSteps} done${next}`;
  }

  if (match.lastVisitSummary) {
    return match.lastVisitSummary;
  }

  return "Previous registration on file";
}

/**
 * Shown after ID OCR when name + birthday match an existing visitor.
 */
export function ReturningVisitorModal({
  visible,
  match,
  mode = "enrollee-resume",
  onConfirmResume,
  onCancelNewVisitor,
}: ReturningVisitorModalProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
    setPhotoLoading(Boolean(match?.photoUrl));
  }, [match?.photoUrl, match?.visitorId, visible]);

  if (!match) return null;

  const isIdentity = mode === "identity-confirm";
  const copy = isIdentity ? IDENTITY_COPY : ENROLLEE_COPY;
  const fullName = `${match.firstName} ${match.lastName}`.trim();
  const showPhoto = Boolean(match.photoUrl) && !photoFailed;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelNewVisitor}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>

            <View style={styles.photoPanel}>
              <View style={styles.photoFrame}>
                {showPhoto ? (
                  <>
                    <Image
                      source={{ uri: match.photoUrl! }}
                      style={styles.photo}
                      resizeMode="cover"
                      onLoadStart={() => setPhotoLoading(true)}
                      onLoadEnd={() => setPhotoLoading(false)}
                      onError={() => {
                        setPhotoFailed(true);
                        setPhotoLoading(false);
                      }}
                    />
                    {photoLoading ? (
                      <View style={styles.photoLoadingOverlay}>
                        <ActivityIndicator color="#FFFFFF" />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>
                      {match.photoUrl
                        ? "Saved photo could not be loaded. Check Storage policies."
                        : "No saved photo available for validation."}
                    </Text>
                  </View>
                )}
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>VALIDATION PHOTO</Text>
                </View>
              </View>
              <Text style={styles.photoHint}>
                Compare this saved photo with the person in front of you before
                continuing.
              </Text>
            </View>

            <View style={styles.infoPanel}>
              <InfoRow label="Visitor Name" value={fullName || "—"} />
              <InfoRow
                label="Contact Number"
                value={match.contactNo?.trim() || "—"}
              />
              <InfoRow label="Birthday" value={match.birthday || "—"} />
              <InfoRow
                label="Saved Address"
                value={match.addressText?.trim() || "—"}
              />
              {!isIdentity ? (
                <>
                  <InfoRow
                    label={ENROLLEE_COPY.progressLabel}
                    value={formatProgressLine(match)}
                  />
                  <InfoRow label="Visitor Type" value="Enrollee" />
                </>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancelNewVisitor}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>Cancel (New Visitor)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirmResume}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>{copy.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    maxHeight: "92%",
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B2F6B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
    marginBottom: 16,
  },
  photoPanel: {
    backgroundColor: "#E8F4FC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  photoFrame: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    minHeight: 180,
  },
  photo: {
    width: "100%",
    height: 200,
  },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  photoPlaceholder: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  photoPlaceholderText: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  photoBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "#C4B5FD",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#312E81",
    letterSpacing: 0.4,
  },
  photoHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#374151",
  },
  infoPanel: {
    backgroundColor: "#E8F4FC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },
  confirmBtn: {
    flex: 1.15,
    backgroundColor: "#0B2F6B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
