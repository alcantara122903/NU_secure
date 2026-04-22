import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cameraService } from '@/services/camera';
import { officeService } from '@/services/office';
import { contractorService, enrolleeService, normalVisitorService } from '@/services/visitor';
import { runOCRDiagnostics } from '@/utils/diagnostics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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
  const [selectedDestinationOffices, setSelectedDestinationOffices] = useState<string[]>([]);
  const [workLocation, setWorkLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  
  // Normal Visitor Step 1 Fields
  const [normalVisitorFirstName, setNormalVisitorFirstName] = useState('');
  const [normalVisitorLastName, setNormalVisitorLastName] = useState('');
  const [normalVisitorHouseNo, setNormalVisitorHouseNo] = useState('');
  const [normalVisitorStreet, setNormalVisitorStreet] = useState('');
  const [normalVisitorBarangay, setNormalVisitorBarangay] = useState('');
  const [normalVisitorCity, setNormalVisitorCity] = useState('');
  const [normalVisitorProvince, setNormalVisitorProvince] = useState('');
  const [normalVisitorRegion, setNormalVisitorRegion] = useState('');
  const [normalVisitorContactNo, setNormalVisitorContactNo] = useState('');
  const [normalVisitorReasonForVisit, setNormalVisitorReasonForVisit] = useState('');
  
  // Contractor Step 1 Fields
  const [contractorFirstName, setContractorFirstName] = useState('');
  const [contractorLastName, setContractorLastName] = useState('');
  const [contractorHouseNo, setContractorHouseNo] = useState('');
  const [contractorStreet, setContractorStreet] = useState('');
  const [contractorBarangay, setContractorBarangay] = useState('');
  const [contractorCity, setContractorCity] = useState('');
  const [contractorProvince, setContractorProvince] = useState('');
  const [contractorRegion, setContractorRegion] = useState('');
  const [contractorContactNo, setContractorContactNo] = useState('');
  const [selectedContractorDestinationOffices, setSelectedContractorDestinationOffices] = useState<string[]>([]);
  const [contractorPassNumber, setContractorPassNumber] = useState('');
  const [contractorControlNumber, setContractorControlNumber] = useState('');
  const [contractorReasonForVisit, setContractorReasonForVisit] = useState('');
  
  // Step 3: Face Photo
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  
  // Step 1: ID Document Capture
  const [capturedIdPhoto, setCapturedIdPhoto] = useState<string | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [isCapturingIdPhoto, setIsCapturingIdPhoto] = useState(false);
  
  // Step 2: Enrollee Info (extracted from ID)
  const [extractedFirstName, setExtractedFirstName] = useState('');
  const [extractedLastName, setExtractedLastName] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  // Break down address into components
  const [addressHouseNo, setAddressHouseNo] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressBarangay, setAddressBarangay] = useState('');
  const [addressMunicipality, setAddressMunicipality] = useState('');
  const [addressProvince, setAddressProvince] = useState('');
  const [addressRegion, setAddressRegion] = useState('');
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
    'Admissions Office',
    'Bulldogs Exchange',
    'Faculty Office',
    'Guidance Services Office',
    'Health Services Office',
    'HR Office',
    'Information Technology Systems Office',
    "Registrar's Office",
    'Student Development and Activities Office',
    'Treasury Office',
  ];

  // Handle destination office checkbox toggle
  const toggleDestinationOffice = (office: string) => {
    setSelectedDestinationOffices(prev =>
      prev.includes(office)
        ? prev.filter(o => o !== office)
        : [...prev, office]
    );
  };

  // Generate QR code data when reaching step 2 for enrollees
  useEffect(() => {
    if (step === 2 && visitorType === 'enrollee' && !qrCodeData) {
      const enrolleeQRData = btoa(JSON.stringify({
        visitorName,
        visitorType: 'enrollee',
        timestamp: new Date().toISOString(),
        registrationId: `ENR-${Date.now()}`,
      }));
      setQrCodeData(enrolleeQRData);
    }
  }, [step, visitorType, qrCodeData, visitorName]);

  // Generate pass number and control number when entering Step 2
  useEffect(() => {
    if (step === 2 && !controlNumber) {
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

  const handleConfirmPhoto = async () => {
    if (!capturedFacePhoto) {
      Alert.alert('Error', 'No photo captured');
      return;
    }

    console.log('✅ Face photo confirmed, saving registration...');
    
    try {
      setIsCreatingEnrollee(true);

      if (visitorType === 'enrollee') {
        handleCreateEnrollee();
      } else if (visitorType === 'contractor') {
        // Get office IDs for the selected destination offices
        const selectedOfficeIds = await officeService.getOfficeIds(selectedContractorDestinationOffices);

        if (selectedOfficeIds.length === 0) {
          Alert.alert('Error', 'Could not find selected offices. Please try again.');
          setIsCreatingEnrollee(false);
          return;
        }

        // Use the first selected office as primary destination
        const primaryOfficeId = selectedOfficeIds[0];

        // Register contractor and generate QR pass
        const result = await contractorService.registerAndGenerateQRPass({
          firstName: contractorFirstName,
          lastName: contractorLastName,
          contactNo: contractorContactNo,
          addressHouseNo: contractorHouseNo,
          addressStreet: contractorStreet,
          addressBarangay: contractorBarangay,
          addressMunicipality: contractorCity,
          addressProvince: contractorProvince,
          addressRegion: contractorRegion,
          destinationOfficeId: primaryOfficeId,
          idPassNumber: contractorPassNumber,
          reasonForVisit: contractorReasonForVisit,
          facePhotoUri: capturedFacePhoto || undefined,
          idPhotoUri: capturedIdPhoto || undefined,
        });

        if (result) {
          // Prepare ticket data for display
          const ticketData = {
            type: 'contractor',
            qrToken: result.qrToken,
            passNumber: result.passNumber,
            controlNumber: result.controlNumber,
            visitorId: result.visitorId,
            visitId: result.visitId,
            contractorId: result.contractorId,
            firstName: contractorFirstName,
            lastName: contractorLastName,
            contactNo: contractorContactNo,
            address: `${contractorHouseNo} ${contractorStreet}, ${contractorBarangay}, ${contractorCity}, ${contractorProvince}`,
            offices: selectedContractorDestinationOffices.map((name, index) => ({ id: selectedOfficeIds[index] || index, name })),
          };

          // Navigate to unified QR ticket display
          router.push({
            pathname: '/guard/qr-ticket',
            params: { data: JSON.stringify(ticketData) },
          });
        } else {
          Alert.alert('Error', 'Failed to register contractor. Please try again.');
        }
      } else if (visitorType === 'normal') {
        // Get office ID for the selected destination office
        const selectedOfficeIds = await officeService.getOfficeIds(selectedDestinationOffices);

        if (selectedOfficeIds.length === 0) {
          Alert.alert('Error', 'Could not find selected offices. Please try again.');
          setIsCreatingEnrollee(false);
          return;
        }

        // Register normal visitor and generate QR ticket
        const result = await normalVisitorService.registerAndGenerateQRTicket({
          firstName: normalVisitorFirstName,
          lastName: normalVisitorLastName,
          contactNo: normalVisitorContactNo,
          addressHouseNo: normalVisitorHouseNo,
          addressStreet: normalVisitorStreet,
          addressBarangay: normalVisitorBarangay,
          addressMunicipality: normalVisitorCity,
          addressProvince: normalVisitorProvince,
          addressRegion: normalVisitorRegion,
          reasonForVisit: normalVisitorReasonForVisit,
          facePhotoUri: capturedFacePhoto || undefined,
          idPhotoUri: capturedIdPhoto || undefined,
          selectedOfficeIds: selectedOfficeIds,
        });

        if (result) {
          // Prepare ticket data for display
          const ticketData = {
            type: 'normal',
            qrToken: result.qrToken,
            passNumber: result.passNumber,
            controlNumber: result.controlNumber,
            visitorId: result.visitorId,
            visitId: result.visitId,
            firstName: normalVisitorFirstName,
            lastName: normalVisitorLastName,
            contactNo: normalVisitorContactNo,
            address: `${normalVisitorHouseNo} ${normalVisitorStreet}, ${normalVisitorBarangay}, ${normalVisitorCity}, ${normalVisitorProvince}`,
            offices: selectedDestinationOffices.map((name, index) => ({ id: selectedOfficeIds[index] || index, name })),
          };

          // Navigate to unified QR ticket display
          router.push({
            pathname: '/guard/qr-ticket',
            params: { data: JSON.stringify(ticketData) },
          });
        } else {
          Alert.alert('Error', 'Failed to register visitor. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving registration:', error);
      Alert.alert('Error', 'Failed to save registration. Please try again.');
    } finally {
      setIsCreatingEnrollee(false);
    }
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
        
        // Set address components for Enrollee
        setAddressHouseNo(extractedData.addressHouseNo || '');
        setAddressStreet(extractedData.addressStreet || '');
        setAddressBarangay(extractedData.addressBarangay || '');
        setAddressMunicipality(extractedData.addressCityMunicipality || '');
        setAddressProvince(extractedData.addressProvince || '');
        setAddressRegion(extractedData.addressRegion || '');
        
        // Also populate Normal Visitor fields with extracted data
        setNormalVisitorFirstName(extractedData.firstName || '');
        setNormalVisitorLastName(extractedData.lastName || '');
        setNormalVisitorHouseNo(extractedData.addressHouseNo || '');
        setNormalVisitorStreet(extractedData.addressStreet || '');
        setNormalVisitorBarangay(extractedData.addressBarangay || '');
        setNormalVisitorCity(extractedData.addressCityMunicipality || '');
        setNormalVisitorProvince(extractedData.addressProvince || '');
        setNormalVisitorRegion(extractedData.addressRegion || '');
        
        // Also populate Contractor fields with extracted data
        setContractorFirstName(extractedData.firstName || '');
        setContractorLastName(extractedData.lastName || '');
        setContractorHouseNo(extractedData.addressHouseNo || '');
        setContractorStreet(extractedData.addressStreet || '');
        setContractorBarangay(extractedData.addressBarangay || '');
        setContractorCity(extractedData.addressCityMunicipality || '');
        setContractorProvince(extractedData.addressProvince || '');
        setContractorRegion(extractedData.addressRegion || '');
        
        setExtractionConfidence(extractedData.confidence || null);
        setOcrExtractionFailed(false);
        
        const extractedFields: string[] = [];
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
    
    // Proceed to Step 2
    setStep(2);
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
    // Validate required fields - at least firstName and lastName are required
    const missingFields: string[] = [];
    if (!extractedFirstName?.trim()) missingFields.push('First Name');
    if (!extractedLastName?.trim()) missingFields.push('Last Name');
    // At least one address component should be filled
    const hasAddressData = addressHouseNo?.trim() || addressStreet?.trim() || 
                          addressBarangay?.trim() || addressMunicipality?.trim() || 
                          addressProvince?.trim() || addressRegion?.trim();
    if (!hasAddressData) missingFields.push('At least one Address component');

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
        addressHouseNo,
        addressStreet,
        addressBarangay,
        addressMunicipality,
        addressProvince,
        addressRegion,
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
        // Separate address components
        addressHouseNo,
        addressStreet,
        addressBarangay,
        addressMunicipality,
        addressProvince,
        addressRegion,
        contactNo: contactNumber || undefined,
        facePhotoUri: capturedFacePhoto || undefined,  // Use data URL with base64
        idPhotoUri: capturedIdPhoto || undefined,      // Use data URL with base64
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

  // Generate HTML content for QR code ticket
  const generateQRTicketHTML = async () => {
    try {
      // Generate QR code URL using online API (no canvas needed)
      const enrolleeIdStr = String(enrolleeId);
      console.log('📱 Generating QR code for enrollee ID:', enrolleeIdStr);
      
      // Using qrserver.com API to generate QR code
      const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(enrolleeIdStr)}`;
      
      console.log('✅ QR Code URL generated:', qrCodeImageUrl);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8f9fa;
                padding: 20px;
              }
              .ticket {
                max-width: 700px;
                margin: 0 auto;
                background-color: white;
                padding: 40px 30px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                text-align: center;
              }
              .header {
                font-size: 28px;
                font-weight: bold;
                color: #003D99;
                margin-bottom: 10px;
                letter-spacing: 1px;
              }
              .status {
                color: #4CAF50;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 30px;
              }
              .qr-section {
                margin: 40px 0;
                padding: 30px;
                background-color: #f5f7fa;
                border-radius: 10px;
                border: 2px dashed #003D99;
              }
              .qr-label {
                color: #666;
                font-size: 13px;
                margin-bottom: 15px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .qr-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 20px 0;
                background-color: white;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #ddd;
              }
              .qr-image {
                width: 250px;
                height: 250px;
                display: block;
              }
              .qr-note {
                font-size: 12px;
                color: #666;
                margin-top: 15px;
                font-style: italic;
              }
              .enrollee-id {
                font-size: 20px;
                font-weight: bold;
                color: #FFFFFF;
                background: linear-gradient(135deg, #003D99 0%, #0052CC 100%);
                padding: 15px 20px;
                border-radius: 8px;
                margin: 25px 0;
                letter-spacing: 1px;
              }
              .info-section {
                margin: 30px 0;
                text-align: left;
              }
              .info-item {
                margin: 12px 0;
                padding: 12px 15px;
                background-color: #f9f9f9;
                border-left: 4px solid #003D99;
                border-radius: 4px;
              }
              .info-label {
                font-size: 11px;
                color: #666;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
              }
              .info-value {
                font-size: 15px;
                color: #333;
                font-weight: 500;
              }
              .footer {
                font-size: 12px;
                color: #999;
                margin-top: 35px;
                padding-top: 20px;
                border-top: 1px solid #eee;
              }
              .footer p {
                margin: 6px 0;
                line-height: 1.5;
              }
              .divider {
                height: 2px;
                background-color: #e0e0e0;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">ENROLLMENT PASS</div>
              <div class="status">✓ Registration Confirmed</div>
              
              <div class="qr-section">
                <div class="qr-label">QR Code - Enrollment Status</div>
                <div class="qr-container">
                  <img src="${qrCodeImageUrl}" alt="QR Code for Enrollment" class="qr-image" />
                </div>
                <div class="qr-note">Scan this code to check enrollment status at any office</div>
              </div>

              <div class="enrollee-id">ID: ${enrolleeIdStr}</div>

              <div class="info-section">
                <div class="info-item">
                  <div class="info-label">Full Name</div>
                  <div class="info-value">${extractedFirstName} ${extractedLastName}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">Address</div>
                  <div class="info-value">${extractedAddress || 'N/A'}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">Pass Number</div>
                  <div class="info-value">${passNumber}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">Control Number</div>
                  <div class="info-value">${controlNumber}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">Registration Date</div>
                  <div class="info-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>

              <div class="divider"></div>

              <div class="footer">
                <p><strong>Important:</strong> This pass is required for enrollment verification.</p>
                <p>Please present this document at each required office for the enrollment process.</p>
                <p style="margin-top: 15px; color: #aaa; font-size: 10px;">Issued by NU-SECURE Visitor Management System</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      console.log('📄 HTML generated successfully for PDF');
      return html;
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      // Fallback HTML without QR code
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
              .ticket { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; }
              .header { font-size: 24px; font-weight: bold; color: #003D99; margin-bottom: 10px; }
              .status { color: #4CAF50; font-size: 14px; margin-bottom: 30px; }
              .enrollee-id { font-size: 18px; font-weight: bold; color: #003D99; background-color: #E3F2FD; padding: 10px; border-radius: 5px; margin: 15px 0; }
              .info-item { margin: 15px 0; padding: 10px; background-color: #f9f9f9; border-left: 4px solid #003D99; }
              .error-note { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-top: 20px; color: #856404; }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">ENROLLMENT PASS</div>
              <div class="status">✓ Registration Confirmed</div>
              <div class="enrollee-id">ID: ${enrolleeId}</div>
              <div class="info-item"><strong>Name:</strong> ${extractedFirstName} ${extractedLastName}</div>
              <div class="info-item"><strong>Address:</strong> ${extractedAddress || 'N/A'}</div>
              <div class="info-item"><strong>Pass Number:</strong> ${passNumber}</div>
              <div class="info-item"><strong>Control Number:</strong> ${controlNumber}</div>
              <div class="error-note">Note: QR Code could not be generated. Please contact support if you need the QR code.</div>
            </div>
          </body>
        </html>
      `;
      return html;
    }
  };

  // Handle Print QR Code
  const handlePrintQRCode = async () => {
    try {
      console.log('🖨️ Preparing to print QR code...');
      const html = await generateQRTicketHTML();
      
      // On web and mobile, generate PDF and open print dialog
      if (Platform.OS === 'web') {
        // For web, open print dialog directly
        try {
          await Print.printAsync({
            html: html,
          });
          console.log('✅ Print dialog opened');
          Alert.alert('Success', 'Print dialog opened. Use your browser\'s print function.');
        } catch (webError) {
          console.warn('Web print fallback:', webError);
          // Fallback: generate PDF and download
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: `Enrollee_${enrolleeId}_QR_Code_Print`,
            });
          }
        }
      } else {
        // For mobile, generate PDF then print
        const { uri } = await Print.printToFileAsync({ html });
        // Open share dialog so user can print or save
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Print Enrollee_${enrolleeId}_QR_Code`,
          });
        } else {
          await Print.printAsync({ html });
        }
        console.log('✅ Print dialog opened');
        Alert.alert('Success', 'Print dialog opened');
      }
    } catch (error) {
      console.error('❌ Print error:', error);
      Alert.alert('Print Not Available', 'Please use the Download button to save the file, then print it manually.');
    }
  };

  // Handle Download QR Code
  const handleDownloadQRCode = async () => {
    try {
      console.log('📥 Preparing to download QR code...');
      const html = await generateQRTicketHTML();
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: html,
      });

      console.log('📄 PDF created at:', uri);

      // Share/Download the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Enrollee_${enrolleeId}_QR_Code.pdf`,
          UTI: 'com.adobe.pdf',
        });
        console.log('✅ Download/Share completed');
        Alert.alert('Success', 'QR code ticket downloaded/shared successfully');
      } else {
        Alert.alert('Info', 'Download not available on this device');
      }
    } catch (error) {
      console.error('❌ Download error:', error);
      Alert.alert('Error', 'Failed to download QR code. Please try again.');
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
        {step === 3 && (
          <>
            {masterQrCode ? (
              <>
                {/* === QR CODE TICKET DISPLAY === */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.detailsTitle, { color: colors.text }]}>
                    Registration Complete ✓
                  </Text>

                  {visitorType === 'enrollee' && (
                    <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 2 }]}>
                      <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                        Enrollee ID
                      </Text>
                      <Text style={[styles.enrolleeInfoValue, { color: colors.primary }]}>
                        {enrolleeId}
                      </Text>
                    </View>
                  )}

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
                        Type
                      </Text>
                      <Text style={[styles.enrolleeDetailValue, { color: colors.text }]}>
                        {visitorTypeInfo.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Master QR Code Section */}
                <View style={[styles.qrCodeContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                  <View style={styles.qrCodeBox}>
                    <Text style={[styles.qrCodeTitle, { color: colors.primary }]}>
                      QR Ticket
                    </Text>
                    <View style={[styles.qrCodePlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <MaterialIcons name="qr-code-2" size={80} color={colors.primary} />
                    </View>
                    
                    {/* QR Token */}
                    <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                      <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                        QR Token
                      </Text>
                      <Text style={[styles.qrCodeText, { color: colors.text, fontFamily: 'monospace', fontSize: 11 }]} numberOfLines={2}>
                        {masterQrCode ? masterQrCode.substring(0, 50) + '...' : 'Generating...'}
                      </Text>
                    </View>

                    {/* Pass Number */}
                    <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}>
                      <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                        Pass Number
                      </Text>
                      <Text style={[styles.qrCodeText, { color: colors.primary, fontWeight: '700' }]}>
                        {passNumber || 'Auto-generated'}
                      </Text>
                    </View>

                    {/* Control Number */}
                    <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}>
                      <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                        Control Number
                      </Text>
                      <Text style={[styles.qrCodeText, { color: colors.primary, fontWeight: '700' }]}>
                        {controlNumber || 'Auto-generated'}
                      </Text>
                    </View>
                    
                    <Text style={[styles.qrCodeLabel, { color: colors.textSecondary }]}>
                      Scan for visitor information
                    </Text>
                  </View>

                  <View style={[styles.qrCodeInfo, { backgroundColor: '#E3F2FD', borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
                    <MaterialIcons name="info" size={18} color={colors.primary} />
                    <Text style={[styles.qrCodeInfoText, { color: colors.primary, marginLeft: 10 }]}>
                      Offices scan this QR code to log visitor activity.
                    </Text>
                  </View>
                </View>

                {/* Download & Print Buttons */}
                <View style={styles.actionButtonsContainer}>
                  {/* Download Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#2196F3', flex: 1, marginRight: 10 }]}
                    onPress={handleDownloadQRCode}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="download" size={22} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Download</Text>
                  </TouchableOpacity>

                  {/* Print Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#FF9800', flex: 1, marginLeft: 10 }]}
                    onPress={handlePrintQRCode}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="print" size={22} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Print</Text>
                  </TouchableOpacity>
                </View>

                {/* Complete Registration Button */}
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: '#4CAF50', marginHorizontal: 20 }]}
                  onPress={() => {
                    Alert.alert(
                      'Registration Successful',
                      `Visitor: ${extractedFirstName} ${extractedLastName}\nType: ${visitorTypeInfo.label}\n\nQR Ticket generated and ready.`,
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
                  <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
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
                        disabled={isCreatingEnrollee}
                        activeOpacity={0.8}
                      >
                        {isCreatingEnrollee ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
                            <Text style={styles.captureButtonText}>Confirm Photo</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.captureButton, { backgroundColor: '#FF9800' }]}
                        onPress={handleRetakePhoto}
                        disabled={isCreatingEnrollee}
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
                        {isCreatingEnrollee ? '⏳ Processing...' : 'This photo will be used for visitor verification. Ensure the face is clearly visible and well-lit.'}
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </>
        )}

        {step === 1 && (
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

        {step === 2 && (
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

                      {/* ========== FIELD ORDER: As Requested ========== */}

                      {/* 1. First Name */}
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

                      {/* 2. Last Name */}
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

                      {/* 3. House No */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          House No.
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
                          placeholder="e.g., 123"
                          placeholderTextColor={colors.textSecondary}
                          value={addressHouseNo}
                          onChangeText={setAddressHouseNo}
                        />
                      </View>

                      {/* 4. Street */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Street
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
                          placeholder="e.g., Main Street"
                          placeholderTextColor={colors.textSecondary}
                          value={addressStreet}
                          onChangeText={setAddressStreet}
                        />
                      </View>

                      {/* 5. Barangay */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Barangay
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
                          placeholder="e.g., Gulod Itaas"
                          placeholderTextColor={colors.textSecondary}
                          value={addressBarangay}
                          onChangeText={setAddressBarangay}
                        />
                      </View>

                      {/* 6. City / Municipality */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          City / Municipality
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
                          placeholder="e.g., Batangas City"
                          placeholderTextColor={colors.textSecondary}
                          value={addressMunicipality}
                          onChangeText={setAddressMunicipality}
                        />
                      </View>

                      {/* 7. Province */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Province
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
                          placeholder="e.g., Batangas"
                          placeholderTextColor={colors.textSecondary}
                          value={addressProvince}
                          onChangeText={setAddressProvince}
                        />
                      </View>

                      {/* 8. Region */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Region
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
                          placeholder="e.g., CALABARZON"
                          placeholderTextColor={colors.textSecondary}
                          value={addressRegion}
                          onChangeText={setAddressRegion}
                        />
                      </View>

                      {/* 9. Contact No. */}
                      <View style={styles.detailField}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Contact No.
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

                      {/* Pass Number */}
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
                    </View>

                    {/* Continue to Photo Button - Instead of Generate QR */}
                    <TouchableOpacity
                      style={[styles.generateButton, { backgroundColor: colors.primary, marginHorizontal: 20 }]}
                      onPress={() => {
                        const missingFields: string[] = [];
                        if (!extractedFirstName?.trim()) missingFields.push('First Name');
                        if (!extractedLastName?.trim()) missingFields.push('Last Name');

                        if (missingFields.length > 0) {
                          Alert.alert(
                            '⚠️ Missing Required Information',
                            `Please fill in the following fields before proceeding:\n\n• ${missingFields.join('\n• ')}`,
                            [{ text: 'OK' }]
                          );
                          return;
                        }
                        console.log('✅ Proceeding to Step 3 (Face Photo)');
                        setStep(3);
                      }}
                      activeOpacity={0.8}
                    >
                      <>
                        <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                        <Text style={styles.generateButtonText}>Continue to Photo</Text>
                      </>
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
                        
                        {/* QR Token */}
                        <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                          <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                            QR Token
                          </Text>
                          <Text style={[styles.qrCodeText, { color: colors.text, fontFamily: 'monospace', fontSize: 11 }]} numberOfLines={2}>
                            {masterQrCode ? masterQrCode.substring(0, 50) + '...' : 'Generating...'}
                          </Text>
                        </View>

                        {/* Pass Number */}
                        <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}>
                          <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                            Pass Number
                          </Text>
                          <Text style={[styles.qrCodeText, { color: colors.primary, fontWeight: '700' }]}>
                            {passNumber || 'Auto-generated'}
                          </Text>
                        </View>

                        {/* Control Number */}
                        <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}>
                          <Text style={[styles.enrolleeInfoLabel, { color: colors.textSecondary }]}>
                            Control Number
                          </Text>
                          <Text style={[styles.qrCodeText, { color: colors.primary, fontWeight: '700' }]}>
                            {controlNumber || 'Auto-generated'}
                          </Text>
                        </View>

                        {/* Enrollee ID */}
                        <View style={[styles.enrolleeInfoBox, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}>
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

                    {/* Download & Print Buttons */}
                    <View style={styles.actionButtonsContainer}>
                      {/* Download Button */}
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#2196F3', flex: 1, marginRight: 10 }]}
                        onPress={handleDownloadQRCode}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="download" size={22} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Download</Text>
                      </TouchableOpacity>

                      {/* Print Button */}
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FF9800', flex: 1, marginLeft: 10 }]}
                        onPress={handlePrintQRCode}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="print" size={22} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Print</Text>
                      </TouchableOpacity>
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
            ) : visitorType === 'contractor' ? (
              /* Contractor Flow - Form Fields */
              <>
                {/* Contractor Details Card */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.detailsTitle, { color: colors.text }]}>
                    Contractor Information
                  </Text>

                  {/* 1. First Name */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      First Name
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="Enter first name"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorFirstName}
                      onChangeText={setContractorFirstName}
                    />
                  </View>

                  {/* 2. Last Name */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Last Name
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="Enter last name"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorLastName}
                      onChangeText={setContractorLastName}
                    />
                  </View>

                  {/* 3. House No */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      House No.
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., 123"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorHouseNo}
                      onChangeText={setContractorHouseNo}
                    />
                  </View>

                  {/* 4. Street */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Street
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., Main Street"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorStreet}
                      onChangeText={setContractorStreet}
                    />
                  </View>

                  {/* 5. Barangay */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Barangay
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., Gulod Itaas"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorBarangay}
                      onChangeText={setContractorBarangay}
                    />
                  </View>

                  {/* 6. City / Municipality */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      City / Municipality
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., Batangas City"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorCity}
                      onChangeText={setContractorCity}
                    />
                  </View>

                  {/* 7. Province */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Province
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., Batangas"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorProvince}
                      onChangeText={setContractorProvince}
                    />
                  </View>

                  {/* 8. Region - Auto-filled based on Province */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Region
                    </Text>
                    <View
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.background, justifyContent: 'center' }]}
                    >
                      <Text style={[styles.fieldValue, { color: colors.text, fontSize: 14 }]}>
                        {contractorRegion || 'Auto-filled from Province'}
                      </Text>
                    </View>
                  </View>

                  {/* 9. Phone Number */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Phone Number
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="e.g., 09xxxxxxxxx"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorContactNo}
                      onChangeText={setContractorContactNo}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Destination Office - Dropdown with Checkboxes */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
                    Destination Office
                  </Text>
                  <View style={[styles.checkboxGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {offices.map((office, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.checkboxItem,
                          {
                            borderBottomColor: index < offices.length - 1 ? colors.border : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          setSelectedContractorDestinationOffices(prev =>
                            prev.includes(office)
                              ? prev.filter(o => o !== office)
                              : [...prev, office]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: colors.primary,
                              backgroundColor: selectedContractorDestinationOffices.includes(office)
                                ? colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          {selectedContractorDestinationOffices.includes(office) && (
                            <MaterialIcons name="check" size={16} color="#FFFFFF" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.checkboxLabel,
                            {
                              color: colors.text,
                              fontWeight: selectedContractorDestinationOffices.includes(office) ? '600' : '400',
                            },
                          ]}
                        >
                          {office}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* ID Pass Number, Control Number, Reason For Visit Card */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  {/* ID Pass Number */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      ID Pass Number
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 }]}
                      placeholder="Enter or generate pass number"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorPassNumber}
                      onChangeText={setContractorPassNumber}
                    />
                  </View>

                  {/* Control Number - Auto Generated */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Control Number (Auto Generated)
                    </Text>
                    <View
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.background, justifyContent: 'center' }]}
                    >
                      <Text style={[styles.fieldValue, { color: colors.text, fontSize: 16, fontWeight: '600' }]}>
                        {contractorControlNumber || 'CTRL-' + Date.now().toString().slice(-8)}
                      </Text>
                    </View>
                  </View>

                  {/* Reason For Visit */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Reason For Visit
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { borderColor: colors.border, borderWidth: 1, color: colors.text, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, minHeight: 80 }]}
                      placeholder="Enter reason for visit"
                      placeholderTextColor={colors.textSecondary}
                      value={contractorReasonForVisit}
                      onChangeText={setContractorReasonForVisit}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>

                {/* Continue to Photo Button - Instead of Register Directly */}
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: colors.primary, marginHorizontal: 20 }]}
                  onPress={() => {
                    const missingFields: string[] = [];
                    if (!contractorFirstName?.trim()) missingFields.push('First Name');
                    if (!contractorLastName?.trim()) missingFields.push('Last Name');
                    if (selectedContractorDestinationOffices.length === 0) missingFields.push('Destination Office');
                    if (!contractorReasonForVisit?.trim()) missingFields.push('Reason For Visit');

                    if (missingFields.length > 0) {
                      Alert.alert(
                        '⚠️ Missing Required Information',
                        `Please fill in the following fields before proceeding:\n\n• ${missingFields.join('\n• ')}`,
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    console.log('✅ Proceeding to Step 3 (Face Photo) for Contractor');
                    setStep(3);
                  }}
                  activeOpacity={0.8}
                >
                  <>
                    <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                    <Text style={styles.generateButtonText}>Continue to Photo</Text>
                  </>
                </TouchableOpacity>
              </>
            ) : (
              /* Regular Visitor Flow - Form Fields */
              <>
                {/* Visitor Details Card */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>

                  {/* ========== NORMAL VISITOR STEP 3 FIELDS - EXACT ORDER (MATCHING ENROLLEE) ========== */}

                  {/* 1. First Name */}
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
                      value={normalVisitorFirstName}
                      onChangeText={setNormalVisitorFirstName}
                    />
                  </View>

                  {/* 2. Last Name */}
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
                      value={normalVisitorLastName}
                      onChangeText={setNormalVisitorLastName}
                    />
                  </View>

                  {/* 3. House No */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      House No.
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
                      placeholder="e.g., 123"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorHouseNo}
                      onChangeText={setNormalVisitorHouseNo}
                    />
                  </View>

                  {/* 4. Street */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Street
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
                      placeholder="e.g., Main Street"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorStreet}
                      onChangeText={setNormalVisitorStreet}
                    />
                  </View>

                  {/* 5. Barangay */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Barangay
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
                      placeholder="e.g., Gulod Itaas"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorBarangay}
                      onChangeText={setNormalVisitorBarangay}
                    />
                  </View>

                  {/* 6. City / Municipality */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      City / Municipality
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
                      placeholder="e.g., Batangas City"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorCity}
                      onChangeText={setNormalVisitorCity}
                    />
                  </View>

                  {/* 7. Province */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Province
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
                      placeholder="e.g., Batangas"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorProvince}
                      onChangeText={setNormalVisitorProvince}
                    />
                  </View>

                  {/* 8. Region */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Region
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
                      placeholder="e.g., CALABARZON"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorRegion}
                      onChangeText={setNormalVisitorRegion}
                    />
                  </View>

                  {/* 9. Contact No. */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Contact No.
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
                      placeholder="e.g., 09xxxxxxxxx"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorContactNo}
                      onChangeText={setNormalVisitorContactNo}
                      keyboardType="phone-pad"
                    />
                  </View>

                  {/* Reason For Visit */}
                  <View style={styles.detailField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Reason For Visit
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
                      placeholder="Enter reason for visit"
                      placeholderTextColor={colors.textSecondary}
                      value={normalVisitorReasonForVisit}
                      onChangeText={setNormalVisitorReasonForVisit}
                    />
                  </View>
                </View>

                {/* Destination Office - Checkbox Section */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
                    Destination Office
                  </Text>
                  <View style={[styles.checkboxGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {offices.map((office, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.checkboxItem,
                          {
                            borderBottomColor: index < offices.length - 1 ? colors.border : 'transparent',
                          },
                        ]}
                        onPress={() => toggleDestinationOffice(office)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: colors.primary,
                              backgroundColor: selectedDestinationOffices.includes(office)
                                ? colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          {selectedDestinationOffices.includes(office) && (
                            <MaterialIcons name="check" size={16} color="#FFFFFF" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.checkboxLabel,
                            {
                              color: colors.text,
                              fontWeight: selectedDestinationOffices.includes(office) ? '600' : '400',
                            },
                          ]}
                        >
                          {office}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Continue to Photo Button - Instead of Generate Directly */}
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: colors.primary, marginHorizontal: 20 }]}
                  onPress={() => {
                    const missingFields: string[] = [];
                    if (!normalVisitorFirstName?.trim()) missingFields.push('First Name');
                    if (!normalVisitorLastName?.trim()) missingFields.push('Last Name');
                    if (!normalVisitorContactNo?.trim()) missingFields.push('Contact No');
                    if (selectedDestinationOffices.length === 0) missingFields.push('Destination Office');
                    if (!normalVisitorReasonForVisit?.trim()) missingFields.push('Reason For Visit');

                    if (missingFields.length > 0) {
                      Alert.alert(
                        '⚠️ Missing Required Information',
                        `Please fill in the following fields before proceeding:\n\n• ${missingFields.join('\n• ')}`,
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    console.log('✅ Proceeding to Step 3 (Face Photo) for Normal Visitor');
                    setStep(3);
                  }}
                  activeOpacity={0.8}
                >
                  <>
                    <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                    <Text style={styles.generateButtonText}>Continue to Photo</Text>
                  </>
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
  checkboxGroup: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 12,
    gap: 0,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
