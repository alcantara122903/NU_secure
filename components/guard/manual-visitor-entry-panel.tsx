import {
  BirthdayDateField,
  type BirthdayFieldColors,
} from "@/components/birthday-date-field";
import {
  Camera,
  Info,
  Keyboard,
  Search,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type ManualVisitorEntryPanelProps = {
  firstName: string;
  onChangeFirstName: (value: string) => void;
  lastName: string;
  onChangeLastName: (value: string) => void;
  birthday: string;
  onChangeBirthday: (value: string) => void;
  birthdayColors: BirthdayFieldColors;
  isChecking?: boolean;
  onBackToIdScan: () => void;
  onCheckVisitor: () => void;
};

/**
 * Manual first/last name + birthday entry (replaces Test OCR on Step 1).
 * Matches the guard "Enter Visitor Details" design for returning-visitor lookup.
 */
export function ManualVisitorEntryPanel({
  firstName,
  onChangeFirstName,
  lastName,
  onChangeLastName,
  birthday,
  onChangeBirthday,
  birthdayColors,
  isChecking = false,
  onBackToIdScan,
  onCheckVisitor,
}: ManualVisitorEntryPanelProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Keyboard size={22} color="#0648A8" strokeWidth={2.3} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Enter Visitor Details</Text>
              <Text style={styles.subtitle}>
                Enter the visitor&apos;s first name, last name, and birthday to
                check for an existing visitor record.
              </Text>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              First Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={onChangeFirstName}
              placeholder="Enter first name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              editable={!isChecking}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              Last Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={onChangeLastName}
              placeholder="Enter last name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              editable={!isChecking}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              Birthday <Text style={styles.required}>*</Text>
            </Text>
            <BirthdayDateField
              value={birthday}
              onChange={onChangeBirthday}
              colors={birthdayColors}
              label=""
              inputContainerStyle={styles.birthdayInput}
            />
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoIconCircle}>
              <Info size={14} color="#0648A8" strokeWidth={2.6} />
            </View>
            <Text style={styles.infoText}>
              Enter the first and last name exactly as shown on the
              visitor&apos;s valid identification.
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.88}
              onPress={onBackToIdScan}
              disabled={isChecking}
            >
              <Camera size={16} color="#0648A8" strokeWidth={2.4} />
              <Text style={styles.secondaryBtnText}>Back to ID Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, isChecking && styles.primaryBtnDisabled]}
              activeOpacity={0.9}
              onPress={onCheckVisitor}
              disabled={isChecking}
            >
              {isChecking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Check Visitor</Text>
                  <Search size={16} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    color: "#0B2F6B",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  fieldBlock: {
    marginBottom: 14,
  },
  label: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  required: {
    color: "#DC2626",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  birthdayInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EAF2FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  infoIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D6E6FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    color: "#1E3A5F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    color: "#0648A8",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0648A8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
