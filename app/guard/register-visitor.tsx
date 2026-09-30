import { DataPrivacyNoticeModal } from "@/components/guard/data-privacy-notice-modal";
import { FaceCaptureStepScreen } from "@/components/guard/face-capture-step";
import { ManualVisitorEntryPanel } from "@/components/guard/manual-visitor-entry-panel";
import { type IdExtractionReviewKind } from "@/components/guard/id-extraction-review-modal";
import { MultipleVisitorsFoundModal } from "@/components/guard/multiple-visitors-found-modal";
import {
  PhotoCaptureConsentModal,
  type PhotoCaptureConsentKind,
} from "@/components/guard/photo-capture-consent-modal";
import { ReturningVisitorModal } from "@/components/guard/returning-visitor-modal";
import { VisitorInformationStepScreen } from "@/components/guard/visitor-information-step";
import { Colors } from "@/constants/colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { beginIdCapture } from "./id-auto-capture";
import { buildQRTicketPayloadV1, buildVisitorScanQrJson } from "@/lib/qr-ticket-payload";
import { generateQRToken } from "@/lib/generate-qr-token";
import {
  persistTicketFacePhotoUri,
  setPendingVisitorTicket,
} from "@/lib/visitor-ticket-handoff";
import { cameraService, FACE_PHOTO_QUALITY, ID_PHOTO_QUALITY } from "@/services/camera";
import { supabase } from "@/services/database";
import { officeService } from "@/services/office";
import {
    contractorService,
    enrolleeService,
    normalVisitorService,
    visitorLookupService,
    type NormalVisitorRegistrationInput,
    type ReturningVisitorMatch,
} from "@/services/visitor";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Camera,
    ChevronRight,
    FileText,
    IdCard,
    Keyboard,
    RefreshCw,
    ShieldCheck,
    UploadCloud,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/** Prefer memory handoff + cached face URI over huge Expo Router params. */
async function navigateToQrTicket(
  router: ReturnType<typeof useRouter>,
  ticketData: Record<string, unknown>,
): Promise<void> {
  const facePhotoUri = await persistTicketFacePhotoUri(
    typeof ticketData.facePhotoUri === "string"
      ? ticketData.facePhotoUri
      : undefined,
  );
  const payload = { ...ticketData, facePhotoUri };
  setPendingVisitorTicket(payload);
  router.replace({
    pathname: "/guard/qr-ticket",
    params: { handoff: "1" },
  });
}
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

const SUPPORTED_ID_TYPES = [
  "National ID",
  "UMID",
  "Voter's ID",
  "Driver's License",
  "Senior ID",
] as const;

