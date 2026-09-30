import { AlertTriangle, ClipboardPen, Info } from "lucide-react-native";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type IdExtractionReviewKind = "medium" | "low" | "failed";

export type IdExtractionReviewModalProps = {
  visible: boolean;
  kind: IdExtractionReviewKind;
  onContinue: () => void;
};

const COPY: Record<
  IdExtractionReviewKind,
  { title: string; message: string; hint: string }
> = {
  medium: {
    title: "Please verify the extracted details",
    message:
      "Some ID details could not be extracted clearly. Review each field on the next screen and correct anything that does not match the visitor’s identification.",
    hint: "Glare, holograms, or worn print on the ID can affect automatic reading.",
  },
  low: {
    title: "Please review the extracted details",
    message:
      "Automatic reading had difficulty with this ID. Please verify every field and edit any information that is missing or incorrect before continuing.",
    hint: "You can type corrections directly on the visitor information screen.",
  },
  failed: {
    title: "ID details could not be extracted",
    message:
      "We could not read this ID clearly. Please enter the visitor’s information manually and confirm that it matches their identification.",
    hint: "First name, last name, and address are required.",
  },
};

export function IdExtractionReviewModal({
  visible,
  kind,
  onContinue,
}: IdExtractionReviewModalProps) {
  const copy = COPY[kind];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {kind === "failed" ? (
              <AlertTriangle size={26} color="#C2410C" strokeWidth={2.3} />
            ) : (
              <Info size={26} color="#B45309" strokeWidth={2.3} />
            )}
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.message}>{copy.message}</Text>

          <View style={styles.hintBox}>
            <ClipboardPen size={16} color="#92400E" strokeWidth={2.3} />
            <Text style={styles.hintText}>{copy.hint}</Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.88}
            onPress={onContinue}
          >
            <Text style={styles.buttonText}>Review Fields</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    color: "#0B2F6B",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 14,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    width: "100%",
  },
  hintText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0648A8",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
