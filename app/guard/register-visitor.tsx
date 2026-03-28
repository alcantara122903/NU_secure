import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterVisitorScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();
  const visitorType = params.visitorType as string;

  const [step, setStep] = useState(1);
  const [visitorName, setVisitorName] = useState('John Smith');
  const [visitorDepartment, setVisitorDepartment] = useState('Engineering');
  const [qrCodeData, setQrCodeData] = useState('');
  const [visitorId, setVisitorId] = useState('ID978444');
  const [destinationOffice, setDestinationOffice] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [showOfficeModal, setShowOfficeModal] = useState(false);

  const offices = [
    'Admission Office',
    'Health Services Office',
    "Guidance's Service Office",
    "Registrar's Office",
    'Treasury Office',
    'SDAO',
    'BULLDOGS Exchange',
    'ITSO',
    'FAQ',
    'HR Office',
  ];

  // Generate QR code data when reaching step 3 for enrollees
  useEffect(() => {
    if (step === 3 && visitorType === 'enrollee' && !qrCodeData) {
      const enrolleeQRData = btoa(JSON.stringify({
        visitorName,
        visitorType: 'enrollee',
        timestamp: new Date().toISOString(),
        registrationId: `ENR-${Date.now()}`,
      }));
      setQrCodeData(enrolleeQRData);
    }
  }, [step, visitorType, qrCodeData, visitorName]);

  const getVisitorTypeDisplay = () => {
    switch (visitorType) {
      case 'enrollee':
        return { icon: 'E', label: 'Enrollee' };
      case 'contractor':
        return { icon: 'C', label: 'Contractor' };
      case 'normal':
        return { icon: 'V', label: 'Normal Visitor' };
      default:
        return { icon: 'V', label: 'Visitor' };
    }
  };

  const visitorTypeInfo = getVisitorTypeDisplay();

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleCaptureFace = () => {
    alert('Camera capture coming soon - advancing to step 2');
    setStep(2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.visitorTypeBadge}>
            <Text style={styles.visitorTypeIcon}>{visitorTypeInfo.icon}</Text>
            <Text style={styles.visitorTypeLabel}>{visitorTypeInfo.label}</Text>
          </View>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            {/* Camera Frame Card */}
            <View style={[styles.cameraCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.cameraFrame, { borderColor: colors.primary }]}>
                <MaterialIcons name="photo-camera" size={56} color={colors.primary} />
              </View>
              <Text style={[styles.cameraTitle, { color: colors.text }]}>
                Position visitor in frame
              </Text>
              <Text style={[styles.cameraSubtitle, { color: colors.textSecondary }]}>
                Ensure good lighting and clear view
              </Text>
            </View>

            {/* Capture Button */}
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.primary }]}
              onPress={handleCaptureFace}
              activeOpacity={0.8}
            >
              <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
              <Text style={styles.captureButtonText}>Capture Face</Text>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={[styles.instructionsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.instructionsTitle, { color: colors.primary }]}>
                Instructions:
              </Text>
              <View style={styles.instructionsList}>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Ask visitor to remove glasses if needed
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Ensure face is fully visible and well-lit
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Position face within the frame guidelines
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            {/* ID Scan Card */}
            <View style={[styles.cameraCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.cameraFrame, { borderColor: colors.primary }]}>
                <MaterialIcons name="description" size={56} color={colors.primary} />
              </View>
              <Text style={[styles.cameraTitle, { color: colors.text }]}>
                Scan ID Document
              </Text>
              <Text style={[styles.cameraSubtitle, { color: colors.textSecondary }]}>
                Capture both front and back
              </Text>
            </View>

            {/* Scan Button */}
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.primary }]}
              onPress={() => setStep(3)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
              <Text style={styles.captureButtonText}>Capture ID</Text>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={[styles.instructionsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.instructionsTitle, { color: colors.primary }]}>
                ID Requirements:
              </Text>
              <View style={styles.instructionsList}>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Valid government-issued ID required
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Ensure all details are clearly visible
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Good lighting for accurate reading
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            {visitorType === 'enrollee' ? (
              /* Enrollee Flow - Auto-populated with QR Code */
              <>
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.detailsTitle, { color: colors.text }]}>
                    Enrollment Confirmation
                  </Text>
                  
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Name
                    </Text>
                    <View style={[styles.fieldInputLocked, { backgroundColor: '#F5F5F5', borderColor: colors.border }]}>
                      <MaterialIcons name="person" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.fieldValue, { color: colors.text }]}>
                        {visitorName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Department
                    </Text>
                    <View style={[styles.fieldInputLocked, { backgroundColor: '#F5F5F5', borderColor: colors.border }]}>
                      <MaterialIcons name="business" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.fieldValue, { color: colors.text }]}>
                        {visitorDepartment}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Enrollment ID
                    </Text>
                    <View style={[styles.fieldInputLocked, { backgroundColor: '#F5F5F5', borderColor: colors.border }]}>
                      <MaterialIcons name="badge" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.fieldValue, { color: colors.text, fontSize: 12, fontFamily: 'monospace' }]}>
                        ENR-{Date.now()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 20, marginBottom: 12 }]}>
                    Access QR Code
                  </Text>
                </View>

                {/* QR Code Display */}
                <View style={[styles.qrCodeContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                  <Image 
                    source={require('@/assets/images/image.png')}
                    style={styles.qrCodeImage}
                    resizeMode="contain"
                  />
                  <Text style={[styles.qrCodeLabel, { color: colors.textSecondary }]}>
                    Scan to access next steps
                  </Text>
                </View>

                <View style={[styles.infoBox, { backgroundColor: '#E8F5E9', borderLeftColor: '#28A745' }]}>
                  <MaterialIcons name="info" size={20} color="#28A745" />
                  <Text style={[styles.infoText, { color: '#155724' }]}>
                    Share this QR code with the enrollee to provide access to their next steps and instructions.
                  </Text>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    alert('Enrollee registered successfully!\n\nID: ENR-' + Date.now() + '\n\nQR code sent to enrollee.');
                    router.back();
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="check-circle" size={28} color="#28A745" />
                  <Text style={styles.captureButtonText}>Complete Enrollment</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Regular Visitor Flow - Form Fields */
              <>
                {/* Visitor Details Card */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.detailsTitle, { color: colors.text }]}>
                    Visitor Details (Auto-filled)
                  </Text>
                  
                  {/* Visitor Avatar Section */}
                  <View style={styles.avatarSection}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#E3F2FD' }]}>
                      <MaterialIcons name="person" size={56} color={colors.primary} />
                    </View>
                    <View style={styles.avatarInfo}>
                      <View style={styles.avatarField}>
                        <Text style={[styles.avatarLabel, { color: colors.textSecondary }]}>Full Name</Text>
                        <Text style={[styles.avatarValue, { color: colors.text }]}>{visitorName}</Text>
                      </View>
                      <View style={styles.avatarField}>
                        <Text style={[styles.avatarLabel, { color: colors.textSecondary }]}>ID Number</Text>
                        <Text style={[styles.avatarValue, { color: colors.text }]}>{visitorId}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Destination Office / Work Location Field */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.fieldHeader}>
                    <MaterialIcons name={visitorType === 'contractor' ? 'construction' : 'location-on'} size={18} color={colors.primary} />
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginLeft: 8 }]}>
                      {visitorType === 'contractor' ? 'Work Location / Project' : 'Destination Office'} <Text style={{ color: '#D32F2F' }}>*</Text>
                    </Text>
                  </View>
                  <View style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, marginTop: 12 }]}>
                    {visitorType === 'contractor' ? (
                      <TextInput
                        style={[styles.fieldInputText, { color: colors.text }]}
                        placeholder="Enter work location or project site"
                        placeholderTextColor={colors.textSecondary}
                        value={workLocation}
                        onChangeText={setWorkLocation}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.dropdownTouchable}
                        onPress={() => setShowOfficeModal(true)}
                      >
                        <Text style={[styles.fieldInputText, { color: destinationOffice ? colors.text : colors.textSecondary }]}>
                          {destinationOffice || 'Select destination office'}
                        </Text>
                        <MaterialIcons name="expand-more" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Office Selection Modal */}
                <Modal
                  visible={showOfficeModal}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowOfficeModal(false)}
                >
                  <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Destination Office</Text>
                        <TouchableOpacity onPress={() => setShowOfficeModal(false)}>
                          <MaterialIcons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.modalList}>
                        {offices.map((office, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.officeOption,
                              { borderBottomColor: colors.border, backgroundColor: destinationOffice === office ? colors.background : 'transparent' }
                            ]}
                            onPress={() => {
                              setDestinationOffice(office);
                              setShowOfficeModal(false);
                            }}
                          >
                            <View style={styles.officeOptionContent}>
                              <MaterialIcons
                                name={destinationOffice === office ? 'check-circle' : 'circle'}
                                size={20}
                                color={destinationOffice === office ? colors.primary : colors.textSecondary}
                              />
                              <Text style={[styles.officeOptionText, { color: colors.text, marginLeft: 12 }]}>
                                {office}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>

                {/* Phone Number Field */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Phone Number <Text style={{ color: colors.textSecondary }}>(Optional)</Text>
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Reason for Visit Field */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.fieldHeader}>
                    <MaterialIcons name="description" size={18} color={colors.primary} />
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginLeft: 8 }]}>
                      Reason For Visit <Text style={{ color: '#D32F2F' }}>*</Text>
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, minHeight: 100, textAlignVertical: 'top' }]}
                    placeholder="Enter reason for visit"
                    placeholderTextColor={colors.textSecondary}
                    value={reasonForVisit}
                    onChangeText={setReasonForVisit}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* Generate QR Ticket Button */}
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: colors.primary, marginHorizontal: 20 }]}
                  onPress={() => {
                    const requiredField = visitorType === 'contractor' ? workLocation : destinationOffice;
                    if (!requiredField || !reasonForVisit) {
                      alert('Please fill in all required fields');
                      return;
                    }
                    alert(`${visitorType === 'contractor' ? 'Contractor' : 'Visitor'} registered successfully!\n\nQR Ticket Generated`);
                    router.back();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.generateButtonText}>Generate QR Ticket</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    marginBottom: 8,
  },
  visitorTypeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  visitorTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003D99',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  cameraCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cameraFrame: {
    width: 140,
    height: 140,
    borderWidth: 3,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraIcon: {
    fontSize: 56,
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  cameraSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  captureButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  captureButtonIcon: {
    fontSize: 20,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructionsCard: {
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  instructionsList: {
    gap: 10,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: -2,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  stepPlaceholder: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  nextButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  detailField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  fieldInputLocked: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
  qrCodeContainer: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  qrCodePlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrCodeImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrCodeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#000000',
    lineHeight: 16,
    letterSpacing: 1,
  },
  qrCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInfo: {
    flex: 1,
  },
  avatarField: {
    marginBottom: 12,
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  avatarValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldInputText: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  generateButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dropdownTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalList: {
    paddingHorizontal: 0,
  },
  officeOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  officeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  officeOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
