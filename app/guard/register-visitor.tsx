import { DataPrivacyNoticeModal } from "@/components/guard/data-privacy-notice-modal";
import { FaceCaptureStepScreen } from "@/components/guard/face-capture-step";
import { ReturningVisitorModal } from "@/components/guard/returning-visitor-modal";
import { VisitorInformationStepScreen } from "@/components/guard/visitor-information-step";
import { Colors } from "@/constants/colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { buildQRTicketPayloadV1, buildVisitorScanQrJson } from "@/lib/qr-ticket-payload";
import { cameraService, FACE_PHOTO_QUALITY, ID_PHOTO_QUALITY } from "@/services/camera";
import { supabase } from "@/services/database";
import { officeService } from "@/services/office";
import {
    contractorService,
    enrolleeService,
    normalVisitorService,
    visitorLookupService,
    type ReturningVisitorMatch,
} from "@/services/visitor";
import { runOCRDiagnostics } from "@/utils/diagnostics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Ban,
    Camera,
    ChevronRight,
    FileText,
    IdCard,
    Lightbulb,
    RefreshCw,
    Search,
    ShieldCheck,
    UploadCloud,
    Wrench,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

type PrivacyPendingAction = "captureId" | "uploadId" | "captureFace" | null;

function CaptureIdHeaderPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 260"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 45 }).map((_, index) => {
        const row = Math.floor(index / 9);
        const col = index % 9;
        return (
          <Circle
            key={index}
            cx={22 + col * 24}
            cy={16 + row * 24}
            r={3}
            fill="rgba(255,255,255,0.12)"
          />
        );
      })}
      <Path
        d="M-40 190 C50 125, 145 250, 270 170 C345 120, 395 130, 470 80"
        stroke="rgba(142,209,230,0.18)"
        strokeWidth="1.5"
        fill="none"
      />
      <Path
        d="M310 80
           C340 76, 360 64, 374 50
           C388 64, 408 76, 438 80
           L438 128
           C438 168, 406 196, 374 210
           C342 196, 310 168, 310 128
           Z"
        stroke="rgba(255,255,255,0.13)"
        strokeWidth="5"
        fill="none"
      />
      <Circle cx="374" cy="122" r="23" fill="rgba(255,255,255,0.05)" />
    </Svg>
  );
}

function CaptureIdActionButton({
  title,
  subtitle,
  icon,
  color,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        captureStepStyles.actionButton,
        { backgroundColor: color },
        disabled && { opacity: 0.65 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={captureStepStyles.actionIconBox}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : icon}
      </View>
      <View style={captureStepStyles.actionTextWrapper}>
        <Text style={captureStepStyles.actionTitle}>{title}</Text>
        <Text style={captureStepStyles.actionSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={24} color="#FFFFFF" strokeWidth={2.8} />
    </TouchableOpacity>
  );
}

function CaptureIdRequirementItem({
  icon,
  text,
  isLast = false,
}: {
  icon: React.ReactNode;
  text: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        captureStepStyles.requirementItem,
        isLast && captureStepStyles.requirementItemLast,
      ]}
    >
      <View style={captureStepStyles.requirementIconCircle}>{icon}</View>
      <Text style={captureStepStyles.requirementText}>{text}</Text>
    </View>
  );
}