export default function RegisterVisitorScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [showPhotoConsentModal, setShowPhotoConsentModal] = useState(false);
  const [photoConsentKind, setPhotoConsentKind] =
    useState<PhotoCaptureConsentKind>("face");
  const [facePhotoConsentGiven, setFacePhotoConsentGiven] = useState(false);
  const [idPhotoConsentGiven, setIdPhotoConsentGiven] = useState(false);
  const [privacyPendingAction, setPrivacyPendingAction] =
    useState<PrivacyPendingAction>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFirstName, setManualFirstName] = useState("");
  const [manualLastName, setManualLastName] = useState("");
  const [manualBirthday, setManualBirthday] = useState("");
  const [isCheckingManualVisitor, setIsCheckingManualVisitor] = useState(false);

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
  const [normalVisitorOthersSelected, setNormalVisitorOthersSelected] =
    useState(false);
  const [normalVisitorOtherDestination, setNormalVisitorOtherDestination] =
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
  const [showIdReviewModal, setShowIdReviewModal] = useState(false);
  const [idReviewKind, setIdReviewKind] =
    useState<IdExtractionReviewKind>("medium");
  const pendingIdReviewKindRef = useRef<IdExtractionReviewKind | null>(null);
  const [returningMatch, setReturningMatch] =
    useState<ReturningVisitorMatch | null>(null);
  const [showReturningModal, setShowReturningModal] = useState(false);
  const [multiMatches, setMultiMatches] = useState<ReturningVisitorMatch[]>([]);
  const [showMultiMatchModal, setShowMultiMatchModal] = useState(false);
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
    setNormalVisitorOthersSelected(false);
    setNormalVisitorOtherDestination("");
    setSelectedDestinationOffices((prev) =>
      prev.includes(office)
        ? prev.filter((o) => o !== office)
        : [...prev, office],
    );
  };

  const toggleNormalVisitorOthersDestination = () => {
    setNormalVisitorOthersSelected((prev) => {
      const next = !prev;
      if (next) {
        setSelectedDestinationOffices([]);
      } else {
        setNormalVisitorOtherDestination("");
      }
      return next;
    });
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

  const goBackOneStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleBack = () => {
    // Steps 2–3: confirm before leaving so guards don't lose in-progress details.
    if (step >= 2) {
      Alert.alert(
        "Leave this page?",
        "You have unsaved visitor registration progress. If you go back now, changes on this step may be lost.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Go Back",
            style: "destructive",
            onPress: goBackOneStep,
          },
        ],
      );
      return;
    }
    goBackOneStep();
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
      const stablePreviewUri = await persistTicketFacePhotoUri(result.uri);
      setPhotoPreview(stablePreviewUri || result.uri || null);
    } catch (error) {
      console.error("❌ Error capturing photo:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const clearCaptureSpinners = () => {
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

  const continueAfterPrivacy = (
    action: Exclude<PrivacyPendingAction, null>,
  ) => {
    // Gallery upload only needs the privacy notice.
    if (action === "uploadId") {
      runPendingPrivacyAction(action);
      return;
    }

    const alreadyConsented =
      action === "captureFace" ? facePhotoConsentGiven : idPhotoConsentGiven;

    if (alreadyConsented) {
      runPendingPrivacyAction(action);
      return;
    }

    setPrivacyPendingAction(action);
    setPhotoConsentKind(action === "captureFace" ? "face" : "id");
    setShowPhotoConsentModal(true);
  };

  const requestPrivacyThen = (action: Exclude<PrivacyPendingAction, null>) => {
    // Clear any stuck spinner from a previous hung camera/gallery open.
    clearCaptureSpinners();

    if (privacyConsentGiven) {
      continueAfterPrivacy(action);
      return;
    }

    setPrivacyPendingAction(action);
    setShowPrivacyModal(true);
  };

  const handlePrivacyDecline = () => {
    setShowPrivacyModal(false);
    setPrivacyPendingAction(null);
    clearCaptureSpinners();
  };

  const handlePrivacyAgree = () => {
    const action = privacyPendingAction;
    setPrivacyConsentGiven(true);
    setShowPrivacyModal(false);
    setPrivacyPendingAction(null);
    clearCaptureSpinners();

    if (!action) {
      return;
    }

    // Overlay is already gone (not RN Modal), so next step can open right away.
    requestAnimationFrame(() => {
      continueAfterPrivacy(action);
    });
  };

  const handlePhotoConsentDecline = () => {
    setShowPhotoConsentModal(false);
    setPrivacyPendingAction(null);
    clearCaptureSpinners();
  };

  const handlePhotoConsentAgree = () => {
    const action = privacyPendingAction;
    setShowPhotoConsentModal(false);
    setPrivacyPendingAction(null);
    clearCaptureSpinners();

    if (action === "captureFace") {
      setFacePhotoConsentGiven(true);
    } else if (action === "captureId") {
      setIdPhotoConsentGiven(true);
    }

    if (!action || action === "uploadId") {
      return;
    }

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

          await navigateToQrTicket(router, ticketData);
        } else {
          Alert.alert(
            "Error",
            "Failed to register contractor. Please try again.",
          );
        }
      } else if (visitorType === "normal") {
        const otherDestination = normalVisitorOtherDestination.trim();
        const usingOthersDestination =
          normalVisitorOthersSelected && otherDestination.length > 0;

        let selectedOfficeIds: number[] = [];
        if (!usingOthersDestination) {
          selectedOfficeIds = await officeService.getOfficeIds(
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
        }

        // Register normal visitor and generate QR ticket
        const registrationPayload: NormalVisitorRegistrationInput = {
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
          selectedOfficeIds,
          destinationText: usingOthersDestination
            ? otherDestination
            : undefined,
        };
        const result =
          await normalVisitorService.registerAndGenerateQRTicket(
            registrationPayload,
          );

        if (result) {
          const qrPayload = buildVisitorScanQrJson({
            control_number: result.controlNumber,
            qr_token: result.qrToken,
          });

          const ticketOffices = usingOthersDestination
            ? [{ id: 0, name: otherDestination }]
            : await (async () => {
                const allOffices = await officeService.fetchOffices();
                const byName = new Map(
                  allOffices.map((o) => [o.office_name, o]),
                );
                return selectedDestinationOffices.map((name, index) => {
                  const matched = byName.get(name);
                  return {
                    id: selectedOfficeIds[index] || matched?.office_id || index,
                    name: matched?.office_name || name,
                    floor: matched?.floor?.trim() || undefined,
                  };
                });
              })();

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
            offices: ticketOffices,
            destinationText: usingOthersDestination
              ? otherDestination
              : undefined,
          };

          await navigateToQrTicket(router, ticketData);
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
    requestPrivacyThen("captureFace");
  };

  const handleCaptureIdPhoto = async () => {
    try {
      setIsCapturingIdPhoto(true);
      setIsUploadingIdPhoto(false);
      console.log("📸 Opening auto ID capture");

      const resultPromise = beginIdCapture();
      router.push("/guard/id-auto-capture");
      const result = await resultPromise;

      if (!result.ok) {
        if (!("cancelled" in result && result.cancelled) && "error" in result && result.error) {
          Alert.alert("Camera Error", result.error);
        }
        return;
      }

      console.log("✅ ID photo captured automatically");
      setCapturedIdPhoto(result.base64);
      setIdPhotoPreview(result.uri);

      const waitingForReturningDecision = await extractDataFromIdImage(
        result.base64,
        result.uri,
      );
      if (!waitingForReturningDecision) {
        setStep(2);
      }
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

  const queueIdReviewNotice = (kind: IdExtractionReviewKind | null) => {
    pendingIdReviewKindRef.current = kind;
  };

  const presentPendingIdReviewNotice = () => {
    const kind = pendingIdReviewKindRef.current;
    pendingIdReviewKindRef.current = null;
    if (!kind) return;
    setIdReviewKind(kind);
    setShowIdReviewModal(true);
  };

  const finishIdExtractionAndGoStep2 = () => {
    setShowReturningModal(false);
    setShowMultiMatchModal(false);
    setMultiMatches([]);
    setShowManualEntry(false);
    setStep(2);
    presentPendingIdReviewNotice();
  };

  const openReturningModalForMatch = (match: ReturningVisitorMatch) => {
    if (visitorType === "enrollee") {
      if (match.visitorType === "enrollee" || match.progress) {
        setReturningMatch({
          ...match,
          visitorType: "enrollee",
        });
        setReturningModalMode("enrollee-resume");
        setShowReturningModal(true);
        return;
      }
      setReturningMatch({
        ...match,
        progress: null,
        lastVisitSummary: null,
      });
      setReturningModalMode("identity-confirm");
      setShowReturningModal(true);
      return;
    }

    if (visitorType === "contractor" || visitorType === "normal") {
      setReturningMatch({
        ...match,
        visitorType: visitorType === "contractor" ? "contractor" : "normal",
        progress: null,
        lastVisitSummary: null,
      });
      setReturningModalMode("identity-confirm");
      setShowReturningModal(true);
    }
  };

  /** Returns true when a returning / multi-match UI was shown (do not advance yet). */
  const presentReturningLookupResults = (
    matches: ReturningVisitorMatch[],
  ): boolean => {
    if (matches.length === 0) {
      return false;
    }
    if (matches.length === 1) {
      openReturningModalForMatch(matches[0]);
      return true;
    }
    setMultiMatches(matches);
    setShowMultiMatchModal(true);
    return true;
  };

  const handleConfirmResumeReturning = () => {
    pendingIdReviewKindRef.current = null;
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
          const matches =
            await visitorLookupService.findAllReturningByNameAndBirthday({
              firstName: extractedData.firstName,
              lastName: extractedData.lastName,
              birthday: extractedData.birthday,
            });

          if (matches.length > 0) {
            const reviewKind =
              extractedData.confidence === "medium" ||
              extractedData.confidence === "low"
                ? extractedData.confidence
                : null;
            queueIdReviewNotice(reviewKind);
            setIsProcessingId(false);
            presentReturningLookupResults(matches);
            return true;
          }
        }

        const reviewKind =
          extractedData.confidence === "medium" ||
          extractedData.confidence === "low"
            ? extractedData.confidence
            : null;
        queueIdReviewNotice(reviewKind);
        setIsProcessingId(false);
        return false;
      } else {
        // Extraction failed - guide user to manual entry
        console.warn(
          "⚠️ OCR extraction failed - could not extract usable information from ID",
        );
        setExtractionConfidence("low");
        setOcrExtractionFailed(true);
        queueIdReviewNotice("failed");

        setIsProcessingId(false);
        return false;
      }
    } catch (error) {
      console.error("❌ Error extracting ID data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Details:", errorMessage);

      setOcrExtractionFailed(true);
      queueIdReviewNotice("failed");

      setIsProcessingId(false);
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
      presentPendingIdReviewNotice();
    }
  };

  const handleRetakeIdPhoto = () => {
    console.log("🔄 Retaking ID photo");
    setCapturedIdPhoto(null);
    setIdPhotoPreview(null);
  };

  const applyManualNameBirthdayToForm = (
    firstName: string,
    lastName: string,
    birthday: string,
  ) => {
    setExtractedFirstName(firstName);
    setExtractedLastName(lastName);
    setEnrolleeBirthday(birthday);
    setNormalVisitorFirstName(firstName);
    setNormalVisitorLastName(lastName);
    setNormalVisitorBirthday(birthday);
    setContractorFirstName(firstName);
    setContractorLastName(lastName);
    setContractorBirthday(birthday);
    setOcrExtractionFailed(true);
    setExtractionConfidence(null);
  };

  const handleCheckManualVisitor = async () => {
    const firstName = manualFirstName.trim().replace(/\s+/g, " ");
    const lastName = manualLastName.trim().replace(/\s+/g, " ");
    const birthday = manualBirthday.trim();

    if (!firstName) {
      Alert.alert("Missing First Name", "Please enter the visitor's first name.");
      return;
    }
    if (!lastName) {
      Alert.alert("Missing Last Name", "Please enter the visitor's last name.");
      return;
    }
    if (!birthday) {
      Alert.alert("Missing Birthday", "Please select the visitor's birthday.");
      return;
    }
    if (!isBirthdayValid(birthday)) {
      Alert.alert(
        "Invalid Birthday",
        "Please choose a valid birthday that is not in the future.",
      );
      return;
    }

    try {
      setIsCheckingManualVisitor(true);
      applyManualNameBirthdayToForm(firstName, lastName, birthday);

      const matches =
        await visitorLookupService.findAllReturningByNameAndBirthday({
          firstName,
          lastName,
          birthday,
        });

      if (presentReturningLookupResults(matches)) {
        return;
      }

      Alert.alert(
        "No Existing Record",
        "No matching visitor was found. Continue to enter the remaining details.",
        [
          {
            text: "Continue",
            onPress: () => {
              setShowManualEntry(false);
              setStep(2);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Manual visitor check failed:", error);
      Alert.alert(
        "Lookup Error",
        "Could not check for an existing visitor. Please try again.",
      );
    } finally {
      setIsCheckingManualVisitor(false);
    }
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
      const qrToken = await generateQRToken();

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
              .select("office_id, office_name, floor")
              .in("office_id", officeIds)
          : {
              data: [] as {
                office_id: number;
                office_name: string;
                floor?: string | null;
              }[],
            };
      type OfficeTicketInfo = { name: string; floor: string };
      const officeMap = new Map<number, OfficeTicketInfo>();
      for (const row of officeRows || []) {
        officeMap.set(Number(row.office_id), {
          name: String(row.office_name ?? "").trim(),
          floor: String(row.floor ?? "").trim(),
        });
      }

      let qrPayload: string | undefined;
      if (enrolleeResult.visit_id && steps && steps.length > 0) {
        const route = steps.map(
          (
            s: { office_id: number; step_order?: number; step_name?: string },
            i: number,
          ) => {
            const office = officeMap.get(s.office_id);
            return {
              order: s.step_order ?? i + 1,
              office_id: s.office_id,
              office_name:
                office?.name ||
                s.step_name ||
                `Office ${s.office_id}`,
              floor: office?.floor || undefined,
            };
          },
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
        floor?: string;
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
            const office = officeMap.get(s.office_id);
            const officeName =
              office?.name || `Office ${s.office_id ?? ""}`;
            return {
              id: s.office_id,
              name: officeName,
              floor: office?.floor || undefined,
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

      await navigateToQrTicket(router, {
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
          });

      if (__DEV__) {
        console.log("✅ Enrollee created with office-route QR");
        console.log("Enrollee ID:", enrolleeResult.enrollee_id);
        console.log("Pass Number:", pass);
        console.log("Control Number:", control);
        console.log("Visitor ID:", enrolleeResult.visitor_id);
      }
      setIsCreatingEnrollee(false);
    } catch (error) {
      console.error("❌ Error creating enrollee:", error);
      Alert.alert("Error", "Failed to create enrollee. Please try again.");
      setIsCreatingEnrollee(false);
    }
  };

  if (step === 2) {
    const reviewNotice = {
      visible: showIdReviewModal,
      kind: idReviewKind,
      onContinue: () => setShowIdReviewModal(false),
    };

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
          reviewNotice={reviewNotice}
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
          reviewNotice={reviewNotice}
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
        showOthersDestinationOption
        othersDestinationSelected={normalVisitorOthersSelected}
        onToggleOthersDestination={toggleNormalVisitorOthersDestination}
        othersDestinationText={normalVisitorOtherDestination}
        onChangeOthersDestinationText={setNormalVisitorOtherDestination}
        onBack={handleBack}
        onContinue={() => {
          const missingFields: string[] = [];
          if (!normalVisitorFirstName?.trim()) missingFields.push("First Name");
          if (!normalVisitorLastName?.trim()) missingFields.push("Last Name");
          if (!normalVisitorBirthday?.trim()) missingFields.push("Birthday");
          if (!normalVisitorPassNumber?.trim())
            missingFields.push("ID Pass Number");
          if (!normalVisitorContactNo?.trim()) missingFields.push("Contact No");
          if (normalVisitorOthersSelected) {
            if (!normalVisitorOtherDestination.trim()) {
              missingFields.push("Other Destination");
            }
          } else if (selectedDestinationOffices.length === 0) {
            missingFields.push("Destination Office");
          }
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
        reviewNotice={reviewNotice}
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
        <PhotoCaptureConsentModal
          visible={showPhotoConsentModal}
          kind={photoConsentKind}
          onAgree={handlePhotoConsentAgree}
          onDecline={handlePhotoConsentDecline}
        />
      </View>
    );
  }

  if (step === 1) {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={captureStepStyles.safeArea} edges={["bottom", "left", "right"]}>
          <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

          <View style={captureStepStyles.layout}>
            <View style={[captureStepStyles.header, { paddingTop: insets.top + 12 }]}>
              <CaptureIdHeaderPattern />

              <View style={captureStepStyles.headerTop}>
                <TouchableOpacity
                  style={captureStepStyles.captureBackButton}
                  onPress={handleBack}
                >
                  <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.8} />
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

            {showManualEntry ? (
              <ManualVisitorEntryPanel
                firstName={manualFirstName}
                onChangeFirstName={setManualFirstName}
                lastName={manualLastName}
                onChangeLastName={setManualLastName}
                birthday={manualBirthday}
                onChangeBirthday={setManualBirthday}
                birthdayColors={colors}
                isChecking={isCheckingManualVisitor}
                onBackToIdScan={() => setShowManualEntry(false)}
                onCheckVisitor={() => {
                  void handleCheckManualVisitor();
                }}
              />
            ) : (
            <ScrollView
              style={captureStepStyles.captureScroll}
              contentContainerStyle={captureStepStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
            >
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
                  subtitle="Auto-capture when the ID is in frame"
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
                  title="Manual Entry"
                  subtitle="Type name and birthday to look up visitor"
                  icon={<Keyboard size={24} color="#FFFFFF" strokeWidth={2.3} />}
                  color="#FF9500"
                  onPress={() => setShowManualEntry(true)}
                  disabled={isCapturingIdPhoto || isUploadingIdPhoto}
                />

                <View style={captureStepStyles.requirementsCard}>
                  <View style={captureStepStyles.requirementsHeader}>
                    <IdCard size={26} color="#0648A8" />
                    <View style={captureStepStyles.requirementsHeaderText}>
                      <Text style={captureStepStyles.requirementsTitle}>
                        Supported ID Types
                      </Text>
                      <Text style={captureStepStyles.requirementsSubtitle}>
                        Present a clear photo of one valid government-issued ID
                      </Text>
                    </View>
                  </View>

                  {SUPPORTED_ID_TYPES.map((idType, index) => (
                    <CaptureIdRequirementItem
                      key={idType}
                      icon={<IdCard size={22} color="#0648A8" />}
                      text={idType}
                      isLast={index === SUPPORTED_ID_TYPES.length - 1}
                    />
                  ))}
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
                    <View style={captureStepStyles.requirementsHeaderText}>
                      <Text
                        style={[
                          captureStepStyles.requirementsTitle,
                          { color: "#15803D" },
                        ]}
                      >
                        ID captured
                      </Text>
                    </View>
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
            )}
          </View>
      </SafeAreaView>
        <DataPrivacyNoticeModal
          visible={showPrivacyModal}
          onAgree={handlePrivacyAgree}
          onDecline={handlePrivacyDecline}
        />
        <PhotoCaptureConsentModal
          visible={showPhotoConsentModal}
          kind={photoConsentKind}
          onAgree={handlePhotoConsentAgree}
          onDecline={handlePhotoConsentDecline}
        />
        <ReturningVisitorModal
          visible={showReturningModal}
          match={returningMatch}
          mode={returningModalMode}
          onConfirmResume={handleConfirmResumeReturning}
          onCancelNewVisitor={handleCancelReturningAsNew}
        />
        <MultipleVisitorsFoundModal
          visible={showMultiMatchModal}
          matches={multiMatches}
          onUseSelected={(match) => {
            setShowMultiMatchModal(false);
            setMultiMatches([]);
            openReturningModalForMatch(match);
          }}
          onCreateNewVisitor={() => {
            setShowMultiMatchModal(false);
            setMultiMatches([]);
            setReturningMatch(null);
            setResumeExistingVisitor(false);
            finishIdExtractionAndGoStep2();
          }}
          onClose={() => {
            setShowMultiMatchModal(false);
          }}
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
              <Text style={styles.processingTitle}>Reading ID…</Text>
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
  layout: {
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
    width: 44,
    height: 1,
  },
  visitorBadgeWrapper: {
    zIndex: 2,
    alignItems: "center",
    marginTop: 12,
  },
  captureBackButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
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
    marginTop: 0,
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
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  requirementsHeaderText: {
    flex: 1,
  },
  requirementsTitle: {
    color: "#0648A8",
    fontSize: 17,
    fontWeight: "900",
  },
  requirementsSubtitle: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
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
