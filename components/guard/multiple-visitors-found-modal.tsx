import {
  maskVisitorContact,
  type ReturningVisitorMatch,
} from "@/services/visitor/visitor-lookup";
import { User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type MultipleVisitorsFoundModalProps = {
  visible: boolean;
  matches: ReturningVisitorMatch[];
  onUseSelected: (match: ReturningVisitorMatch) => void;
  onCreateNewVisitor: () => void;
  onClose?: () => void;
};

/**
 * Shown when name + birthday match more than one visitor row.
 * Guard compares validation photos / masked contacts, then picks one.
 */
export function MultipleVisitorsFoundModal({
  visible,
  matches,
  onUseSelected,
  onCreateNewVisitor,
  onClose,
}: MultipleVisitorsFoundModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setPreviewUri(null);
      setFailedPhotos({});
      return;
    }
    setSelectedId(null);
    setPreviewUri(null);
  }, [visible, matches]);

  const selected = matches.find((m) => m.visitorId === selectedId) ?? null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose ?? onCreateNewVisitor}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Multiple Existing Visitors Found</Text>
          <Text style={styles.subtitle}>
            We found multiple visitor records with the same name and birthday.
            Compare the saved validation photos and visitor details, then select
            the correct visitor before continuing.
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {matches.map((match) => {
              const selectedRow = selectedId === match.visitorId;
              const fullName = `${match.firstName} ${match.lastName}`.trim();
              const photoOk =
                Boolean(match.photoUrl) && !failedPhotos[match.visitorId];

              return (
                <TouchableOpacity
                  key={match.visitorId}
                  activeOpacity={0.9}
                  style={[styles.row, selectedRow && styles.rowSelected]}
                  onPress={() => setSelectedId(match.visitorId)}
                >
                  <View
                    style={[
                      styles.radio,
                      selectedRow && styles.radioSelected,
                    ]}
                  >
                    {selectedRow ? <View style={styles.radioDot} /> : null}
                  </View>

                  <View style={styles.thumbWrap}>
                    {photoOk ? (
                      <Image
                        source={{ uri: match.photoUrl! }}
                        style={styles.thumb}
                        onError={() =>
                          setFailedPhotos((prev) => ({
                            ...prev,
                            [match.visitorId]: true,
                          }))
                        }
                      />
                    ) : (
                      <View style={styles.thumbFallback}>
                        <User size={22} color="#64748B" strokeWidth={2.2} />
                      </View>
                    )}
                  </View>

                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>
                      {fullName || "Visitor"}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>
                      Contact Number: {maskVisitorContact(match.contactNo)}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>
                      Birthday: {match.birthday || "—"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.badge}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedId(match.visitorId);
                      if (match.photoUrl && !failedPhotos[match.visitorId]) {
                        setPreviewUri(match.photoUrl);
                      }
                    }}
                  >
                    <Text style={styles.badgeText}>Validation Photo</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.88}
              onPress={onCreateNewVisitor}
            >
              <Text style={styles.secondaryBtnText}>
                None of These - New Visitor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                !selected && styles.primaryBtnDisabled,
              ]}
              activeOpacity={0.9}
              disabled={!selected}
              onPress={() => {
                if (selected) onUseSelected(selected);
              }}
            >
              <Text style={styles.primaryBtnText}>Use Selected Visitor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={Boolean(previewUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={styles.previewCloseHit}
            activeOpacity={1}
            onPress={() => setPreviewUri(null)}
          />
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Validation Photo</Text>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewUri(null)}
            >
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    maxHeight: "88%",
  },
  title: {
    color: "#0B2F6B",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginBottom: 14,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    borderColor: "#7C8CFF",
    backgroundColor: "#F5F7FF",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#5B6CFF",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#5B6CFF",
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: "#0B2F6B",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  detail: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  badge: {
    backgroundColor: "#E8E7FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 88,
  },
  badgeText: {
    color: "#4F46E5",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#E8EEF7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  secondaryBtnText: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#8B9BFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  previewCloseHit: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    zIndex: 2,
  },
  previewTitle: {
    color: "#0B2F6B",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 320,
    borderRadius: 12,
    backgroundColor: "#0F172A",
  },
  previewCloseBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#0648A8",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
