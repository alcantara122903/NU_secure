import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseQrTicketRaw } from '@/lib/qr-ticket-payload';
import { authSessionService } from '@/services/auth-session';
import { officeExitApiService } from '@/services/office-exit-api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
  const isProcessingRef = useRef(false);

  const handleBack = () => {
    if (scannedInfo) {
      setScannedInfo(null);
      setScanState({ type: 'idle' });
    } else {
      router.back();
    }
  };

  const onQRCodeScanned = async (rawValue: string) => {
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

      setScannedInfo({
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
      });
      setScanState({ type: 'idle' });
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

  const resetScanner = () => {
    setScanState({ type: 'idle' });
  };

  const handleCompleteExit = () => {
    setScannedInfo(null);
    setScanState({ type: 'idle' });
    router.back();
  };

  if (scannedInfo) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Process visitor exit</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.successCard, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="logout" size={48} color={colors.primary} />
            <Text style={[styles.successTitle, { color: colors.text }]}>Exit recorded</Text>
            <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              Visit closed — times below are from this visit record
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Visitor</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.name}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Entry time</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.entryTimeFormatted}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Exit time</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.exitTimeFormatted}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.durationLabel}</Text>
            </View>
            {scannedInfo.exitStatusName ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Exit status</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.exitStatusName}</Text>
                </View>
              </>
            ) : null}
            {scannedInfo.passNumber ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Pass number</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.passNumber}</Text>
                </View>
              </>
            ) : null}
            {scannedInfo.controlNumber ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Control number</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.controlNumber}</Text>
                </View>
              </>
            ) : null}
            {scannedInfo.destinationOffice || scannedInfo.destinationText ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Destination</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {[scannedInfo.destinationOffice, scannedInfo.destinationText].filter(Boolean).join(' · ') ||
                      '—'}
                  </Text>
                </View>
              </>
            ) : null}
            {scannedInfo.purposeReason ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={[styles.infoRow, styles.infoRowMultiline]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Purpose</Text>
                  <Text style={[styles.infoValueMultiline, { color: colors.text }]}>{scannedInfo.purposeReason}</Text>
                </View>
              </>
            ) : null}
            {scannedInfo.registeredBy ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Registered by</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{scannedInfo.registeredBy}</Text>
                </View>
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: colors.primary }]}
            onPress={handleCompleteExit}
            activeOpacity={0.8}
          >
            <MaterialIcons name="check-circle" size={28} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Done</Text>
          </TouchableOpacity>
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

      <ScrollView
        style={styles.exitContainer}
        contentContainerStyle={styles.exitScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.exitHeader}>
          <TouchableOpacity style={styles.exitBackButton} activeOpacity={0.75} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={30} color="#FFFFFF" />
            <Text style={styles.exitBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.exitHeaderTitle}>Process visitor exit</Text>
          <View style={styles.exitHeaderRightSpace} />
        </View>

        <View style={styles.exitScannerCard}>
          <View style={styles.exitCameraBox}>
            {hasCameraPermission ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanState.type === 'idle' ? (event) => void onQRCodeScanned(event.data) : undefined}
              />
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
  exitSafeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  exitContainer: {
    flex: 1,
    backgroundColor: '#F4F7FB',
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
});