export default function RegisterVisitorScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || "light"];
  const router = useRouter();
  const params = useLocalSearchParams();
  const visitorType = params.visitorType as string;

  const [step, setStep] = useState(1);
  const [visitorName, setVisitorName] = useState("John Smith");
  const [visitorDepartment, setVisitorDepartment] = useState("Engineering");
  const [visitorId, setVisitorId] = useState("ID978444");
  const [destinationOffice, setDestinationOffice] = useState("");
  const [selectedDestinationOffices, setSelectedDestinationOffices] = useState<
    string[]
  >([]);
  const [workLocation, setWorkLocation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyConsentGiven, setPrivacyConsentGiven] = useState(false);
  const [privacyPendingAction, setPrivacyPendingAction] =
    useState<PrivacyPendingAction>(null);

  // Normal Visitor Step 1 Fields
  const [normalVisitorFirstName, setNormalVisitorFirstName] = useState("");
  const [normalVisitorLastName, setNormalVisitorLastName] = useState("");
  const [normalVisitorHouseNo, setNormalVisitorHouseNo] = useState("");
  const [normalVisitorStreet, setNormalVisitorStreet] = useState("");
  const [normalVisitorBarangay, setNormalVisitorBarangay] = useState("");
  const [normalVisitorCity, setNormalVisitorCity] = useState("");
  const [normalVisitorProvince, setNormalVisitorProvince] = useState("");
  const [normalVisitorRegion, setNormalVisitorRegion] = useState("");
  const [normalVisitorContactNo, setNormalVisitorContactNo] = useState("");
  const [normalVisitorBirthday, setNormalVisitorBirthday] = useState("");
  const [normalVisitorPassNumber, setNormalVisitorPassNumber] = useState("");
  const [normalVisitorControlNumber, setNormalVisitorControlNumber] =
    useState("");
  const [normalVisitorReasonForVisit, setNormalVisitorReasonForVisit] =
    useState("");

  // Contractor Step 1 Fields
  const [contractorFirstName, setContractorFirstName] = useState("");
  const [contractorLastName, setContractorLastName] = useState("");
  const [contractorHouseNo, setContractorHouseNo] = useState("");
  const [contractorStreet, setContractorStreet] = useState("");
  const [contractorBarangay, setContractorBarangay] = useState("");
  const [contractorCity, setContractorCity] = useState("");
  const [contractorProvince, setContractorProvince] = useState("");
  const [contractorRegion, setContractorRegion] = useState("");
  const [contractorContactNo, setContractorContactNo] = useState("");
  const [contractorBirthday, setContractorBirthday] = useState("");
  /** Free-text destination for contractor (not office checklist). */
  const [contractorOfficeToVisit, setContractorOfficeToVisit] = useState("");
  const [contractorContactPerson, setContractorContactPerson] = useState("");
  const [contractorPassNumber, setContractorPassNumber] = useState("");
  const [contractorControlNumber, setContractorControlNumber] = useState("");
  const [contractorReasonForVisit, setContractorReasonForVisit] = useState("");

  // Step 3: Face Photo
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(
    null,
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);

  // Step 1: ID Document Capture
  const [capturedIdPhoto, setCapturedIdPhoto] = useState<string | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [isCapturingIdPhoto, setIsCapturingIdPhoto] = useState(false);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  /** Controllable overlay — RN Alert.alert cannot be dismissed in code. */
  const [isProcessingId, setIsProcessingId] = useState(false);

  // Step 2: Enrollee Info (extracted from ID)
  const [extractedFirstName, setExtractedFirstName] = useState("");
  const [extractedLastName, setExtractedLastName] = useState("");
  const [extractedAddress, setExtractedAddress] = useState("");
  // Break down address into components
  const [addressHouseNo, setAddressHouseNo] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");
  const [addressMunicipality, setAddressMunicipality] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [extractionConfidence, setExtractionConfidence] = useState<
    "high" | "medium" | "low" | null
  >(null);
  const [passNumber, setPassNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [enrolleeBirthday, setEnrolleeBirthday] = useState("");
  const [isCreatingEnrollee, setIsCreatingEnrollee] = useState(false);
  const [ocrExtractionFailed, setOcrExtractionFailed] = useState(false);
  const [returningMatch, setReturningMatch] =
    useState<ReturningVisitorMatch | null>(null);
  const [showReturningModal, setShowReturningModal] = useState(false);
  /** enrollee-resume = progress modal; identity-confirm = Existing Visitor Found */
  const [returningModalMode, setReturningModalMode] = useState<
    "enrollee-resume" | "identity-confirm"
  >("enrollee-resume");
  const [resumeExistingVisitor, setResumeExistingVisitor] = useState(false);

  const generateYearSixCode = () => {
    const year = new Date().getFullYear();
    const sixDigits = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    return `${year}-${sixDigits}`;
  };

  const isBirthdayFormatValid = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isBirthdayValid = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!isBirthdayFormatValid(trimmed)) return false;
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed <= today;
  };

  const CONTACT_NO_DIGITS = 11;
  const isValidContactNo11 = (value: string): boolean =>
    value.replace(/\D/g, "").length === CONTACT_NO_DIGITS;

  const offices = [
    "Admissions Office",
    "Bulldogs Exchange",
    "Faculty Office",
    "Guidance Services Office",
    "Health Services Office",
    "HR Office",
    "Information Technology Systems Office",
    "Registrar's Office",
    "Student Development and Activities Office",
    "Treasury Office",
  ];

  const toggleDestinationOffice = (office: string) => {
    setSelectedDestinationOffices((prev) =>
      prev.includes(office)
        ? prev.filter((o) => o !== office)
        : [...prev, office],
    );
  };

  // Auto-generate control number only (ID pass number is manual input).
  useEffect(() => {
    if (step === 2 && visitorType === "enrollee" && !controlNumber) {
      const control = generateYearSixCode();
      setControlNumber(control);
      console.log(`📋 Generated control number: ${control}`);
    }
  }, [step, visitorType, controlNumber]);

  useEffect(() => {
    if (
      step === 2 &&
      visitorType === "contractor" &&
      !contractorControlNumber
    ) {
      setContractorControlNumber(generateYearSixCode());
    }
  }, [step, visitorType, contractorControlNumber]);

  useEffect(() => {
    if (step === 2 && visitorType === "normal" && !normalVisitorControlNumber) {
      setNormalVisitorControlNumber(generateYearSixCode());
    }
  }, [step, visitorType, normalVisitorControlNumber]);

  const getVisitorTypeDisplay = () => {
    switch (visitorType) {
      case "enrollee":
        return { icon: "E", label: "Enrollee" };
      case "contractor":
        return { icon: "C", label: "Contractor" };
      case "normal":
        return { icon: "V", label: "Normal Visitor" };
      default:
        return { icon: "V", label: "Visitor" };
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
      console.log("📸 Opening camera for face capture");

      const result = await cameraService.capturePhoto({
        quality: FACE_PHOTO_QUALITY,
      });

      if (!result.success) {
        if (result.error !== "Camera capture cancelled") {
          Alert.alert(
            "Camera Error",
            result.error || "Failed to capture photo",
          );
        }
        return;
      }

      console.log("✅ Photo captured successfully");
      setCapturedFacePhoto(result.base64 || null);
      setPhotoPreview(result.uri || null);
    } catch (error) {
      console.error("❌ Error capturing photo:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const requestPrivacyThen = (action: Exclude<PrivacyPendingAction, null>) => {
    // Clear any stuck spinner from a previous hung camera/gallery open.
    setIsCapturingIdPhoto(false);
    setIsUploadingIdPhoto(false);
    setIsCapturingPhoto(false);

    if (privacyConsentGiven) {
      runPendingPrivacyAction(action);
      return;
    }

    setPrivacyPendingAction(action);
    setShowPrivacyModal(true);
  };

  const handlePrivacyDecline = () => {
    setShowPrivacyModal(false);
    setPrivacyPendingAction(null);
    setIsCapturingIdPhoto(false);
    setIsUploadingIdPhoto(false);
    setIsCapturingPhoto(false);
  };

  const runPendingPrivacyAction = (
    action: Exclude<PrivacyPendingAction, null>,
  ) => {
    if (action === "captureId") {
      void handleCaptureIdPhoto();
    } else if (action === "uploadId") {
      void handleUploadIdPhoto();
    } else {
      void handleCaptureFace();
    }
  };

  const handlePrivacyAgree = () => {
    const action = privacyPendingAction;
    setPrivacyConsentGiven(true);
    setShowPrivacyModal(false);
    setPrivacyPendingAction(null);
    setIsCapturingIdPhoto(false);
    setIsUploadingIdPhoto(false);
    setIsCapturingPhoto(false);

    if (!action) {
      return;
    }

    // Overlay is already gone (not RN Modal), so camera can open right away.
    requestAnimationFrame(() => {
      runPendingPrivacyAction(action);
    });
  };

  const handleConfirmPhoto = async (options?: { skipFaceCapture?: boolean }) => {
    const skipFaceCapture = options?.skipFaceCapture === true;
    const faceUriForUpload = skipFaceCapture
      ? undefined
      : capturedFacePhoto || undefined;
    const faceUriForTicket =
      (skipFaceCapture ? returningMatch?.photoUrl : null) ||
      photoPreview ||
      undefined;

    if (!skipFaceCapture && !capturedFacePhoto) {
      Alert.alert("Error", "No photo captured");
      return;
    }

    console.log(
      skipFaceCapture
        ? "♻️ Resume flow — skipping face capture, using saved photo..."
        : "✅ Face photo confirmed, saving registration...",
    );

    try {
      setIsCreatingEnrollee(true);

      if (visitorType === "enrollee") {
        await handleCreateEnrollee({
          facePhotoUri: faceUriForUpload,
          facePhotoUriForTicket: faceUriForTicket,
        });
      } else if (visitorType === "contractor") {
        const officeToVisit = contractorOfficeToVisit.trim();
        if (!officeToVisit) {
          Alert.alert("Error", "Please enter the office to visit.");
          setIsCreatingEnrollee(false);
          return;
        }

        // Register contractor and generate QR pass
        const result = await contractorService.registerAndGenerateQRPass({
          firstName: contractorFirstName,
          lastName: contractorLastName,
          birthday: contractorBirthday,
          contactNo: contractorContactNo,
          addressHouseNo: contractorHouseNo,
          addressStreet: contractorStreet,
          addressBarangay: contractorBarangay,
          addressMunicipality: contractorCity,
          addressProvince: contractorProvince,
          addressRegion: contractorRegion,
          officeToVisit,
          idPassNumber: contractorPassNumber,
          controlNumber: contractorControlNumber,
          reasonForVisit: contractorReasonForVisit,
          contactPerson: contractorContactPerson.trim(),
          facePhotoUri: faceUriForUpload,
          idPhotoUri: capturedIdPhoto || undefined,
        });

        if (result) {
          const qrPayload = buildVisitorScanQrJson({
            control_number: result.controlNumber,
            qr_token: result.qrToken,
          });

          const ticketData = {
            type: "contractor" as const,
            qrToken: result.qrToken,
            qrPayload,
            passNumber: result.passNumber,
            controlNumber: result.controlNumber,
            visitorId: result.visitorId,
            visitId: result.visitId,
            contractorId: result.contractorId,
            firstName: contractorFirstName,
            lastName: contractorLastName,
            contactNo: contractorContactNo,
            address: `${contractorHouseNo} ${contractorStreet}, ${contractorBarangay}, ${contractorCity}, ${contractorProvince}`,
            purpose: contractorReasonForVisit,
            destinationText: officeToVisit,
            facePhotoUri: faceUriForTicket,
            offices: [
              {
                id: 0,
                name: officeToVisit,
              },
            ],
          };

          router.replace({
            pathname: "/guard/qr-ticket",
            params: { data: JSON.stringify(ticketData) },
          });
        } else {
          Alert.alert(
            "Error",
            "Failed to register contractor. Please try again.",
          );
        }
      } else if (visitorType === "normal") {
        // Get office ID for the selected destination office
        const selectedOfficeIds = await officeService.getOfficeIds(
          selectedDestinationOffices,
        );

        if (selectedOfficeIds.length === 0) {
          Alert.alert(
            "Error",
            "Could not find selected offices. Please try again.",
          );
          setIsCreatingEnrollee(false);
          return;
        }

        // Register normal visitor and generate QR ticket
        const result = await normalVisitorService.registerAndGenerateQRTicket({
          firstName: normalVisitorFirstName,
          lastName: normalVisitorLastName,
          birthday: normalVisitorBirthday,
          contactNo: normalVisitorContactNo,
          addressHouseNo: normalVisitorHouseNo,
          addressStreet: normalVisitorStreet,
          addressBarangay: normalVisitorBarangay,
          addressMunicipality: normalVisitorCity,
          addressProvince: normalVisitorProvince,
          addressRegion: normalVisitorRegion,
          reasonForVisit: normalVisitorReasonForVisit,
          passNumber: normalVisitorPassNumber,
          controlNumber: normalVisitorControlNumber,
          facePhotoUri: faceUriForUpload,
          idPhotoUri: capturedIdPhoto || undefined,
          selectedOfficeIds: selectedOfficeIds,
        });

        if (result) {
          const qrPayload = buildVisitorScanQrJson({
            control_number: result.controlNumber,
            qr_token: result.qrToken,
          });

          const ticketData = {
            type: "normal" as const,
            qrToken: result.qrToken,
            qrPayload,
            passNumber: result.passNumber,
            controlNumber: result.controlNumber,
            visitorId: result.visitorId,
            visitId: result.visitId,
            firstName: normalVisitorFirstName,
            lastName: normalVisitorLastName,
            contactNo: normalVisitorContactNo,
            address: `${normalVisitorHouseNo} ${normalVisitorStreet}, ${normalVisitorBarangay}, ${normalVisitorCity}, ${normalVisitorProvince}`,
            reasonForVisit: normalVisitorReasonForVisit,
            facePhotoUri: faceUriForTicket,
            offices: selectedDestinationOffices.map((name, index) => ({
              id: selectedOfficeIds[index] || index,
              name,
            })),
          };

          router.replace({
            pathname: "/guard/qr-ticket",
            params: { data: JSON.stringify(ticketData) },
          });
        } else {
          Alert.alert("Error", "Failed to register visitor. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error saving registration:", error);
      Alert.alert("Error", "Failed to save registration. Please try again.");
    } finally {
      setIsCreatingEnrollee(false);
    }
  };

  /** After Step 2: resume skips face capture; new visitors go to Step 3. */
  const continueFromVisitorInfo = () => {
    if (resumeExistingVisitor) {
      void handleConfirmPhoto({ skipFaceCapture: true });
      return;
    }
    setStep(3);
  };

  const handleRetakePhoto = () => {
    console.log("🔄 Retaking photo");
    setCapturedFacePhoto(null);
    setPhotoPreview(null);
  };

  const handleCaptureIdPhoto = async () => {
    try {
      setIsCapturingIdPhoto(true);
      setIsUploadingIdPhoto(false);
      console.log("📸 Opening camera for ID capture");

      const result = await cameraService.capturePhoto({
        quality: ID_PHOTO_QUALITY,
      });

      if (!result.success) {
        if (result.error !== "Camera capture cancelled") {
          Alert.alert(
            "Camera Error",
            result.error || "Failed to capture ID photo",
          );
        }
        return;
      }

      console.log("✅ ID photo captured successfully");
      setCapturedIdPhoto(result.base64 || null);
      setIdPhotoPreview(result.uri || null);
    } catch (error) {
      console.error("❌ Error capturing ID photo:", error);
      Alert.alert("Error", "Failed to capture ID photo. Please try again.");
    } finally {
      setIsCapturingIdPhoto(false);
    }
  };

  const handleUploadIdPhoto = async () => {
    try {
      setIsUploadingIdPhoto(true);
      setIsCapturingIdPhoto(false);
      console.log("📱 Opening photo library for ID upload");

      const result = await cameraService.pickPhoto({
        quality: ID_PHOTO_QUALITY,
      });

      if (!result.success) {
        if (result.error !== "Photo selection cancelled") {
          Alert.alert(
            "Upload Error",
            result.error || "Failed to upload ID photo",
          );
        }
        return;
      }

      console.log("✅ ID photo uploaded successfully");
      setCapturedIdPhoto(result.base64 || null);
      setIdPhotoPreview(result.uri || null);
    } catch (error) {
      console.error("❌ Error uploading ID photo:", error);
      Alert.alert("Error", "Failed to upload ID photo. Please try again.");
    } finally {
      setIsUploadingIdPhoto(false);
    }
  };

  const applyReturningMatchToForm = (match: ReturningVisitorMatch) => {
    const { addressParts } = match;

    setExtractedFirstName(match.firstName);
    setExtractedLastName(match.lastName);
    setEnrolleeBirthday(match.birthday);
    setContactNumber(match.contactNo || "");
    setAddressHouseNo(addressParts.houseNo);
    setAddressStreet(addressParts.street);
    setAddressBarangay(addressParts.barangay);
    setAddressMunicipality(addressParts.cityMunicipality);
    setAddressProvince(addressParts.province);
    setAddressRegion(addressParts.region);
    setExtractedAddress(match.addressText);

    setNormalVisitorFirstName(match.firstName);
    setNormalVisitorLastName(match.lastName);
    setNormalVisitorBirthday(match.birthday);
    setNormalVisitorContactNo(match.contactNo || "");
    setNormalVisitorHouseNo(addressParts.houseNo);
    setNormalVisitorStreet(addressParts.street);
    setNormalVisitorBarangay(addressParts.barangay);
    setNormalVisitorCity(addressParts.cityMunicipality);
    setNormalVisitorProvince(addressParts.province);
    setNormalVisitorRegion(addressParts.region);

    setContractorFirstName(match.firstName);
    setContractorLastName(match.lastName);
    setContractorBirthday(match.birthday);
    setContractorContactNo(match.contactNo || "");
    setContractorHouseNo(addressParts.houseNo);
    setContractorStreet(addressParts.street);
    setContractorBarangay(addressParts.barangay);
    setContractorCity(addressParts.cityMunicipality);
    setContractorProvince(addressParts.province);
    setContractorRegion(addressParts.region);

    // Reuse saved validation photo — Step 3 face capture will be skipped
    setPhotoPreview(match.photoUrl);
    setCapturedFacePhoto(null);
    setResumeExistingVisitor(true);
  };

  const finishIdExtractionAndGoStep2 = () => {
    setShowReturningModal(false);
    setStep(2);
  };

  const handleConfirmResumeReturning = () => {
    if (returningMatch) {
      applyReturningMatchToForm(returningMatch);
      console.log(
        `♻️ Resuming visitor_id=${returningMatch.visitorId} as ${returningMatch.visitorType} (skip face capture)`,
      );
    }
    finishIdExtractionAndGoStep2();
  };

  const handleCancelReturningAsNew = () => {
    setResumeExistingVisitor(false);
    setReturningMatch(null);
    setPhotoPreview(null);
    setCapturedFacePhoto(null);
    console.log("🆕 Guard chose New Visitor — face photo required on Step 3");
    finishIdExtractionAndGoStep2();
  };

  // Extract data from ID image using OCR with intelligent parsing
  // Returns true when the returning-visitor modal is open (do not advance step yet).
  const extractDataFromIdImage = async (
    idPhotoBase64: string,
    imageUri?: string | null,
  ): Promise<boolean> => {
    setIsProcessingId(true);
    try {
      console.log("🔍 Starting ID text extraction...");

      // Prefer local URI for compression (avoids iOS File.write encoding bug)
      const extractedData = await enrolleeService.extractDataFromID(
        idPhotoBase64,
        imageUri ?? idPhotoPreview,
      );

      if (extractedData) {
        // Extraction successful - set whatever fields were extracted
        // Some fields may be empty if parser couldn't confidently extract them
        setExtractedFirstName(extractedData.firstName || "");
        setExtractedLastName(extractedData.lastName || "");
        setEnrolleeBirthday(extractedData.birthday || "");
        setExtractedAddress(extractedData.address || "");

        // Set address components for Enrollee
        setAddressHouseNo(extractedData.addressHouseNo || "");
        setAddressStreet(extractedData.addressStreet || "");
        setAddressBarangay(extractedData.addressBarangay || "");
        setAddressMunicipality(extractedData.addressCityMunicipality || "");
        setAddressProvince(extractedData.addressProvince || "");
        setAddressRegion(extractedData.addressRegion || "");

        // Also populate Normal Visitor fields with extracted data
        setNormalVisitorFirstName(extractedData.firstName || "");
        setNormalVisitorLastName(extractedData.lastName || "");
        setNormalVisitorBirthday(extractedData.birthday || "");
        setNormalVisitorHouseNo(extractedData.addressHouseNo || "");
        setNormalVisitorStreet(extractedData.addressStreet || "");
        setNormalVisitorBarangay(extractedData.addressBarangay || "");
        setNormalVisitorCity(extractedData.addressCityMunicipality || "");
        setNormalVisitorProvince(extractedData.addressProvince || "");
        setNormalVisitorRegion(extractedData.addressRegion || "");

        // Also populate Contractor fields with extracted data
        setContractorFirstName(extractedData.firstName || "");
        setContractorLastName(extractedData.lastName || "");
        setContractorBirthday(extractedData.birthday || "");
        setContractorHouseNo(extractedData.addressHouseNo || "");
        setContractorStreet(extractedData.addressStreet || "");
        setContractorBarangay(extractedData.addressBarangay || "");
        setContractorCity(extractedData.addressCityMunicipality || "");
        setContractorProvince(extractedData.addressProvince || "");
        setContractorRegion(extractedData.addressRegion || "");

        setExtractionConfidence(extractedData.confidence || null);
        setOcrExtractionFailed(false);
        setResumeExistingVisitor(false);
        setReturningMatch(null);

        const extractedFields: string[] = [];
        if (extractedData.firstName) extractedFields.push("First Name");
        if (extractedData.lastName) extractedFields.push("Last Name");
        if (extractedData.birthday) extractedFields.push("Birthday");
        if (extractedData.address) extractedFields.push("Address");

        console.log(
          `✅ Data extracted successfully (${extractedData.confidence} confidence) - Fields: ${extractedFields.join(", ")}`,
        );

        // Returning match after OCR (name + birthday):
        // - Enrollee registration → Returning Enrollee modal WITH progress
        // - Contractor / Normal → Existing Visitor Found (identity only), even if
        //   they were previously an enrollee who finished steps 1–9
        if (
          extractedData.firstName?.trim() &&
          extractedData.lastName?.trim() &&
          extractedData.birthday?.trim()
        ) {
          const match = await visitorLookupService.findReturningByNameAndBirthday({
            firstName: extractedData.firstName,
            lastName: extractedData.lastName,
            birthday: extractedData.birthday,
          });

          if (match) {
            if (visitorType === "enrollee") {
              if (match.visitorType === "enrollee" || match.progress) {
                setIsProcessingId(false);
                setReturningMatch({
                  ...match,
                  visitorType: "enrollee",
                });
                setReturningModalMode("enrollee-resume");
                setShowReturningModal(true);
                return true;
              }
              // Known person but not an enrollee yet — identity confirm only
              setIsProcessingId(false);
              setReturningMatch({
                ...match,
                progress: null,
                lastVisitSummary: null,
              });
              setReturningModalMode("identity-confirm");
              setShowReturningModal(true);
              return true;
            }

            if (visitorType === "contractor" || visitorType === "normal") {
              setIsProcessingId(false);
              setReturningMatch({
                ...match,
                visitorType:
                  visitorType === "contractor" ? "contractor" : "normal",
                progress: null,
                lastVisitSummary: null,
              });
              setReturningModalMode("identity-confirm");
              setShowReturningModal(true);
              return true;
            }
          }
        }

        // Show confidence-based message
        let confidenceMessage = "";
        let actionMessage =
          "Please review and confirm the extracted information.";
        let warningNote = "";
        let missingFieldsNote =
          extractedFields.length < 3
            ? `\n\n📝 Fields extracted: ${extractedFields.join(", ")}. You can fill in missing fields manually on the next screen.`
            : "";

        if (extractedData.confidence === "high") {
          confidenceMessage = "✅ High Confidence\n";
          actionMessage = "The data was extracted with high accuracy.";
        } else if (extractedData.confidence === "medium") {
          confidenceMessage = "⚠️ Medium Confidence\n";
          actionMessage =
            "Some fields were extracted but please verify them carefully.";
          warningNote =
            "\n\n💡 If your ID has a hologram or see-through security sticker, some details may have been affected by glare. Please review all fields on the next screen and make any necessary corrections.";
        } else {
          confidenceMessage = "⚠️ Low Confidence\n";
          actionMessage =
            "Automatic extraction had difficulty. Please review all fields carefully.";
          warningNote =
            "\n\n💡 Your ID may have holograms, security stickers, or glare that affected extraction. You will be able to manually correct any fields on the next screen.";
        }

        setIsProcessingId(false);
        Alert.alert(
          "ID Data Extracted",
          `${confidenceMessage}\nFirst Name: ${extractedData.firstName || "(not extracted)"}\nLast Name: ${extractedData.lastName || "(not extracted)"}\nBirthday: ${extractedData.birthday || "(not extracted)"}\nAddress: ${extractedData.address || "(not extracted)"}\n\n${actionMessage}${warningNote}${missingFieldsNote}`,
          [{ text: "Review & Continue" }],
        );
        return false;
      } else {
        // Extraction failed - guide user to manual entry
        console.warn(
          "⚠️ OCR extraction failed - could not extract usable information from ID",
        );
        setExtractionConfidence("low");
        setOcrExtractionFailed(true);

        setIsProcessingId(false);
        Alert.alert(
          "⚠️ Unable to Extract ID Details",
          "We could not automatically read your ID due to image quality, lighting, or obscured text.\n\n✏️ No problem! You can enter your information manually on the next screen.\n\nRequired fields:\n  • First Name\n  • Last Name\n  • Address\n\nYou can also edit the phone number if needed.",
          [{ text: "Proceed to Manual Entry" }],
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Error extracting ID data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Details:", errorMessage);

      setOcrExtractionFailed(true);

      setIsProcessingId(false);
      Alert.alert(
        "Extraction Failed",
        "Could not automatically extract information from the ID. Please enter the details manually.\n\nYou will be able to enter your information in the next step.",
        [{ text: "Continue to Manual Entry" }],
      );
      return false;
    } finally {
      setIsProcessingId(false);
    }
  };

  const handleConfirmIdPhoto = async () => {
    if (!capturedIdPhoto) {
      Alert.alert("Error", "No ID photo captured");
      return;
    }

    console.log("📋 ID photo confirmed, extracting data...");

    const waitingForReturningDecision = await extractDataFromIdImage(
      capturedIdPhoto,
      idPhotoPreview,
    );

    // Stay on step 1 while returning modal is open
    if (!waitingForReturningDecision) {
      setStep(2);
    }
  };

  const handleRetakeIdPhoto = () => {
    console.log("🔄 Retaking ID photo");
    setCapturedIdPhoto(null);
    setIdPhotoPreview(null);
  };

  const handleRunOCRDiagnostics = async () => {
    console.log("🔧 Running OCR diagnostics...");
    Alert.alert(
      "Running Diagnostics",
      "Checking backend connection and OCR configuration...",
      [{ text: "OK" }],
    );

    const diagnostics = await runOCRDiagnostics();

    let message = `Backend: ${diagnostics.backendStatus === "ok" ? "✅ OK" : "❌ ERROR"}\n`;
    message += `Tesseract: ${diagnostics.tesseractReady ? "✅ Ready" : "⏳ Initializing"}\n\n`;

    if (diagnostics.recommendations.length > 0) {
      message += "💡 Recommendations:\n";
      diagnostics.recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    Alert.alert("OCR Diagnostics Results", message, [{ text: "OK" }]);
  };

  const handleCreateEnrollee = async (photoOpts?: {
    facePhotoUri?: string;
    facePhotoUriForTicket?: string;
  }) => {
    // Validate required fields - at least firstName and lastName are required
    const missingFields: string[] = [];
    if (!extractedFirstName?.trim()) missingFields.push("First Name");
    if (!extractedLastName?.trim()) missingFields.push("Last Name");
    if (!enrolleeBirthday?.trim()) missingFields.push("Birthday");
    if (!passNumber?.trim()) missingFields.push("ID Pass Number");
    if (!contactNumber?.trim()) missingFields.push("Contact No.");
    // At least one address component should be filled
    const hasAddressData =
      addressHouseNo?.trim() ||
      addressStreet?.trim() ||
      addressBarangay?.trim() ||
      addressMunicipality?.trim() ||
      addressProvince?.trim() ||
      addressRegion?.trim();
    if (!hasAddressData) missingFields.push("At least one Address component");

    if (missingFields.length > 0) {
      Alert.alert(
        "⚠️ Missing Required Information",
        `Please fill in the following fields before proceeding:\n\n• ${missingFields.join("\n• ")}`,
        [{ text: "OK" }],
      );
      return;
    }

    if (!isBirthdayValid(enrolleeBirthday)) {
      Alert.alert(
        "Invalid Birthday",
        "Please select a valid date of birth. It cannot be in the future.",
      );
      return;
    }

    if (!isValidContactNo11(contactNumber)) {
      Alert.alert(
        "Invalid Contact No.",
        "Enter exactly 11 digits (e.g. 09171234567).",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      setIsCreatingEnrollee(true);
      console.log("🔄 Creating enrollee with data:", {
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

      // ID pass number is manual; control number is auto-generated.
      const pass = passNumber.trim();
      const control = controlNumber || generateYearSixCode();
      const qrToken = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const facePhotoUri =
        photoOpts?.facePhotoUri !== undefined
          ? photoOpts.facePhotoUri
          : capturedFacePhoto || undefined;
      const facePhotoUriForTicket =
        photoOpts?.facePhotoUriForTicket ?? photoPreview ?? undefined;

      // Save enrollee to database
      const enrolleeResult = await enrolleeService.createEnrollee({
        firstName: extractedFirstName,
        lastName: extractedLastName,
        birthday: enrolleeBirthday,
        // Separate address components
        addressHouseNo,
        addressStreet,
        addressBarangay,
        addressMunicipality,
        addressProvince,
        addressRegion,
        contactNo: contactNumber || undefined,
        facePhotoUri,
        idPhotoUri: capturedIdPhoto || undefined,
        passNumber: pass,
        controlNumber: control,
        qrToken: qrToken,
      });

      if (!enrolleeResult) {
        console.error("❌ Enrollee creation failed - database returned null");
        Alert.alert(
          "Database Error",
          "Failed to create enrollee record. Please check:\n\n• Internet connection\n• Enrollee & Visitor tables exist\n• Column names match schema\n\nCheck console for detailed error.",
          [{ text: "Try Again" }],
        );
        setIsCreatingEnrollee(false);
        return;
      }

      if (!enrolleeResult.visit_id) {
        Alert.alert(
          "Visit not saved",
          "Enrollee was saved but the visit/QR was not created. The progress website will show Page not found. Please try again.",
          [{ text: "OK" }],
        );
        setIsCreatingEnrollee(false);
        return;
      }

      console.log("✅ Enrollee created:", enrolleeResult.enrollee_id);

      const steps =
        (await enrolleeService.getEnrolleeSteps(enrolleeResult.enrollee_id)) ??
        [];

      const officeIds = [
        ...new Set(
          steps
            .map((s: { office_id?: number }) => s.office_id)
            .filter((id): id is number => id != null),
        ),
      ];
      const { data: officeRows } =
        officeIds.length > 0
          ? await supabase
              .from("office")
              .select("office_id, office_name")
              .in("office_id", officeIds)
          : { data: [] as { office_id: number; office_name: string }[] };
      const nameMap = new Map(
        (officeRows || []).map((o) => [o.office_id, o.office_name]),
      );

      let qrPayload: string | undefined;
      if (enrolleeResult.visit_id && steps && steps.length > 0) {
        const route = steps.map(
          (
            s: { office_id: number; step_order?: number; step_name?: string },
            i: number,
          ) => ({
            order: s.step_order ?? i + 1,
            office_id: s.office_id,
            office_name:
              (nameMap.get(s.office_id) as string) ||
              s.step_name ||
              `Office ${s.office_id}`,
          }),
        );
        qrPayload = buildQRTicketPayloadV1({
          kind: "enrollee",
          qr_token: qrToken,
          visit_id: enrolleeResult.visit_id,
          visitor_id: enrolleeResult.visitor_id,
          control_number: control,
          route,
        });
      }

      const ticketOffices: {
        id: number;
        name: string;
        stepName: string;
        stepOrder?: number;
        status: "done" | "current" | "pending";
      }[] =
        steps?.map(
          (s: {
            office_id: number;
            step_name?: string;
            step_order?: number;
            status?: string;
            completed_at?: string | null;
          }) => {
            const officeName =
              (nameMap.get(s.office_id) as string) ||
              `Office ${s.office_id ?? ""}`;
            return {
              id: s.office_id,
              name: officeName,
              stepName: s.step_name || `Step ${s.step_order ?? ""}`,
              stepOrder: s.step_order,
              status: (s.status === "completed" || s.completed_at
                ? "done"
                : "pending") as "done" | "current" | "pending",
            };
          },
        ) ?? [];

      // Mark first incomplete step as current
      const firstPendingIdx = ticketOffices.findIndex((o) => o.status !== "done");
      if (firstPendingIdx >= 0) {
        ticketOffices[firstPendingIdx].status = "current";
      }

      router.replace({
        pathname: "/guard/qr-ticket",
        params: {
          data: JSON.stringify({
            type: "enrollee",
            qrToken,
            qrPayload,
            passNumber: pass,
            controlNumber: control,
            visitorId: enrolleeResult.visitor_id,
            visitId: enrolleeResult.visit_id,
            firstName: extractedFirstName,
            lastName: extractedLastName,
            contactNo: contactNumber || "",
            facePhotoUri: facePhotoUriForTicket,
            offices: ticketOffices,
            enrolleeId: enrolleeResult.enrollee_id,
          }),
        },
      });

      console.log("✅ Enrollee created with office-route QR");
      console.log("Enrollee ID:", enrolleeResult.enrollee_id);
      console.log("QR Token (for office scanning):", qrToken);
      console.log("Pass Number:", pass);
      console.log("Control Number:", control);
      console.log("Visitor ID:", enrolleeResult.visitor_id);
      setIsCreatingEnrollee(false);
    } catch (error) {
      console.error("❌ Error creating enrollee:", error);
      Alert.alert("Error", "Failed to create enrollee. Please try again.");
      setIsCreatingEnrollee(false);
    }
  };

  if (step === 2) {
    const enrolleeInformationTopSlot =
      visitorType === "enrollee" ? (
        <View style={{ marginBottom: 4 }}>
          {extractionConfidence && !ocrExtractionFailed && (
            <View
              style={[
                styles.confidenceAlert,
                {
                  backgroundColor:
                    extractionConfidence === "high"
                      ? "#E8F5E9"
                      : extractionConfidence === "medium"
                        ? "#FFF3E0"
                        : "#FFEBEE",
                  borderLeftColor:
                    extractionConfidence === "high"
                      ? "#4CAF50"
                      : extractionConfidence === "medium"
                        ? "#FF9800"
                        : "#F44336",
                },
              ]}
            >
              <MaterialIcons
                name={
                  extractionConfidence === "high" ? "check-circle" : "warning"
                }
                size={18}
                color={
                  extractionConfidence === "high"
                    ? "#4CAF50"
                    : extractionConfidence === "medium"
                      ? "#FF9800"
                      : "#F44336"
                }
              />
              <Text
                style={[
                  styles.confidenceText,
                  {
                    color:
                      extractionConfidence === "high"
                        ? "#2E7D32"
                        : extractionConfidence === "medium"
                          ? "#E65100"
                          : "#C62828",
                    marginLeft: 8,
                  },
                ]}
              >
                {extractionConfidence === "high"
                  ? "High Confidence - Data extracted accurately"
                  : extractionConfidence === "medium"
                    ? "Medium Confidence - Please verify the fields"
                    : "Low Confidence - Please review and correct"}
              </Text>
            </View>
          )}

          {ocrExtractionFailed && (
            <View
              style={[
                styles.confidenceAlert,
                {
                  backgroundColor: "#FFEBEE",
                  borderLeftColor: "#F44336",
                },
              ]}
            >
              <MaterialIcons name="error" size={18} color="#F44336" />
              <Text
                style={[
                  styles.confidenceText,
                  { color: "#C62828", marginLeft: 8 },
                ]}
              >
                Manual Entry Required - Please fill in the details below
              </Text>
            </View>
          )}

          {extractionConfidence &&
            extractionConfidence !== "high" &&
            !ocrExtractionFailed && (
              <View
                style={[
                  styles.confidenceAlert,
                  {
                    backgroundColor: "#FFF3E0",
                    borderLeftColor: "#FF9800",
                  },
                ]}
              >
                <MaterialIcons name="info" size={18} color="#FF9800" />
                <Text
                  style={[
                    styles.confidenceText,
                    { color: "#E65100", marginLeft: 8 },
                  ]}
                >
                  Some ID details could not be extracted clearly. Please verify
                  and edit the fields if needed.
                </Text>
              </View>
            )}

          <Text
            style={[
              styles.editableNote,
              {
                color: ocrExtractionFailed ? "#C62828" : colors.textSecondary,
                marginBottom: 12,
                marginTop: 8,
                fontSize: ocrExtractionFailed ? 13 : 12,
                fontWeight: ocrExtractionFailed ? "600" : "400",
              },
            ]}
          >
            {ocrExtractionFailed
              ? "✏️ Please enter your information below. All three fields are required: First Name, Last Name, and Address."
              : "✎ All fields are editable. Please correct any inaccurate information."}
          </Text>
        </View>
      ) : null;

    if (visitorType === "enrollee") {
      return (
        <VisitorInformationStepScreen
          badgeIconLetter="E"
          badgeLabel="Enrollee"
          showControlNumber={false}
          showDestinationOffice={false}
          showReasonForVisit={false}
          offices={offices}
          selectedOffices={[]}
          onToggleOffice={() => {}}
          onBack={handleBack}
          onContinue={() => {
            const missingFields: string[] = [];
            if (!extractedFirstName?.trim()) missingFields.push("First Name");
            if (!extractedLastName?.trim()) missingFields.push("Last Name");
            if (!enrolleeBirthday?.trim()) missingFields.push("Birthday");
            if (!passNumber?.trim()) missingFields.push("ID Pass Number");
            if (!contactNumber?.trim()) missingFields.push("Contact No.");
            if (missingFields.length > 0) {
              Alert.alert(
                "⚠️ Missing Required Information",
                `Please fill in the following fields before proceeding:\n\n• ${missingFields.join("\n• ")}`,
                [{ text: "OK" }],
              );
              return;
            }
            if (!isBirthdayValid(enrolleeBirthday)) {
              Alert.alert(
                "Invalid Birthday",
                "Please select a valid date of birth. It cannot be in the future.",
              );
              return;
            }
            if (!isValidContactNo11(contactNumber)) {
              Alert.alert(
                "Invalid Contact No.",
                "Enter exactly 11 digits (e.g. 09171234567).",
                [{ text: "OK" }],
              );
              return;
            }
            continueFromVisitorInfo();
          }}
          continueButtonLabel={
            resumeExistingVisitor
              ? "Confirm & Generate QR"
              : "Continue to Photo"
          }
          continueDisabled={isCreatingEnrollee}
          firstName={extractedFirstName}
          onChangeFirstName={setExtractedFirstName}
          lastName={extractedLastName}
          onChangeLastName={setExtractedLastName}
          birthday={enrolleeBirthday}
          onChangeBirthday={setEnrolleeBirthday}
          houseNo={addressHouseNo}
          onChangeHouseNo={setAddressHouseNo}
          street={addressStreet}
          onChangeStreet={setAddressStreet}
          barangay={addressBarangay}
          onChangeBarangay={setAddressBarangay}
          city={addressMunicipality}
          onChangeCity={setAddressMunicipality}
          province={addressProvince}
          onChangeProvince={setAddressProvince}
          region={addressRegion}
          onChangeRegion={setAddressRegion}
          contactNo={contactNumber}
          onChangeContactNo={setContactNumber}
          idPassNumber={passNumber}
          onChangeIdPassNumber={setPassNumber}
          controlNumber={controlNumber}
          reasonForVisit=""
          onChangeReasonForVisit={() => {}}
          birthdayColors={colors}
          topSlot={enrolleeInformationTopSlot}
        />
      );
    }

    if (visitorType === "contractor") {
      return (
        <VisitorInformationStepScreen
          badgeIconLetter="C"
          badgeLabel="Contractor"
          showControlNumber={false}
          showDestinationOffice
          destinationOfficeFreeText
          destinationOfficeTypedValue={contractorOfficeToVisit}
          onChangeDestinationOfficeTyped={setContractorOfficeToVisit}
          contactPerson={contractorContactPerson}
          onChangeContactPerson={setContractorContactPerson}
          showReasonForVisit
          offices={[]}
          selectedOffices={[]}
          onToggleOffice={() => {}}
          onBack={handleBack}
          onContinue={() => {
            const missingFields: string[] = [];
            if (!contractorFirstName?.trim()) missingFields.push("First Name");
            if (!contractorLastName?.trim()) missingFields.push("Last Name");
            if (!contractorBirthday?.trim()) missingFields.push("Birthday");
            if (!contractorPassNumber?.trim())
              missingFields.push("ID Pass Number");
            if (!contractorOfficeToVisit?.trim()) {
              missingFields.push("Office to Visit");
            }
            if (!contractorContactPerson?.trim()) {
              missingFields.push("Contact Person");
            }
            if (!contractorReasonForVisit?.trim())
              missingFields.push("Purpose");
            if (!contractorContactNo?.trim()) missingFields.push("Contact No.");
            if (missingFields.length > 0) {
              Alert.alert(
                "⚠️ Missing Required Information",
                `Please fill in the following fields before proceeding:\n\n• ${missingFields.join("\n• ")}`,
                [{ text: "OK" }],
              );
              return;
            }
            if (!isBirthdayValid(contractorBirthday)) {
              Alert.alert(
                "Invalid Birthday",
                "Please select a valid date of birth. It cannot be in the future.",
              );
              return;
            }
            if (!isValidContactNo11(contractorContactNo)) {
              Alert.alert(
                "Invalid Contact No.",
                "Enter exactly 11 digits (e.g. 09171234567).",
                [{ text: "OK" }],
              );
              return;
            }
            continueFromVisitorInfo();
          }}
          continueButtonLabel={
            resumeExistingVisitor
              ? "Confirm & Generate QR"
              : "Continue to Photo"
          }
          continueDisabled={isCreatingEnrollee}
          firstName={contractorFirstName}
          onChangeFirstName={setContractorFirstName}
          lastName={contractorLastName}
          onChangeLastName={setContractorLastName}
          birthday={contractorBirthday}
          onChangeBirthday={setContractorBirthday}
          houseNo={contractorHouseNo}
          onChangeHouseNo={setContractorHouseNo}
          street={contractorStreet}
          onChangeStreet={setContractorStreet}
          barangay={contractorBarangay}
          onChangeBarangay={setContractorBarangay}
          city={contractorCity}
          onChangeCity={setContractorCity}
          province={contractorProvince}
          onChangeProvince={setContractorProvince}
          region={contractorRegion}
          onChangeRegion={setContractorRegion}
          contactNo={contractorContactNo}
          onChangeContactNo={setContractorContactNo}
          idPassNumber={contractorPassNumber}
          onChangeIdPassNumber={setContractorPassNumber}
          controlNumber={contractorControlNumber}
          reasonForVisit={contractorReasonForVisit}
          onChangeReasonForVisit={setContractorReasonForVisit}
          birthdayColors={colors}
        />
      );
    }

    return (
      <VisitorInformationStepScreen
        badgeIconLetter="V"
        badgeLabel="Normal Visitor"
        showControlNumber={false}
        showDestinationOffice
        showReasonForVisit
        offices={offices}
        selectedOffices={selectedDestinationOffices}
        onToggleOffice={toggleDestinationOffice}
        onBack={handleBack}
        onContinue={() => {
          const missingFields: string[] = [];
          if (!normalVisitorFirstName?.trim()) missingFields.push("First Name");
          if (!normalVisitorLastName?.trim()) missingFields.push("Last Name");
          if (!normalVisitorBirthday?.trim()) missingFields.push("Birthday");
          if (!normalVisitorPassNumber?.trim())
            missingFields.push("ID Pass Number");
          if (!normalVisitorContactNo?.trim()) missingFields.push("Contact No");
          if (selectedDestinationOffices.length === 0)
            missingFields.push("Destination Office");
          if (!normalVisitorReasonForVisit?.trim())
            missingFields.push("Purpose");
          if (missingFields.length > 0) {
            Alert.alert(
              "⚠️ Missing Required Information",
              `Please fill in the following fields before proceeding:\n\n• ${missingFields.join("\n• ")}`,
              [{ text: "OK" }],
            );
            return;
          }
          if (!isBirthdayValid(normalVisitorBirthday)) {
            Alert.alert(
              "Invalid Birthday",
              "Please select a valid date of birth. It cannot be in the future.",
            );
            return;
          }
          if (!isValidContactNo11(normalVisitorContactNo)) {
            Alert.alert(
              "Invalid Contact No.",
              "Enter exactly 11 digits (e.g. 09171234567).",
              [{ text: "OK" }],
            );
            return;
          }
          continueFromVisitorInfo();
        }}
        continueButtonLabel={
          resumeExistingVisitor
            ? "Confirm & Generate QR"
            : "Continue to Photo"
        }
        continueDisabled={isCreatingEnrollee}
        firstName={normalVisitorFirstName}
        onChangeFirstName={setNormalVisitorFirstName}
        lastName={normalVisitorLastName}
        onChangeLastName={setNormalVisitorLastName}
        birthday={normalVisitorBirthday}
        onChangeBirthday={setNormalVisitorBirthday}
        houseNo={normalVisitorHouseNo}
        onChangeHouseNo={setNormalVisitorHouseNo}
        street={normalVisitorStreet}
        onChangeStreet={setNormalVisitorStreet}
        barangay={normalVisitorBarangay}
        onChangeBarangay={setNormalVisitorBarangay}
        city={normalVisitorCity}
        onChangeCity={setNormalVisitorCity}
        province={normalVisitorProvince}
        onChangeProvince={setNormalVisitorProvince}
        region={normalVisitorRegion}
        onChangeRegion={setNormalVisitorRegion}
        contactNo={normalVisitorContactNo}
        onChangeContactNo={setNormalVisitorContactNo}
        idPassNumber={normalVisitorPassNumber}
        onChangeIdPassNumber={setNormalVisitorPassNumber}
        controlNumber={normalVisitorControlNumber}
        reasonForVisit={normalVisitorReasonForVisit}
        onChangeReasonForVisit={setNormalVisitorReasonForVisit}
        birthdayColors={colors}
      />
    );
  }

  if (step === 3) {
    return (
      <View style={{ flex: 1 }}>
        <FaceCaptureStepScreen
          badgeIconLetter={visitorTypeInfo.icon}
          badgeLabel={visitorTypeInfo.label}
          onBack={handleBack}
          photoPreview={photoPreview}
          isCapturingPhoto={isCapturingPhoto}
          isCreatingEnrollee={isCreatingEnrollee}
          onCaptureFace={() => requestPrivacyThen("captureFace")}
          onConfirmPhoto={() => {
            void handleConfirmPhoto();
          }}
          onRetakePhoto={handleRetakePhoto}
        />
        <DataPrivacyNoticeModal
          visible={showPrivacyModal}
          onAgree={handlePrivacyAgree}
          onDecline={handlePrivacyDecline}
        />
      </View>
    );
  }

  if (step === 1) {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={captureStepStyles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

        <ScrollView
          style={captureStepStyles.captureScroll}
          contentContainerStyle={captureStepStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={captureStepStyles.header}>
            <CaptureIdHeaderPattern />

            <View style={captureStepStyles.headerTop}>
              <TouchableOpacity
                style={captureStepStyles.captureBackButton}
                onPress={handleBack}
              >
                <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.8} />
                <Text style={captureStepStyles.backText}>Back</Text>
              </TouchableOpacity>
              <View style={captureStepStyles.headerTopSpacer} />
            </View>

            <View style={captureStepStyles.visitorBadgeWrapper}>
              <View style={captureStepStyles.visitorBadge}>
                <View style={captureStepStyles.badgeIconCircle}>
                  <Text style={captureStepStyles.badgeIconText}>
                    {visitorTypeInfo.icon}
                  </Text>
                </View>
                <Text style={captureStepStyles.visitorBadgeText}>
                  {visitorTypeInfo.label}
                </Text>
              </View>
            </View>

            <Text style={captureStepStyles.stepTitle}>Step 1 of 3</Text>

            <View style={captureStepStyles.progressRow}>
              <View
                style={[
                  captureStepStyles.progressBar,
                  captureStepStyles.progressActive,
                ]}
              />
              <View style={captureStepStyles.progressBar} />
              <View style={captureStepStyles.progressBar} />
            </View>
          </View>

          <View style={captureStepStyles.contentPanel}>
            {!idPhotoPreview ? (
              <>
                <View style={captureStepStyles.scanCard}>
                  <View style={captureStepStyles.scanGraphic}>
                    <View style={captureStepStyles.scanCircle}>
                      <FileText size={68} color="#0648A8" fill="#0648A8" />
                    </View>

                    <View
                      style={[
                        captureStepStyles.corner,
                        captureStepStyles.cornerTopLeft,
                      ]}
                    />
                    <View
                      style={[
                        captureStepStyles.corner,
                        captureStepStyles.cornerTopRight,
                      ]}
                    />
                    <View
                      style={[
                        captureStepStyles.corner,
                        captureStepStyles.cornerBottomLeft,
                      ]}
                    />
                    <View
                      style={[
                        captureStepStyles.corner,
                        captureStepStyles.cornerBottomRight,
                      ]}
                    />

                    <View style={captureStepStyles.scanLine} />
                  </View>

                  <Text style={captureStepStyles.scanTitle}>
                    Position ID in frame
                  </Text>
                  <Text style={captureStepStyles.scanSubtitle}>
                    Capture or upload a clear photo of the visitor&apos;s ID
                    document
                  </Text>
                </View>

                <CaptureIdActionButton
                  title="Capture ID"
                  subtitle="Use camera to take a photo"
                  icon={<Camera size={24} color="#FFFFFF" fill="#FFFFFF" />}
                  color="#0648A8"
                  onPress={() => requestPrivacyThen("captureId")}
                  disabled={isCapturingIdPhoto || isUploadingIdPhoto}
                  loading={isCapturingIdPhoto}
                />

                <CaptureIdActionButton
                  title="Upload Photo"
                  subtitle="Choose from gallery"
                  icon={<UploadCloud size={24} color="#FFFFFF" />}
                  color="#279EED"
                  onPress={() => requestPrivacyThen("uploadId")}
                  disabled={isCapturingIdPhoto || isUploadingIdPhoto}
                  loading={isUploadingIdPhoto}
                />

                <CaptureIdActionButton
                  title="Test OCR Connection"
                  subtitle="Check OCR service status"
                  icon={<Wrench size={24} color="#FFFFFF" fill="#FFFFFF" />}
                  color="#FF9500"
                  onPress={handleRunOCRDiagnostics}
                  disabled={isCapturingIdPhoto || isUploadingIdPhoto}
                />

                <View style={captureStepStyles.requirementsCard}>
                  <View style={captureStepStyles.requirementsHeader}>
                    <ShieldCheck size={26} color="#0648A8" fill="#0648A8" />
                    <Text style={captureStepStyles.requirementsTitle}>
                      ID Requirements
                    </Text>
                  </View>

                  <CaptureIdRequirementItem
                    icon={<IdCard size={24} color="#0648A8" />}
                    text="Valid government-issued ID required"
                  />
                  <CaptureIdRequirementItem
                    icon={<Search size={24} color="#0648A8" />}
                    text="Ensure all details are clearly visible"
                  />
                  <CaptureIdRequirementItem
                    icon={<Lightbulb size={24} color="#0648A8" />}
                    text="Good lighting and no glare"
                  />
                  <CaptureIdRequirementItem
                    icon={<Ban size={24} color="#0648A8" />}
                    text="No expired IDs"
                    isLast
                  />
                </View>
              </>
            ) : (
              <>
                <View style={captureStepStyles.scanCard}>
                  <Image
                    source={{ uri: idPhotoPreview }}
                    style={captureStepStyles.idPreviewImage}
                    resizeMode="cover"
                  />
                  <Text style={captureStepStyles.scanTitle}>
                    ID document preview
                  </Text>
                  <Text style={captureStepStyles.scanSubtitle}>
                    Review the image, then confirm to extract details or retake
                  </Text>
                </View>

                <CaptureIdActionButton
                  title="Confirm ID"
                  subtitle="Extract details and continue"
                  icon={
                    <ShieldCheck size={24} color="#FFFFFF" fill="#FFFFFF" />
                  }
                  color="#22C55E"
                  onPress={handleConfirmIdPhoto}
                />

                <CaptureIdActionButton
                  title="Retake ID"
                  subtitle="Capture a new photo"
                  icon={<RefreshCw size={30} color="#FFFFFF" />}
                  color="#FF9500"
                  onPress={handleRetakeIdPhoto}
                />

                <View style={captureStepStyles.requirementsCard}>
                  <View style={captureStepStyles.requirementsHeader}>
                    <ShieldCheck size={26} color="#22C55E" fill="#22C55E" />
                    <Text
                      style={[
                        captureStepStyles.requirementsTitle,
                        { color: "#15803D" },
                      ]}
                    >
                      ID captured
                    </Text>
                  </View>
                  <Text style={captureStepStyles.previewHintText}>
                    ID document captured. Confirm to run OCR and continue to
                    visitor details, or retake if the image is unclear.
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
        <DataPrivacyNoticeModal
          visible={showPrivacyModal}
          onAgree={handlePrivacyAgree}
          onDecline={handlePrivacyDecline}
        />
        <ReturningVisitorModal
          visible={showReturningModal}
          match={returningMatch}
          mode={returningModalMode}
          onConfirmResume={handleConfirmResumeReturning}
          onCancelNewVisitor={handleCancelReturningAsNew}
        />
        <Modal
          visible={isProcessingId}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {}}
        >
          <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color="#0B2F6B" />
              <Text style={styles.processingTitle}>Processing ID</Text>
              <Text style={styles.processingSubtitle}>
                Analyzing your ID document and extracting information...
              </Text>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  processingCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  processingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  processingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  visitorTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFD700",
    borderRadius: 8,
    marginBottom: 8,
  },
  visitorTypeIcon: {
    fontSize: 16,
    fontWeight: "700",
  },
  visitorTypeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#003D99",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  cameraCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  cameraIcon: {
    fontSize: 56,
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  cameraSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  captureButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "700",
    color: "#FFFFFF",
  },
  diagnosticButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  diagnosticButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
        shadowColor: "#000",
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
    fontWeight: "700",
    marginBottom: 12,
  },
  instructionsList: {
    gap: 10,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bullet: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: -2,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    lineHeight: 20,
  },
  stepPlaceholder: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  placeholderSubtext: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 24,
    textAlign: "center",
  },
  nextButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  detailsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "700",
    marginBottom: 20,
  },
  detailField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
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
    fontWeight: "500",
  },
  fieldInputLocked: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.7,
  },
  confidenceAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  editableNote: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 12,
  },
  qrCodeContainer: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInfo: {
    flex: 1,
  },
  avatarField: {
    marginBottom: 12,
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 4,
  },
  avatarValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldInputText: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  dropdownTouchable: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
  },
  officeOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  detailsSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
  },
  photoDisplaySection: {
    paddingVertical: 12,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  displayPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  enrolleeInfoBox: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  enrolleeInfoLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  enrolleeInfoValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  enrolleeDetailsGrid: {
    gap: 12,
  },
  enrolleeDetailItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  enrolleeDetailLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  enrolleeDetailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  qrCodeBox: {
    alignItems: "center",
    paddingVertical: 16,
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  qrCodePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
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
    fontFamily: "monospace",
    color: "#000000",
    lineHeight: 16,
    letterSpacing: 1,
  },
  qrCodeLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  qrCodeInfo: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    paddingLeft: 12,
  },
  qrCodeInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  stepsList: {
    gap: 10,
    marginTop: 12,
  },
  stepsListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  stepsListNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepsListContent: {
    flex: 1,
  },
  stepsListTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepsListStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  generateButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "700",
    color: "#FFFFFF",
  },
  checkboxGroup: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginVertical: 12,
    gap: 0,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

const captureStepStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0648A8",
  },
  captureScroll: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  scrollContent: {
    paddingBottom: 18,
  },
  header: {
    backgroundColor: "#0648A8",
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 24,
    position: "relative",
    overflow: "hidden",
  },
  headerTop: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTopSpacer: {
    width: 88,
    height: 1,
  },
  visitorBadgeWrapper: {
    zIndex: 2,
    alignItems: "center",
    marginTop: 12,
  },
  captureBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  visitorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFD914",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  badgeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  badgeIconText: {
    color: "#FFD914",
    fontWeight: "900",
    fontSize: 13,
  },
  visitorBadgeText: {
    color: "#0648A8",
    fontSize: 14,
    fontWeight: "900",
  },
  stepTitle: {
    zIndex: 2,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 14,
  },
  progressRow: {
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  progressBar: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  progressActive: {
    backgroundColor: "#FFD914",
  },
  contentPanel: {
    backgroundColor: "#F8FAFC",
    marginTop: -14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  scanCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  scanGraphic: {
    width: 180,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  scanCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: "#0648A8",
  },
  cornerTopLeft: {
    top: 12,
    left: 16,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 12,
    right: 16,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 12,
    left: 16,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 12,
    right: 16,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: "absolute",
    height: 3,
    width: 140,
    borderRadius: 999,
    backgroundColor: "#2CA6F3",
  },
  scanTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  scanSubtitle: {
    color: "#5B6472",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
  },
  idPreviewImage: {
    width: "100%",
    maxWidth: 230,
    height: 160,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "#E5EAF2",
  },
  previewHintText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  actionButton: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionTextWrapper: {
    flex: 1,
  },
  actionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  actionSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  requirementsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  requirementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  requirementsTitle: {
    color: "#0648A8",
    fontSize: 17,
    fontWeight: "900",
    marginLeft: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF2",
  },
  requirementItemLast: {
    borderBottomWidth: 0,
  },
  requirementIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  requirementText: {
    flex: 1,
    color: "#1F2937",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
