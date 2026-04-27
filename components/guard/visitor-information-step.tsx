import { BirthdayDateField, type BirthdayFieldColors } from '@/components/birthday-date-field';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  Home,
  IdCard,
  Map,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Square,
  User,
} from 'lucide-react-native';

export type VisitorInformationStepProps = {
  badgeIconLetter: string;
  badgeLabel: string;
  showDestinationOffice: boolean;
  showReasonForVisit: boolean;
  offices: string[];
  selectedOffices: string[];
  onToggleOffice: (office: string) => void;
  onBack: () => void;
  onContinue: () => void;
  firstName: string;
  onChangeFirstName: (v: string) => void;
  lastName: string;
  onChangeLastName: (v: string) => void;
  birthday: string;
  onChangeBirthday: (v: string) => void;
  houseNo: string;
  onChangeHouseNo: (v: string) => void;
  street: string;
  onChangeStreet: (v: string) => void;
  barangay: string;
  onChangeBarangay: (v: string) => void;
  city: string;
  onChangeCity: (v: string) => void;
  province: string;
  onChangeProvince: (v: string) => void;
  region: string;
  onChangeRegion: (v: string) => void;
  contactNo: string;
  onChangeContactNo: (v: string) => void;
  idPassNumber: string;
  onChangeIdPassNumber: (v: string) => void;
  controlNumber: string;
  reasonForVisit: string;
  onChangeReasonForVisit: (v: string) => void;
  birthdayColors: BirthdayFieldColors;
  /** Enrollee OCR / manual-entry banners above the form */
  topSlot?: React.ReactNode;
};

function HeaderPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 250"
      preserveAspectRatio="none"
    >
      <Path
        d="M-60 168 C35 95, 135 245, 270 150 C345 97, 395 125, 480 60"
        stroke="rgba(142,209,230,0.15)"
        strokeWidth="1.4"
        fill="none"
      />
      <Path
        d="M-40 185 C70 118, 160 255, 295 168 C360 126, 408 137, 470 92"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.4"
        fill="none"
      />
      <Path
        d="M-10 25 L88 -35 L184 25 L184 110 L-10 110 Z"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="2"
        fill="none"
      />
      <Path
        d="M305 20
           C340 15, 365 2, 385 -16
           C405 2, 430 15, 465 20
           L465 90
           C465 138, 425 168, 385 185
           C345 168, 305 138, 305 90
           Z"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
        fill="none"
      />
      <Circle cx="385" cy="82" r="30" fill="rgba(255,255,255,0.045)" />
      {Array.from({ length: 25 }).map((_, index) => {
        const row = Math.floor(index / 5);
        const col = index % 5;
        return (
          <Circle
            key={index}
            cx={30 + col * 26}
            cy={18 + row * 22}
            r="2.5"
            fill="rgba(255,255,255,0.09)"
          />
        );
      })}
    </Svg>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconCircle}>{icon}</View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: React.ReactNode;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputOuter}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputBox, multiline && styles.inputBoxMultiline]}>
        <View style={styles.inputIconBox}>{icon}</View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#7A8290"
          style={[styles.textInput, multiline && styles.textInputMultiline]}
          keyboardType={keyboardType}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

