import { Building2, Lock, MessageSquareText, ShieldAlert, ShieldCheck, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { RemainingOfficeInfo } from "@/services/office-exit-api";

export type IncompleteRouteExitModalProps = {
  visible: boolean;
  visitorName?: string;
  remainingOffices: RemainingOfficeInfo[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirmAllowExit: (note: string) => void;
};

function formatOfficeLine(office: RemainingOfficeInfo): string {
  const name = office.officeName.trim() || `Office #${office.officeId}`;
  const floor = (office.floor || "").trim();
  if (!floor) return name;
  if (/\(.*floor.*\)/i.test(name)) return name;
  return `${name} (${floor})`;
}

/**
 * Shown on guard exit scan when a normal visitor still has unvisited declared offices.
 */
export function IncompleteRouteExitModal({
  visible,
  remainingOffices,
  isSubmitting = false,
  onCancel,
  onConfirmAllowExit,
}: IncompleteRouteExitModalProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) {
      setNote("");
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onCancel}
            disabled={isSubmitting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color="#94A3B8" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerIcon}>
            <ShieldAlert size={28} color="#D97706" strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Visit route incomplete</Text>
          <Text style={styles.subtitle}>
            This visitor still has unvisited offices on their pass. Exit cannot
            be completed until a guard reviews this with the visitor.
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Building2 size={16} color="#0B2F6B" strokeWidth={2.3} />
                <Text style={styles.sectionTitle}>Remaining offices</Text>
              </View>

              {remainingOffices.map((office) => (
                <View key={`${office.officeId}-${office.officeName}`} style={styles.officeRow}>
                  <View style={styles.officeIcon}>
                    <Building2 size={16} color="#0648A8" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.officeName} numberOfLines={2}>
                    {formatOfficeLine(office)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MessageSquareText size={16} color="#0B2F6B" strokeWidth={2.3} />
                <Text style={styles.sectionTitle}>Guard conversation note</Text>
              </View>
              <Text style={styles.sectionHint}>
                Add an optional note summarizing the conversation with the
                visitor.
              </Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => setNote(text.slice(0, 500))}
                placeholder="Add note (optional)..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                editable={!isSubmitting}
                maxLength={500}
              />
              <Text style={styles.charCount}>{note.length} / 500</Text>
            </View>

            <View style={styles.warningBanner}>
              <Lock size={15} color="#92400E" strokeWidth={2.3} />
              <Text style={styles.warningText}>
                Exit is blocked until a guard reviews this with the visitor.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
              onPress={() => onConfirmAllowExit(note.trim())}
              disabled={isSubmitting}
              activeOpacity={0.9}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.confirmText}>
                    Confirm conversation, then allow exit
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxHeight: "92%",
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    color: "#0B2F6B",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 12,
  },
  section: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0B2F6B",
    fontSize: 14,
    fontWeight: "800",
  },
  sectionHint: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginBottom: 10,
  },
  officeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  officeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  officeName: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  noteInput: {
    minHeight: 96,
    borderWidth: 1.4,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  charCount: {
    marginTop: 6,
    textAlign: "right",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FBBF24",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  warningText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  footer: {
    marginTop: 14,
    gap: 10,
  },
  cancelBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "700",
  },
  confirmBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#0648A8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  confirmBtnDisabled: {
    opacity: 0.75,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
  },
});
