import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseQrTicketRaw } from '@/lib/qr-ticket-payload';
import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database';
import { officeExitApiService } from '@/services/office-exit-api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScannedInfo {
  name?: string;
  /** Primary office name from `visit.primary_office_id` → `office.office_name`. */
  destinationOffice?: string | null;
  /** `visit.destination_text` when set. */
  destinationText?: string | null;
  entryTimeFormatted?: string;
  exitTimeFormatted?: string;
  durationLabel?: string;
  passNumber?: string | null;
  purposeReason?: string | null;
  registeredBy?: string | null;
  exitStatusName?: string | null;
  visitId?: number;
  visitorId?: number;
  controlNumber?: string;
  message?: string;
  pictureUrl?: string | null;
}

type GuardScanState =
  | { type: 'idle' }
  | { type: 'processing' }
  | { type: 'error'; message: string };

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDurationMinutes = (m: number): string => {
  if (m < 1) {
    return 'Under 1 minute';
  }
  if (m < 60) {
    return `${m} min`;
  }
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h} hr ${min} min` : `${h} hr`;
};

const resolvePhotoUri = (raw: string | null | undefined): string => {
  const value = (raw || '').trim();
  if (!value) {
    return '';
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const trimmed = value.replace(/^\/+/, '');
  const storagePath = trimmed.startsWith('visitor-files/') ? trimmed.slice('visitor-files/'.length) : trimmed;
  if (!storagePath) {
    return '';
  }
  const { data } = supabase.storage.from('visitor-files').getPublicUrl(storagePath);
  return data.publicUrl || '';
};

const extractQrToken = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  const v1 = parseQrTicketRaw(trimmed);
  if (v1.payload != null && v1.qr_token) {
    return v1.qr_token;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (parsed?.qrToken && typeof parsed.qrToken === 'string') {
      return parsed.qrToken;
    }
    if (parsed?.qr_token && typeof parsed.qr_token === 'string') {
      return parsed.qr_token;
    }
  } catch {
    // Not JSON; continue parsing below.
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return (
        url.searchParams.get('token') ||
        url.searchParams.get('qrToken') ||
        url.searchParams.get('qr_token') ||
        trimmed
      );
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

export default function ExitScanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<GuardScanState>({ type: 'idle' });
  const [scannedInfo, setScannedInfo] = useState<ScannedInfo | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRaw, setManualRaw] = useState('');
  /** Unmount CameraView before mounting the result tree — avoids Fabric addViewAt crashes on Android. */
  const [exitCameraSuppressed, setExitCameraSuppressed] = useState(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!scannedInfo) {
      setExitCameraSuppressed(false);
    }
  }, [scannedInfo]);

  const handleBack = () => {
    if (scannedInfo) {
      setScannedInfo(null);
      setScanState({ type: 'idle' });
    } else {
      router.back();
    }
  };

  const processExitFromRawValue = async (rawValue: string) => {
    if (!rawValue || isProcessingRef.current || scannedInfo) {
      return;
    }

    const scannedByUserId = authSessionService.getCurrentUserId();
    if (!scannedByUserId) {
      setScanState({
        type: 'error',
        message: 'Session not found. Please log in again.',
      });
      return;
    }

    const qrToken = extractQrToken(rawValue);

    isProcessingRef.current = true;
    setScanState({ type: 'processing' });

    try {
      const result = await officeExitApiService.processExitScan({
        qrToken,
        rawQrValue: rawValue,
        scannedByUserId,
        scannerContext: 'guard',
      });

      if (!result.success || !result.data) {
        setScanState({
          type: 'error',
          message: result.message || 'QR is invalid, already exited, or not found.',
        });
        return;
      }

      const info: ScannedInfo = {
        name: result.data.visitorName,
        destinationOffice: result.data.destinationOffice,
        destinationText: result.data.destinationText ?? null,
        entryTimeFormatted: formatDateTime(result.data.entryTime),
        exitTimeFormatted: formatDateTime(result.data.exitTime),
        durationLabel: formatDurationMinutes(result.data.durationMinutes),
        passNumber: result.data.passNumber,
        purposeReason: result.data.purposeReason,
        registeredBy: result.data.registeredBy,
        exitStatusName: result.data.exitStatusName ?? null,
        visitId: result.data.visitId,
        visitorId: result.data.visitorId,
        controlNumber: result.data.controlNumber || undefined,
        message: result.message || 'Visitor exit processed successfully.',
        pictureUrl: result.data.visitorPhotoUrl ?? null,
      };

      const showResult = () => {
        setScannedInfo(info);
        setScanState({ type: 'idle' });
        setExitCameraSuppressed(false);
        setShowManualEntry(false);
        setManualRaw('');
      };

      setExitCameraSuppressed(true);
      InteractionManager.runAfterInteractions(() => {
        if (Platform.OS === 'android') {
          requestAnimationFrame(() => {
            setTimeout(showResult, 450);
          });
        } else {
          requestAnimationFrame(() => {
            requestAnimationFrame(showResult);
          });
        }
      });
    } catch (err) {
      console.error('❌ Error scanning QR:', err);
      setScanState({
        type: 'error',
        message: 'Error processing QR code. Please try again.',
      });
    } finally {
      isProcessingRef.current = false;
    }
  };

  const onQRCodeScanned = async (rawValue: string) => {
    await processExitFromRawValue(rawValue);
  };

  const handleManualSubmit = () => {
    const value = manualRaw.trim();
    if (!value || scanState.type === 'processing') {
      return;
    }
    void processExitFromRawValue(value);
  };

  const resetScanner = () => {
    setExitCameraSuppressed(false);
    setScanState({ type: 'idle' });
    setManualRaw('');
    setShowManualEntry(false);
  };

  const handleCompleteExit = () => {
    setScannedInfo(null);
    setScanState({ type: 'idle' });
    router.back();
  };

  if (scannedInfo) {
    const ghVisitor = {
      gh_full_name: scannedInfo.name || 'Visitor',
      gh_pass_number: scannedInfo.passNumber || '—',
      gh_control_number: scannedInfo.controlNumber || '—',
      gh_destination: [scannedInfo.destinationOffice, scannedInfo.destinationText].filter(Boolean).join(' · ') || '—',
      gh_purpose: scannedInfo.purposeReason || '—',
      gh_entry_time: scannedInfo.entryTimeFormatted || '—',
      gh_exit_time: scannedInfo.exitTimeFormatted || '—',
      gh_duration: scannedInfo.durationLabel || '—',
      gh_exit_status: scannedInfo.exitStatusName || 'Completed',
      gh_picture:
        resolvePhotoUri(scannedInfo.pictureUrl) ||
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    };

    return (
      <SafeAreaView style={styles.gh_safe_area}>
        <StatusBar barStyle="light-content" backgroundColor="#0A4DB3" />

        <View style={styles.gh_header}>
          <View style={styles.gh_header_bg_icon_left}>
            <MaterialIcons name="business" size={120} color="rgba(255,255,255,0.06)" />
          </View>

          <View style={styles.gh_header_bg_icon_right}>
            <MaterialIcons name="shield" size={140} color="rgba(255,255,255,0.07)" />
          </View>

          <TouchableOpacity style={styles.gh_back_button} activeOpacity={0.8} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.gh_header_title}>Process visitor exit</Text>
        </View>

        <ScrollView
          style={styles.gh_container}
          contentContainerStyle={styles.gh_scroll_content}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <View style={styles.gh_main_wrapper}>
            <View style={styles.gh_success_card}>
              <View style={styles.gh_success_left}>
                <View style={styles.gh_success_icon_outer}>
                  <View style={styles.gh_success_icon_inner}>
                    <MaterialIcons name="check" size={38} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              <View style={styles.gh_success_center}>
                <Text style={styles.gh_success_title}>Exit processed!</Text>

                <View style={styles.gh_success_badge}>
                  <Text style={styles.gh_success_badge_text}>{ghVisitor.gh_exit_status}</Text>
                </View>
              </View>

              <View style={styles.gh_success_right}>
                <MaterialIcons name="verified-user" size={34} color="#BEEFD3" />
              </View>
            </View>

            <View style={styles.gh_profile_card}>
              <View style={styles.gh_profile_left}>
                <Image source={{ uri: ghVisitor.gh_picture }} style={styles.gh_profile_image} resizeMode="cover" />

                <View style={styles.gh_profile_info_block}>
                  <View style={styles.gh_info_row}>
                    <MaterialIcons name="person" size={22} color="#0A4DB3" />
                    <View style={styles.gh_info_text_wrap}>
                      <Text style={styles.gh_info_label}>Full Name</Text>
                      <Text style={styles.gh_info_value}>{ghVisitor.gh_full_name}</Text>
                    </View>
                  </View>

                  <View style={styles.gh_line} />

                  <View style={styles.gh_info_row}>
                    <MaterialIcons name="credit-card" size={22} color="#0A4DB3" />
                    <View style={styles.gh_info_text_wrap}>
                      <Text style={styles.gh_info_label}>Pass Number</Text>
                      <Text style={styles.gh_info_value}>{ghVisitor.gh_pass_number}</Text>
                    </View>
                  </View>

                  <View style={styles.gh_line} />

                  <View style={styles.gh_info_row}>
                    <MaterialIcons name="assignment" size={22} color="#0A4DB3" />
                    <View style={styles.gh_info_text_wrap}>
                      <Text style={styles.gh_info_label}>Control Number</Text>
                      <Text style={styles.gh_info_value_blue}>{ghVisitor.gh_control_number}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.gh_profile_right}>
                <View style={styles.gh_summary_top}>
                  <Text style={styles.gh_summary_title}>Visit Summary</Text>
                </View>

                <View style={styles.gh_summary_item}>
                  <View style={styles.gh_summary_item_left}>
                    <MaterialIcons name="login" size={20} color="#0A4DB3" />
                    <Text style={styles.gh_summary_label}>Entry time</Text>
                  </View>
                  <Text style={styles.gh_summary_value}>{ghVisitor.gh_entry_time}</Text>
                </View>

                <View style={styles.gh_summary_divider} />

                <View style={styles.gh_summary_item}>
                  <View style={styles.gh_summary_item_left}>
                    <MaterialIcons name="logout" size={20} color="#0A4DB3" />
                    <Text style={styles.gh_summary_label}>Exit time</Text>
                  </View>
                  <Text style={styles.gh_summary_value}>{ghVisitor.gh_exit_time}</Text>
                </View>

                <View style={styles.gh_summary_divider} />

                <View style={styles.gh_summary_item}>
                  <View style={styles.gh_summary_item_left}>
                    <MaterialIcons name="schedule" size={20} color="#0A4DB3" />
                    <Text style={styles.gh_summary_label}>Duration</Text>
                  </View>
                  <Text style={styles.gh_summary_value_green}>{ghVisitor.gh_duration}</Text>
                </View>

                <View style={styles.gh_summary_divider} />

                <View style={styles.gh_summary_item}>
                  <View style={styles.gh_summary_item_left}>
                    <MaterialIcons name="check-circle-outline" size={20} color="#0A4DB3" />
                    <Text style={styles.gh_summary_label}>Exit status</Text>
                  </View>

                  <View style={styles.gh_status_chip}>
                    <MaterialIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.gh_status_chip_text}>{ghVisitor.gh_exit_status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.gh_bottom_strip}>
                <View style={styles.gh_bottom_item}>
                  <MaterialIcons name="track-changes" size={24} color="#0A4DB3" />
                  <View style={styles.gh_bottom_text_wrap}>
                    <Text style={styles.gh_bottom_label}>Purpose</Text>
                    <Text style={styles.gh_bottom_value}>{ghVisitor.gh_purpose}</Text>
                  </View>
                </View>

                <View style={styles.gh_bottom_vertical_line} />

                <View style={styles.gh_bottom_item}>
                  <MaterialIcons name="business" size={24} color="#0A4DB3" />
                  <View style={styles.gh_bottom_text_wrap}>
                    <Text style={styles.gh_bottom_label}>Destination</Text>
                    <Text style={styles.gh_bottom_value}>{ghVisitor.gh_destination}</Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.gh_done_button} activeOpacity={0.85} onPress={handleCompleteExit}>
              <View style={styles.gh_done_icon_circle}>
                <MaterialIcons name="check" size={30} color="#0A4DB3" />
              </View>
              <Text style={styles.gh_done_button_text}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return null;
  }

  const hasCameraPermission = permission.granted;
  const scanned = scanState.type !== 'idle';
  const helperText =
    scanState.type === 'processing'
      ? 'QR detected. Processing exit...'
      : scanState.type === 'error'
        ? scanState.message
        : 'Position QR code within the frame';

  return (
    <SafeAreaView style={styles.exitSafeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#064AA5" />

      <View style={styles.exitHeader}>
        <TouchableOpacity style={styles.exitBackButton} activeOpacity={0.75} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={30} color="#FFFFFF" />
          <Text style={styles.exitBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.exitHeaderTitle}>Process visitor exit</Text>
        <View style={styles.exitHeaderRightSpace} />
      </View>

      {/*
        CameraView must NOT be inside ScrollView on Android Fabric — causes
        "child already has a parent" / ReactClippingViewManager when swapping UI after scan.
      */}
      <View style={styles.exitMainColumn}>
        <View style={styles.exitScannerCard}>
          <View style={styles.exitCameraBox} collapsable={false}>
            {hasCameraPermission && !exitCameraSuppressed ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanState.type === 'idle' ? (event) => void onQRCodeScanned(event.data) : undefined}
              />
            ) : hasCameraPermission && exitCameraSuppressed ? (
              <View
                style={[StyleSheet.absoluteFillObject, styles.exitCameraPlaceholder]}
                pointerEvents="none"
              >
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.exitPermissionBox}>
                <MaterialIcons name="camera-alt" size={56} color="#FFFFFF" />
                <Text style={styles.exitPermissionTitle}>Camera permission needed</Text>
                <Text style={styles.exitPermissionText}>Allow camera access to scan the visitor exit QR code.</Text>
                <TouchableOpacity style={styles.exitPermissionButton} activeOpacity={0.85} onPress={requestPermission}>
                  <Text style={styles.exitPermissionButtonText}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            )}

            {hasCameraPermission && <View style={styles.exitCameraOverlay} />}
            {hasCameraPermission && (
              <>
                <TouchableOpacity style={styles.exitCameraActionLeft} activeOpacity={0.8}>
                  <MaterialIcons name="flash-on" size={24} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.exitCameraActionRight} activeOpacity={0.8}>
                  <MaterialIcons name="image" size={24} color="#111827" />
                </TouchableOpacity>
              </>
            )}

            <View style={styles.exitScanFrame}>
              <View style={[styles.exitScanCorner, styles.exitCornerTopLeft]} />
              <View style={[styles.exitScanCorner, styles.exitCornerTopRight]} />
              <View style={[styles.exitScanCorner, styles.exitCornerBottomLeft]} />
              <View style={[styles.exitScanCorner, styles.exitCornerBottomRight]} />
              <View style={styles.exitCenterQrIcon}>
                <MaterialIcons name="qr-code-scanner" size={36} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.exitHelperPill}>
              <View style={styles.exitHelperIconCircle}>
                {scanState.type === 'processing' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons
                    name={scanState.type === 'error' ? 'error-outline' : scanned ? 'check-circle-outline' : 'verified-user'}
                    size={20}
                    color="#FFFFFF"
                  />
                )}
              </View>
              <Text style={styles.exitHelperPillText}>{helperText}</Text>
            </View>
          </View>

          <View style={styles.exitScannerTextBox}>
            <Text style={styles.exitScannerTitle}>Position QR Code in frame</Text>
            <Text style={styles.exitScannerSubtitle}>Hold steady for scanning</Text>
          </View>
        </View>

        <View style={styles.exitManualSection}>
          {!showManualEntry ? (
            <TouchableOpacity
              style={styles.exitManualButton}
              activeOpacity={0.85}
              onPress={() => setShowManualEntry(true)}
            >
              <View style={styles.exitManualIconBox}>
                <MaterialIcons name="dialpad" size={22} color="#064AA5" />
              </View>
              <Text style={styles.exitManualButtonText}>Enter code manually</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.exitManualEntryCard}>
              <Text style={styles.exitManualEntryTitle}>Raw QR contents</Text>
              <TextInput
                style={styles.exitManualInput}
                placeholder="Paste JSON, QR token, pass number, or control number"
                placeholderTextColor="#6B7280"
                value={manualRaw}
                onChangeText={setManualRaw}
                multiline
                editable={scanState.type !== 'processing'}
              />
              <TouchableOpacity
                style={[
                  styles.exitManualSubmitButton,
                  { opacity: scanState.type === 'processing' ? 0.6 : 1 },
                ]}
                activeOpacity={0.85}
                onPress={handleManualSubmit}
                disabled={scanState.type === 'processing'}
              >
                <Text style={styles.exitManualSubmitButtonText}>Process Exit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exitManualCancelButton}
                activeOpacity={0.85}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualRaw('');
                }}
              >
                <Text style={styles.exitManualCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.exitTipsScroll}
          contentContainerStyle={styles.exitScrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
        >
          {scanned && (
            <TouchableOpacity style={styles.exitRescanButton} activeOpacity={0.85} onPress={resetScanner}>
              <MaterialIcons name="refresh" size={22} color="#064AA5" />
              <Text style={styles.exitRescanText}>Scan Again</Text>
            </TouchableOpacity>
          )}

          <View style={styles.exitTipsCard}>
            <View style={styles.exitTipsHeader}>
              <View style={styles.exitTipsHeaderIcon}>
                <MaterialIcons name="lightbulb-outline" size={24} color="#064AA5" />
              </View>
              <Text style={styles.exitTipsTitle}>How to scan:</Text>
            </View>
            <TipItem icon="smartphone" text="Hold phone steady and level" />
            <TipItem icon="qr-code-scanner" text="Position QR code within the frame" />
            <TipItem icon="access-time" text="Wait for automatic detection" last />

            <View style={styles.exitNoteBox}>
              <View style={styles.exitNoteIcon}>
                <MaterialIcons name="info" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.exitNoteText}>
                Point the camera at the visitor ticket; exit is recorded when the code is read successfully.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TipItem({ icon, text, last }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; text: string; last?: boolean }) {
  return (
    <View style={[styles.exitTipItem, last && styles.exitTipItemLast]}>
      <View style={styles.exitTipIconBox}>
        <MaterialIcons name={icon} size={22} color="#064AA5" />
      </View>
      <Text style={styles.exitTipText}>{text}</Text>
    </View>
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
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  cameraSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    minHeight: 280,
  },
  cameraOuter: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
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
  cameraInner: {
    width: '100%',
    flex: 1,
    minHeight: 220,
    maxHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  scannerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  instructionsBlock: {
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  instructionLine: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 22,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  panelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultBlock: {
    alignItems: 'stretch',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  permissionTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  permissionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  successCard: {
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
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
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
  infoRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowMultiline: {
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  infoValueMultiline: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
    lineHeight: 20,
  },
  divider: {
    height: 1,
  },
  completeButton: {
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
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gh_safe_area: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  gh_container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  gh_scroll_content: {
    paddingBottom: 20,
  },
  gh_header: {
    backgroundColor: '#0A4DB3',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'visible',
    position: 'relative',
  },
  gh_header_bg_icon_left: {
    position: 'absolute',
    left: -15,
    bottom: -20,
  },
  gh_header_bg_icon_right: {
    position: 'absolute',
    right: -20,
    top: 5,
  },
  gh_back_button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  gh_header_title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -42,
  },
  gh_main_wrapper: {
    marginTop: -10,
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  gh_success_card: {
    backgroundColor: '#F3FFF8',
    borderWidth: 1,
    borderColor: '#D7F3E3',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  gh_success_left: {
    marginRight: 10,
  },
  gh_success_icon_outer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#E9FCF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gh_success_icon_inner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gh_success_center: {
    flex: 1,
  },
  gh_success_title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  gh_success_badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gh_success_badge_text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gh_success_right: {
    marginLeft: 6,
  },
  gh_profile_card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  gh_profile_left: {
    flexDirection: 'row',
  },
  gh_profile_image: {
    width: 92,
    height: 108,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4F0',
    backgroundColor: '#E5E7EB',
  },
  gh_profile_info_block: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  gh_info_row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  gh_info_text_wrap: {
    marginLeft: 8,
    flex: 1,
  },
  gh_info_label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  gh_info_value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  gh_info_value_blue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A4DB3',
  },
  gh_line: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  gh_profile_right: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D9E5F5',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FAFCFF',
  },
  gh_summary_top: {
    marginBottom: 4,
  },
  gh_summary_title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A4DB3',
  },
  gh_summary_item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gh_summary_item_left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  gh_summary_label: {
    marginLeft: 6,
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  gh_summary_value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  gh_summary_value_green: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: '#16A34A',
  },
  gh_summary_divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  gh_status_chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFBF0',
    borderWidth: 1,
    borderColor: '#BEE7CB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gh_status_chip_text: {
    marginLeft: 6,
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },
  gh_bottom_strip: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D9E5F5',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBFDFF',
  },
  gh_bottom_item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gh_bottom_text_wrap: {
    marginLeft: 8,
    flex: 1,
  },
  gh_bottom_label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  gh_bottom_value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  gh_bottom_vertical_line: {
    width: 1,
    height: 34,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  gh_done_button: {
    marginTop: 14,
    backgroundColor: '#0A4DB3',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0A4DB3',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gh_done_icon_circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  gh_done_button_text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  exitSafeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  exitMainColumn: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  exitTipsScroll: {
    flex: 1,
  },
  exitScrollContent: {
    paddingBottom: 24,
  },
  exitHeader: {
    height: 82,
    backgroundColor: '#064AA5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  exitBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 92,
  },
  exitBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  exitHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  exitHeaderRightSpace: {
    width: 92,
  },
  exitScannerCard: {
    marginHorizontal: 14,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#E6ECF5',
  },
  exitCameraBox: {
    height: 360,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitCameraPlaceholder: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
    zIndex: 1,
  },
  exitPermissionBox: {
    flex: 1,
    width: '100%',
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  exitPermissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  exitPermissionText: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  exitPermissionButton: {
    marginTop: 20,
    backgroundColor: '#064AA5',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  exitPermissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  exitCameraActionLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  exitCameraActionRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  exitScanFrame: {
    width: '72%',
    height: 220,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 3,
  },
  exitScanCorner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#FFFFFF',
  },
  exitCornerTopLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 14,
  },
  exitCornerTopRight: {
    top: 12,
    right: 12,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 14,
  },
  exitCornerBottomLeft: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 14,
  },
  exitCornerBottomRight: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 14,
  },
  exitCenterQrIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(6,74,165,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitHelperPill: {
    position: 'absolute',
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30,
    zIndex: 4,
  },
  exitHelperIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#064AA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  exitHelperPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  exitScannerTextBox: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 2,
  },
  exitScannerTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  exitScannerSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  exitRescanButton: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 7,
  },
  exitRescanText: {
    color: '#064AA5',
    fontSize: 13.5,
    fontWeight: '800',
  },
  exitTipsCard: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E6ECF5',
  },
  exitTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  exitTipsHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAF1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  exitTipsTitle: {
    color: '#064AA5',
    fontSize: 18,
    fontWeight: '900',
  },
  exitTipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
  },
  exitTipItemLast: {
    borderBottomWidth: 0,
  },
  exitTipIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAF1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  exitTipText: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  exitNoteBox: {
    marginTop: 12,
    backgroundColor: '#F8FBFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exitNoteIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#064AA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  exitNoteText: {
    flex: 1,
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  /** Manual entry sits below scanner card subtitle, not inside the subtitle block. */
  exitManualSection: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  exitManualButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#064AA5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  exitManualIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#EAF1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  exitManualButtonText: {
    fontSize: 14,
    color: '#064AA5',
    fontWeight: '800',
  },
  exitManualEntryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBE4F0',
    padding: 12,
  },
  exitManualEntryTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
  },
  exitManualInput: {
    borderWidth: 1,
    borderColor: '#DBE4F0',
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#111827',
  },
  exitManualSubmitButton: {
    marginTop: 14,
    backgroundColor: '#064AA5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitManualSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  exitManualCancelButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  exitManualCancelText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
});