export function VisitorInformationStepScreen(props: VisitorInformationStepProps) {
  const {
    badgeIconLetter,
    badgeLabel,
    showDestinationOffice,
    showReasonForVisit,
    offices,
    selectedOffices,
    onToggleOffice,
    onBack,
    onContinue,
    firstName,
    onChangeFirstName,
    lastName,
    onChangeLastName,
    birthday,
    onChangeBirthday,
    houseNo,
    onChangeHouseNo,
    street,
    onChangeStreet,
    barangay,
    onChangeBarangay,
    city,
    onChangeCity,
    province,
    onChangeProvince,
    region,
    onChangeRegion,
    contactNo,
    onChangeContactNo,
    idPassNumber,
    onChangeIdPassNumber,
    controlNumber,
    reasonForVisit,
    onChangeReasonForVisit,
    birthdayColors,
    topSlot,
  } = props;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <HeaderPattern />

          <View style={styles.headerTop}>
            <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.visitorBadge}>
              <View style={styles.badgeIconBox}>
                <Text style={styles.badgeIconText}>{badgeIconLetter}</Text>
              </View>
              <Text style={styles.visitorBadgeText}>{badgeLabel}</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.stepTitle}>Step 2 of 3</Text>
          <Text style={styles.stepSubtitle}>Visitor Information</Text>

          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressDone]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
          </View>
        </View>

        <View style={styles.contentPanel}>
          {topSlot}

          <View style={styles.card}>
            <SectionHeader
              icon={<User size={15} color="#FFFFFF" strokeWidth={2.2} />}
              title="Personal Information"
            />

            <View style={styles.formGrid}>
              <FormInput
                label="First Name"
                placeholder="Enter first name"
                value={firstName}
                onChangeText={onChangeFirstName}
                icon={<User size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Last Name"
                placeholder="Enter last name"
                value={lastName}
                onChangeText={onChangeLastName}
                icon={<User size={17} color="#0648A8" strokeWidth={2.2} />}
              />

              <View style={styles.inputOuter}>
                <Text style={styles.inputLabel}>Birthday</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconBox}>
                    <CalendarDays size={17} color="#0648A8" strokeWidth={2.2} />
                  </View>
                  <View style={styles.birthdayInner}>
                    <BirthdayDateField
                      label=""
                      value={birthday}
                      onChange={onChangeBirthday}
                      colors={birthdayColors}
                      inputContainerStyle={styles.birthdayInputRow}
                    />
                  </View>
                </View>
              </View>

              <FormInput
                label="House No."
                placeholder="e.g., 123"
                value={houseNo}
                onChangeText={onChangeHouseNo}
                icon={<Home size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Street"
                placeholder="e.g., Main Street"
                value={street}
                onChangeText={onChangeStreet}
                icon={<MapPin size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Barangay"
                placeholder="e.g., Gulod Itaas"
                value={barangay}
                onChangeText={onChangeBarangay}
                icon={<Building2 size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="City / Municipality"
                placeholder="e.g., Batangas City"
                value={city}
                onChangeText={onChangeCity}
                icon={<Building2 size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Province"
                placeholder="e.g., Batangas"
                value={province}
                onChangeText={onChangeProvince}
                icon={<Map size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Region"
                placeholder="e.g., CALABARZON"
                value={region}
                onChangeText={onChangeRegion}
                icon={<Map size={17} color="#0648A8" strokeWidth={2.2} />}
              />
              <FormInput
                label="Contact No."
                placeholder="e.g., 09xxxxxxxxx"
                value={contactNo}
                onChangeText={onChangeContactNo}
                icon={<Phone size={17} color="#0648A8" strokeWidth={2.2} />}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {showDestinationOffice ? (
            <View style={styles.card}>
              <SectionHeader
                icon={
                  <BriefcaseBusiness size={15} color="#FFFFFF" strokeWidth={2.2} />
                }
                title="Destination Office"
              />
              <View style={styles.officeGrid}>
                {offices.map((office) => {
                  const isSelected = selectedOffices.includes(office);
                  return (
                    <TouchableOpacity
                      key={office}
                      activeOpacity={0.82}
                      style={[styles.officeOption, isSelected && styles.officeOptionSelected]}
                      onPress={() => onToggleOffice(office)}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} color="#0648A8" strokeWidth={2.4} />
                      ) : (
                        <Square size={18} color="#0648A8" strokeWidth={2.2} />
                      )}
                      <Text
                        style={[styles.officeText, isSelected && styles.officeTextSelected]}
                      >
                        {office}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <FormInput
              label="ID Pass Number"
              placeholder="Enter ID pass number"
              value={idPassNumber}
              onChangeText={onChangeIdPassNumber}
              icon={<IdCard size={17} color="#0648A8" strokeWidth={2.2} />}
            />

            <View style={styles.controlBox}>
              <View style={styles.controlIconBox}>
                <ShieldCheck
                  size={18}
                  color="#0648A8"
                  fill="#EAF2FF"
                  strokeWidth={2.2}
                />
              </View>
              <View style={styles.controlTextWrapper}>
                <Text style={styles.controlLabel}>Control Number</Text>
                <Text style={styles.controlNumber}>
                  {controlNumber.trim() ? controlNumber : 'Generating...'}
                </Text>
              </View>
            </View>

            {showReasonForVisit ? (
              <FormInput
                label="Reason For Visit"
                placeholder="Enter reason for visit"
                value={reasonForVisit}
                onChangeText={onChangeReasonForVisit}
                icon={<MessageSquare size={17} color="#0648A8" strokeWidth={2.2} />}
                multiline
              />
            ) : null}
          </View>

          <TouchableOpacity activeOpacity={0.9} style={styles.continueButton} onPress={onContinue}>
            <ArrowRight size={22} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.continueText}>Continue to Photo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0648A8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#0648A8',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 22,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTop: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 40, 100, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  visitorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD914',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  badgeIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeIconText: {
    color: '#FFD914',
    fontSize: 14,
    fontWeight: '900',
  },
  visitorBadgeText: {
    color: '#0648A8',
    fontSize: 14,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  stepTitle: {
    zIndex: 2,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    zIndex: 2,
    color: '#DCEBFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  progressRow: {
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  progressBar: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  progressDone: {
    backgroundColor: '#8ED1E6',
  },
  progressActive: {
    backgroundColor: '#FFD914',
  },
  contentPanel: {
    backgroundColor: '#F8FAFC',
    marginTop: -18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0648A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  formGrid: {
    gap: 14,
  },
  inputOuter: {
    width: '100%',
  },
  inputLabel: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginLeft: 1,
  },
  inputBox: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D1D9E4',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBoxMultiline: {
    alignItems: 'stretch',
    paddingVertical: 8,
    minHeight: 76,
  },
  inputIconBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  birthdayInner: {
    flex: 1,
    justifyContent: 'center',
  },
  birthdayInputRow: {
    borderWidth: 0,
    marginTop: 0,
    minHeight: 36,
    paddingVertical: 2,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  textInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  textInputMultiline: {
    minHeight: 56,
    paddingTop: 2,
  },
  officeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  officeOption: {
    width: '48%',
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D1D9E4',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  officeOptionSelected: {
    borderColor: '#0648A8',
    backgroundColor: '#EAF2FF',
  },
  officeText: {
    flex: 1,
    color: '#111827',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
    lineHeight: 16,
  },
  officeTextSelected: {
    color: '#0648A8',
    fontWeight: '800',
  },
  controlBox: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D1D9E4',
    backgroundColor: '#EAF2FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  controlIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  controlTextWrapper: {
    flex: 1,
  },
  controlLabel: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 1,
  },
  controlNumber: {
    color: '#0648A8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  continueButton: {
    alignSelf: 'center',
    width: '86%',
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0648A8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
