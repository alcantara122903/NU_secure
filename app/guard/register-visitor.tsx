import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cameraService } from '@/services/camera';
import { enrolleeService } from '@/services/enrollee';
import { runOCRDiagnostics } from '@/utils/ocr-diagnostics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  
  // Step 1: Face Photo
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  
  // Step 2: ID Document Capture
  const [capturedIdPhoto, setCapturedIdPhoto] = useState<string | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [isCapturingIdPhoto, setIsCapturingIdPhoto] = useState(false);
  
  // Step 3: Enrollee Info (extracted from ID)
  const [extractedFirstName, setExtractedFirstName] = useState('');
  const [extractedLastName, setExtractedLastName] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [extractionConfidence, setExtractionConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [passNumber, setPassNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [enrolleeId, setEnrolleeId] = useState<number | null>(null);
  const [masterQrCode, setMasterQrCode] = useState('');
  const [isCreatingEnrollee, setIsCreatingEnrollee] = useState(false);
  const [enrolleeSteps, setEnrolleeSteps] = useState<any[]>([]);
  const [ocrExtractionFailed, setOcrExtractionFailed] = useState(false);

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

  // Generate pass number and control number when entering Step 3
  useEffect(() => {
    if (step === 3 && !controlNumber) {
      const pass = `PASS${Date.now()}`;
      const control = `CTRL${Date.now()}`;
      setPassNumber(pass);
      setControlNumber(control);
      console.log(`📋 Generated pass number: ${pass}`);
      console.log(`📋 Generated control number: ${control}`);
    }
  }, [step, controlNumber]);

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

  const handleCaptureFace = async () => {
    try {
      setIsCapturingPhoto(true);
      console.log('📸 Opening camera for face capture');

      const result = await cameraService.capturePhoto();

      if (!result.success) {
        Alert.alert('Camera Error', result.error || 'Failed to capture photo');
        setIsCapturingPhoto(false);
        return;
      }

      console.log('✅ Photo captured successfully');
      setCapturedFacePhoto(result.base64 || null);
      setPhotoPreview(result.uri || null);
      setIsCapturingPhoto(false);
    } catch (error) {
      console.error('❌ Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setIsCapturingPhoto(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (!capturedFacePhoto) {
      Alert.alert('Error', 'No photo captured');
      return;
    }

    console.log('✅ Face photo confirmed, proceeding to Step 2');
    setStep(2);
  };

  const handleRetakePhoto = () => {
    console.log('🔄 Retaking photo');
    setCapturedFacePhoto(null);
    setPhotoPreview(null);
  };

  const handleCaptureIdPhoto = async () => {
    try {
      setIsCapturingIdPhoto(true);
      console.log('📸 Opening camera for ID capture');

      const result = await cameraService.capturePhoto();

      if (!result.success) {
        Alert.alert('Camera Error', result.error || 'Failed to capture ID photo');
        setIsCapturingIdPhoto(false);
        return;
      }

      console.log('✅ ID photo captured successfully');
      setCapturedIdPhoto(result.base64 || null);
      setIdPhotoPreview(result.uri || null);
      setIsCapturingIdPhoto(false);
    } catch (error) {
      console.error('❌ Error capturing ID photo:', error);
      Alert.alert('Error', 'Failed to capture ID photo. Please try again.');
      setIsCapturingIdPhoto(false);
    }
  };

  // Fetch enrollee steps from database
  const fetchEnrolleeSteps = async (enrolleeId: number) => {
    try {
      console.log('📋 Fetching enrollee steps from database...');
      
      const steps = await enrolleeService.getEnrolleeSteps(enrolleeId);

      if (steps && steps.length > 0) {
        setEnrolleeSteps(steps);
        console.log('✅ Enrollee steps loaded from database:', steps);
      } else {
        console.warn('⚠️ No enrollee steps found in database');
        setEnrolleeSteps([]);
      }
    } catch (error) {
      console.error('❌ Error fetching enrollee steps:', error);
      setEnrolleeSteps([]);
    }
  };

  // Extract data from ID image using OCR with intelligent parsing
  const extractDataFromIdImage = async (idPhotoBase64: string) => {
    try {
      console.log('🔍 Starting ID text extraction...');
      
      // Show processing alert
      let processingAlert: any = null;
      processingAlert = Alert.alert(
        'Processing ID',
        'Analyzing your ID document and extracting information...',
        [{ text: 'Processing...' }],
        { cancelable: false }
      );

      // Try OCR extraction with intelligent parsing
      const extractedData = await enrolleeService.extractDataFromID(idPhotoBase64);
      
      // Close processing alert
      if (processingAlert) {
        processingAlert?.dismiss?.();
      }

      if (extractedData) {
        // Extraction successful - set whatever fields were extracted
        // Some fields may be empty if parser couldn't confidently extract them
        setExtractedFirstName(extractedData.firstName || '');
        setExtractedLastName(extractedData.lastName || '');
        setExtractedAddress(extractedData.address || '');
        setExtractionConfidence(extractedData.confidence);
        setOcrExtractionFailed(false);
        
        const extractedFields = [];
        if (extractedData.firstName) extractedFields.push('First Name');
        if (extractedData.lastName) extractedFields.push('Last Name');
        if (extractedData.address) extractedFields.push('Address');
        
        console.log(`✅ Data extracted successfully (${extractedData.confidence} confidence) - Fields: ${extractedFields.join(', ')}`);
        
        // Show confidence-based message
        let confidenceMessage = '';
        let actionMessage = 'Please review and confirm the extracted information.';
        let warningNote = '';
        let missingFieldsNote = extractedFields.length < 3 ? `\n\n📝 Fields extracted: ${extractedFields.join(', ')}. You can fill in missing fields manually on the next screen.` : '';
        
        if (extractedData.confidence === 'high') {
          confidenceMessage = '✅ High Confidence\n';
          actionMessage = 'The data was extracted with high accuracy.';
        } else if (extractedData.confidence === 'medium') {
          confidenceMessage = '⚠️ Medium Confidence\n';
          actionMessage = 'Some fields were extracted but please verify them carefully.';
          warningNote = '\n\n💡 If your ID has a hologram or see-through security sticker, some details may have been affected by glare. Please review all fields on the next screen and make any necessary corrections.';
        } else {
          confidenceMessage = '⚠️ Low Confidence\n';
          actionMessage = 'Automatic extraction had difficulty. Please review all fields carefully.';
          warningNote = '\n\n💡 Your ID may have holograms, security stickers, or glare that affected extraction. You will be able to manually correct any fields on the next screen.';
        }
        
        Alert.alert(
          'ID Data Extracted',
          `${confidenceMessage}\nFirst Name: ${extractedData.firstName || '(not extracted)'}\nLast Name: ${extractedData.lastName || '(not extracted)'}\nAddress: ${extractedData.address || '(not extracted)'}\n\n${actionMessage}${warningNote}${missingFieldsNote}`,
          [{ text: 'Review & Continue' }]
        );
      } else {
        // Extraction failed - guide user to manual entry
        console.warn('⚠️ OCR extraction failed - could not extract usable information from ID');
        setExtractionConfidence('low');
        setOcrExtractionFailed(true);
        
        Alert.alert(
          '⚠️ Unable to Extract ID Details',
          'We could not automatically read your ID due to image quality, lighting, or obscured text.\n\n✏️ No problem! You can enter your information manually on the next screen.\n\nRequired fields:\n  • First Name\n  • Last Name\n  • Address\n\nYou can also edit the phone number if needed.',
          [{ text: 'Proceed to Manual Entry' }]
        );
      }
    } catch (error) {
      console.error('❌ Error extracting ID data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Details:', errorMessage);
      
      setOcrExtractionFailed(true);
      
      Alert.alert(
        'Extraction Failed',
        'Could not automatically extract information from the ID. Please enter the details manually.\n\nYou will be able to enter your information in the next step.',
        [{ text: 'Continue to Manual Entry' }]
      );
    }
  };

  const handleConfirmIdPhoto = async () => {
    if (!capturedIdPhoto) {
      Alert.alert('Error', 'No ID photo captured');
      return;
    }

    console.log('📋 ID photo confirmed, extracting data...');
    
    // Extract data from ID image
    await extractDataFromIdImage(capturedIdPhoto);
    
    // Proceed to Step 3
    setStep(3);
  };

  const handleRetakeIdPhoto = () => {
    console.log('🔄 Retaking ID photo');
    setCapturedIdPhoto(null);
    setIdPhotoPreview(null);
  };

  const handleRunOCRDiagnostics = async () => {
    console.log('🔧 Running OCR diagnostics...');
    Alert.alert(
      'Running Diagnostics',
      'Checking backend connection and OCR configuration...',
      [{ text: 'OK' }]
    );

    const diagnostics = await runOCRDiagnostics();

    let message = `Backend: ${diagnostics.backendStatus === 'ok' ? '✅ OK' : '❌ ERROR'}\n`;
    message += `Tesseract: ${diagnostics.tesseractReady ? '✅ Ready' : '⏳ Initializing'}\n\n`;

    if (diagnostics.recommendations.length > 0) {
      message += '💡 Recommendations:\n';
      diagnostics.recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    Alert.alert('OCR Diagnostics Results', message, [{ text: 'OK' }]);
  };

  const handleCreateEnrollee = async () => {
    // Validate required fields
    const missingFields = [];
    if (!extractedFirstName?.trim()) missingFields.push('First Name');
    if (!extractedLastName?.trim()) missingFields.push('Last Name');
    if (!extractedAddress?.trim()) missingFields.push('Address');

    if (missingFields.length > 0) {
      Alert.alert(
        '⚠️ Missing Required Information',
        `Please fill in the following fields before proceeding:\n\n• ${missingFields.join('\n• ')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsCreatingEnrollee(true);
      console.log('🔄 Creating enrollee with data:', {
        firstName: extractedFirstName,
        lastName: extractedLastName,
        address: extractedAddress,
        contactNo: contactNumber,
      });

      // Generate unique pass number and QR token
      const pass = `PASS${Date.now()}`;
      const control = `CTRL${Date.now()}`;
      const qrToken = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Save enrollee to database
      const enrolleeResult = await enrolleeService.createEnrollee({
        firstName: extractedFirstName,
        lastName: extractedLastName,
        address: extractedAddress,
        contactNo: contactNumber || undefined,
        facePhotoUri: photoPreview || undefined,
        idPhotoUri: idPhotoPreview || undefined,
        passNumber: pass,
        controlNumber: control,
        qrToken: qrToken,
      });

      if (!enrolleeResult) {
        console.error('❌ Enrollee creation failed - database returned null');
        Alert.alert(
          'Database Error',
          'Failed to create enrollee record. Please check:\n\n• Internet connection\n• Enrollee & Visitor tables exist\n• Column names match schema\n\nCheck console for detailed error.',
          [{ text: 'Try Again' }]
        );
        setIsCreatingEnrollee(false);
        return;
      }

      console.log('✅ Enrollee created:', enrolleeResult.enrollee_id);
      
      // Set enrollee ID
      setEnrolleeId(enrolleeResult.enrollee_id);

      // Fetch enrollee steps from database
      await fetchEnrolleeSteps(enrolleeResult.enrollee_id);

      // Create Master QR Code data containing all visitor info and visit tracking token
      const masterQrData = {
        enrolleeId: enrolleeResult.enrollee_id,
        visitorId: enrolleeResult.visitor_id,
        visitId: enrolleeResult.visit_id,
        qrToken: qrToken,
        passNumber: pass,
        controlNumber: control,
        firstName: extractedFirstName,
        lastName: extractedLastName,
        address: extractedAddress,
        contactNo: contactNumber,
        registrationDate: new Date().toISOString(),
        status: 'pending',
      };

      // Encode Master QR code data
      const encodedQrData = btoa(JSON.stringify(masterQrData));
      setMasterQrCode(encodedQrData);

      console.log('✅ Enrollee created with Master QR code');
      console.log('Enrollee ID:', enrolleeResult.enrollee_id);
      console.log('QR Token (for office scanning):', qrToken);
      console.log('Pass Number:', pass);
      console.log('Control Number:', control);
      console.log('Visitor ID:', enrolleeResult.visitor_id);
      setIsCreatingEnrollee(false);
    } catch (error) {
      console.error('❌ Error creating enrollee:', error);
      Alert.alert('Error', 'Failed to create enrollee. Please try again.');
      setIsCreatingEnrollee(false);
    }
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
            {!photoPreview ? (
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
                  disabled={isCapturingPhoto}
                  activeOpacity={0.8}
                >
                  {isCapturingPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
                      <Text style={styles.captureButtonText}>Capture Face</Text>
                    </>
                  )}
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
            ) : (
              <>
                {/* Photo Preview */}
                <View style={[styles.cameraCard, { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: photoPreview }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <Text style={[styles.cameraTitle, { color: colors.text }]}>
                    Photo Preview
                  </Text>
                  <Text style={[styles.cameraSubtitle, { color: colors.textSecondary }]}>
                    Review the captured face photo
                  </Text>
                </View>

                {/* Confirm / Retake Buttons */}
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.captureButton, { backgroundColor: '#4CAF50' }]}
                    onPress={handleConfirmPhoto}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
                    <Text style={styles.captureButtonText}>Confirm Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.captureButton, { backgroundColor: '#FF9800' }]}
                    onPress={handleRetakePhoto}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="refresh" size={28} color="#FFFFFF" />
                    <Text style={styles.captureButtonText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={[styles.instructionsCard, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.instructionsTitle, { color: '#2E7D32' }]}>
                    ✓ Face Captured
                  </Text>
                  <Text style={[styles.instructionText, { color: '#388E3C', marginTop: 8 }]}>
                    This photo will be used for enrollment verification. Ensure the face is clearly visible and matches the visitor's ID.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {!idPhotoPreview ? (
              <>
                {/* ID Document Capture Card */}
                <View style={[styles.cameraCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.cameraFrame, { borderColor: colors.primary }]}>
                    <MaterialIcons name="description" size={56} color={colors.primary} />
                  </View>
                  <Text style={[styles.cameraTitle, { color: colors.text }]}>
                    Position ID in frame
                  </Text>
                  <Text style={[styles.cameraSubtitle, { color: colors.textSecondary }]}>
                    Capture clear photo of the visitor's ID document
                  </Text>
                </View>

                {/* Capture ID Button */}
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: colors.primary }]}
                  onPress={handleCaptureIdPhoto}
                  disabled={isCapturingIdPhoto}
                  activeOpacity={0.8}
                >
                  {isCapturingIdPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
                      <Text style={styles.captureButtonText}>Capture ID</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Diagnostic Button */}
                <TouchableOpacity
                  style={[styles.diagnosticButton, { backgroundColor: '#FF9800', marginHorizontal: 20 }]}
                  onPress={handleRunOCRDiagnostics}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="build" size={24} color="#FFFFFF" />
                  <Text style={styles.diagnosticButtonText}>Test OCR Connection</Text>
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
                        Good lighting for accurate data capture
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* ID Photo Preview */}
                <View style={[styles.cameraCard, { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: idPhotoPreview }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <Text style={[styles.cameraTitle, { color: colors.text }]}>
                    ID Document Preview
                  </Text>
                  <Text style={[styles.cameraSubtitle, { color: colors.textSecondary }]}>
                    Review the captured ID document
                  </Text>
                </View>

                {/* Confirm / Retake Buttons */}
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.captureButton, { backgroundColor: '#4CAF50' }]}
                    onPress={handleConfirmIdPhoto}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
                    <Text style={styles.captureButtonText}>Confirm ID</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.captureButton, { backgroundColor: '#FF9800' }]}
                    onPress={handleRetakeIdPhoto}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="refresh" size={28} color="#FFFFFF" />
                    <Text style={styles.captureButtonText}>Retake ID</Text>
                  </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={[styles.instructionsCard, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.instructionsTitle, { color: '#2E7D32' }]}>
                    ✓ ID Captured
                  </Text>
                  <Text style={[styles.instructionText, { color: '#388E3C', marginTop: 8 }]}>
                    ID document captured successfully. Proceed to extract personal information.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {visitorType === 'enrollee' ? (
              /* Enrollee Flow - Confirm Info & Generate Master QR Code */
              <>
                {!masterQrCode ? (
                  <>
                    {/* Enrollee Information - Always Editable */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.detailsTitle, { color: colors.text }]}>
                        Enrollee Information
                      </Text>

                      {/* Extraction Confidence Alert */}
                      {extractionConfidence && !ocrExtractionFailed && (
                        <View
                          style={[
                            styles.confidenceAlert,
                            {
                              backgroundColor:
                                extractionConfidence === 'high'
                                  ? '#E8F5E9'
                                  : extractionConfidence === 'medium'
                                  ? '#FFF3E0'
                                  : '#FFEBEE',
                              borderLeftColor:
                                extractionConfidence === 'high'
                                  ? '#4CAF50'
                                  : extractionConfidence === 'medium'
                                  ? '#FF9800'
                                  : '#F44336',
                            },
                          ]}
                        >
                          <MaterialIcons
                            name={
                              extractionConfidence === 'high'
                                ? 'check-circle'
                                : 'warning'
                            }
                            size={18}
                            color={
                              extractionConfidence === 'high'
                                ? '#4CAF50'
                                : extractionConfidence === 'medium'
                                ? '#FF9800'
                                : '#F44336'
                            }
                          />
                          <Text
                            style={[
                              styles.confidenceText,
                              {
                                color:
                                  extractionConfidence === 'high'
                                    ? '#2E7D32'
                                    : extractionConfidence === 'medium'
                                    ? '#E65100'
                                    : '#C62828',
                                marginLeft: 8,
                              },
                            ]}
                          >
                            {extractionConfidence === 'high'
                              ? 'High Confidence - Data extracted accurately'
                              : extractionConfidence === 'medium'
                              ? 'Medium Confidence - Please verify the fields'
                              : 'Low Confidence - Please review and correct'}
                          </Text>
                        </View>
                      )}

                      {ocrExtractionFailed && (
                        <View
                          style={[
                            styles.confidenceAlert,
                            {
                              backgroundColor: '#FFEBEE',
                              borderLeftColor: '#F44336',
                            },
                          ]}
                        >
                          <MaterialIcons name="error" size={18} color="#F44336" />
                          <Text
                            style={[
                              styles.confidenceText,
                              {
                                color: '#C62828',
                                marginLeft: 8,
                              },
                            ]}
                          >
                            Manual Entry Required - Please fill in the details below
                          </Text>
                        </View>
                      )}

                      {/* Hologram/Glare Warning - Low or Medium Confidence */}
                      {extractionConfidence && extractionConfidence !== 'high' && !ocrExtractionFailed && (
                        <View
                          style={[
                            styles.confidenceAlert,
                            {
                              backgroundColor: '#FFF3E0',
                              borderLeftColor: '#FF9800',
                            },
                          ]}
                        >
                          <MaterialIcons name="info" size={18} color="#FF9800" />
                          <Text
                            style={[
                              styles.confidenceText,
                              {
                                color: '#E65100',
                                marginLeft: 8,
                              },
                            ]}
                          >
                            Some ID details could not be extracted clearly. Please verify and edit the fields if needed.
                          </Text>
                        </View>
                      )}

                      {/* Editable Fields Note */}
                      <Text
                        style={[
                          styles.editableNote,
                          { 
                            color: ocrExtractionFailed ? '#C62828' : colors.textSecondary, 
                            marginBottom: 12, 
                            fontSize: ocrExtractionFailed ? 13 : 12,
                            fontWeight: ocrExtractionFailed ? '600' : '400',
                          },
                        ]}
                      >
                        {ocrExtractionFailed 
                          ? '✏️ Please enter your information below. All three fields are required: First Name, Last Name, and Address.'
                          : '✎ All fields are editable. Please correct any inaccurate information.'
                        }
                      </Text>

                      {/* First Name - ALWAYS EDITABLE */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          First Name
                        </Text>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              color: colors.text,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                            },
                          ]}
                          placeholder="Enter first name"
                          placeholderTextColor={colors.textSecondary}
                          value={extractedFirstName}
                          onChangeText={setExtractedFirstName}
                        />
                      </View>

                      {/* Last Name - ALWAYS EDITABLE */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Last Name
                        </Text>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              color: colors.text,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                            },
                          ]}
                          placeholder="Enter last name"
                          placeholderTextColor={colors.textSecondary}
                          value={extractedLastName}
                          onChangeText={setExtractedLastName}
                        />
                      </View>

                      {/* Address - ALWAYS EDITABLE */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Address
                        </Text>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              color: colors.text,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                              minHeight: 80,
                              textAlignVertical: 'top',
                            },
                          ]}
                          placeholder="Enter address"
                          placeholderTextColor={colors.textSecondary}
                          value={extractedAddress}
                          onChangeText={setExtractedAddress}
                          multiline
                          numberOfLines={3}
                        />
                      </View>

                      {/* Pass Number - EDITABLE */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Pass Number
                        </Text>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              color: colors.text,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                            },
                          ]}
                          placeholder="Enter pass number"
                          placeholderTextColor={colors.textSecondary}
                          value={passNumber}
                          onChangeText={setPassNumber}
                        />
                      </View>

                      {/* Control Number - READ-ONLY */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Control Number
                        </Text>
                        <View
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                              backgroundColor: colors.background,
                              justifyContent: 'center',
                            },
                          ]}
                        >
                          <Text style={[styles.fieldValue, { color: colors.text, fontSize: 16, fontWeight: '600' }]}>
                            {controlNumber || 'Generating...'}
                          </Text>
                        </View>
                        <Text style={[styles.editableNote, { color: colors.textSecondary, marginTop: 4, fontSize: 11 }]}>
                          Auto-generated by system
                        </Text>
                      </View>

                      {/* Contact Number - EDITABLE */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Contact Number
                        </Text>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            {
                              borderColor: colors.border,
                              borderWidth: 1,
                              color: colors.text,
                              marginTop: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderRadius: 8,
                            },
                          ]}
                          placeholder="Enter phone number (e.g., 09xxxxxxxxx)"
                          placeholderTextColor={colors.textSecondary}
                          value={contactNumber}
                          onChangeText={setContactNumber}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    {/* Generate Master QR Code Button */}
                    <TouchableOpacity
                      style={[styles.generateButton, { backgroundColor: colors.primary, marginHorizontal: 20 }]}
                      onPress={handleCreateEnrollee}
                      disabled={isCreatingEnrollee}
                      activeOpacity={0.8}
                    >
                      {isCreatingEnrollee ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialIcons name="qr-code-2" size={24} color="#FFFFFF" />
                          <Text style={styles.generateButtonText}>Generate Master QR Code</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Master QR Code Display */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.detailsTitle, { color: colors.text }]}>
                        Enrollment Complete ✓
                      </Text>

                      <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 2 }]}>
                        <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                          Enrollee ID
                        </Text>
                        <Text style={[styles.enrolleeInfoValue, { color: colors.primary }]}>
                          {enrolleeId}
                        </Text>
                      </View>

                      <View style={styles.enrolleeDetailsGrid}>
                        <View style={styles.enrolleeDetailItem}>
                          <Text style={[styles.enrolleeDetailLabel, { color: colors.textSecondary }]}>
                            Name
                          </Text>
                          <Text style={[styles.enrolleeDetailValue, { color: colors.text }]}>
                            {extractedFirstName} {extractedLastName}
                          </Text>
                        </View>

                        <View style={styles.enrolleeDetailItem}>
                          <Text style={[styles.enrolleeDetailLabel, { color: colors.textSecondary }]}>
                            Address
                          </Text>
                          <Text style={[styles.enrolleeDetailValue, { color: colors.text }]}>
                            {extractedAddress}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Master QR Code Section */}
                    <View style={[styles.qrCodeContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                      <View style={styles.qrCodeBox}>
                        <Text style={[styles.qrCodeTitle, { color: colors.primary }]}>
                          Enrollee QR Code
                        </Text>
                        <View style={[styles.qrCodePlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <MaterialIcons name="qr-code-2" size={80} color={colors.primary} />
                        </View>
                        <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                          <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                            Enrollee ID
                          </Text>
                          <Text style={[styles.qrCodeText, { color: colors.text }]}>
                            {enrolleeId}
                          </Text>
                        </View>
                        <Text style={[styles.qrCodeLabel, { color: colors.textSecondary }]}>
                          Scan for enrollment status
                        </Text>
                      </View>

                      <View style={[styles.qrCodeInfo, { backgroundColor: '#E3F2FD', borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
                        <MaterialIcons name="info" size={18} color={colors.primary} />
                        <Text style={[styles.qrCodeInfoText, { color: colors.primary, marginLeft: 10 }]}>
                          Offices scan this QR code when the enrollee visits. This updates the activity status in real-time.
                        </Text>
                      </View>
                    </View>

                    {/* Enrollment Steps List - From Database */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.detailsTitle, { color: colors.text }]}>
                        Enrollment Status
                      </Text>

                      <View style={styles.stepsList}>
                        {enrolleeSteps && enrolleeSteps.length > 0 ? (
                          enrolleeSteps.map((step, index) => {
                            const isCompleted = step.status === 'completed';
                            const bgColor = isCompleted ? '#4CAF50' : '#FF9800';
                            const statusText = isCompleted ? '✓ Completed' : 'Pending';
                            const statusColor = isCompleted ? '#4CAF50' : '#FF9800';

                            return (
                              <View key={index} style={styles.stepsListItem}>
                                <View style={[styles.stepsListNumber, { backgroundColor: bgColor }]}>
                                  <MaterialIcons 
                                    name={isCompleted ? 'check' : 'schedule'} 
                                    size={20} 
                                    color="#FFFFFF" 
                                  />
                                </View>
                                <View style={styles.stepsListContent}>
                                  <Text style={[styles.stepsListTitle, { color: colors.text }]}>
                                    {step.step_name}
                                  </Text>
                                  <Text style={[styles.stepsListStatus, { color: statusColor }]}>
                                    {statusText}
                                  </Text>
                                </View>
                              </View>
                            );
                          })
                        ) : (
                          <Text style={[styles.instructionText, { color: colors.textSecondary, marginVertical: 10 }]}>
                            Loading enrollment steps...
                          </Text>
                        )}
                      </View>

                      {/* Overall Status */}
                      <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 1, marginTop: 16 }]}>
                        <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                          Overall Status
                        </Text>
                        <Text style={[styles.enrolleeInfoValue, { color: colors.primary }]}>
                          PENDING
                        </Text>
                        <Text style={[styles.instructionText, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                          Updates when offices scan the QR code
                        </Text>
                      </View>
                    </View>

                    {/* Complete Enrollment Button */}
                    <TouchableOpacity
                      style={[styles.generateButton, { backgroundColor: '#4CAF50', marginHorizontal: 20 }]}
                      onPress={() => {
                        Alert.alert(
                          'Enrollment Successful',
                          `Enrollee ${extractedFirstName} ${extractedLastName}\nID: ${enrolleeId}\n\nMaster QR Code generated and ready for office scans.`,
                          [
                            {
                              text: 'OK',
                              onPress: () => router.back(),
                            },
                          ]
                        );
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>Complete & Return</Text>
                    </TouchableOpacity>
                  </>
                )}
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
  diagnosticButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  diagnosticButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonGroup: {
    gap: 12,
    marginBottom: 20,
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
  confidenceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  editableNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
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
  detailsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  photoDisplaySection: {
    paddingVertical: 12,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  displayPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  enrolleeInfoBox: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  enrolleeInfoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  enrolleeInfoValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  enrolleeDetailsGrid: {
    gap: 12,
  },
  enrolleeDetailItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  enrolleeDetailLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  enrolleeDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  qrCodeBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  qrCodePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 12,
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
  qrCodeInfo: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    paddingLeft: 12,
  },
  qrCodeInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  stepsList: {
    gap: 10,
    marginTop: 12,
  },
  stepsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  stepsListNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepsListContent: {
    flex: 1,
  },
  stepsListTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepsListStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
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
});
