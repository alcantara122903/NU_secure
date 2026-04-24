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
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Process visitor exit</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>Loading camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Process visitor exit</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centeredContent}>
          <MaterialIcons name="camera-alt" size={56} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access required</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            Exit scan needs the camera to read the visitor QR code.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Process visitor exit</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.cameraSection}>
        <View style={[styles.cameraOuter, { backgroundColor: colors.surface }]}>
          <View style={[styles.cameraInner, { borderColor: colors.border }]}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={
                scanState.type === 'idle' ? (event) => void onQRCodeScanned(event.data) : undefined
              }
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={[styles.scanFrame, { borderColor: colors.primary }]} />
            </View>
          </View>
          <Text style={[styles.scannerTitle, { color: colors.text }]}>Position QR Code in frame</Text>
          <Text style={[styles.scannerSubtitle, { color: colors.textSecondary }]}>Hold steady for scanning</Text>
        </View>
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: colors.surface }]}>
        {scanState.type === 'idle' ? (
          <>
            <View style={styles.instructionsBlock}>
              <Text style={[styles.instructionsTitle, { color: colors.primary }]}>How to scan:</Text>
              <Text style={[styles.instructionLine, { color: colors.text }]}>• Hold phone steady and level</Text>
              <Text style={[styles.instructionLine, { color: colors.text }]}>• Position QR code within the frame</Text>
              <Text style={[styles.instructionLine, { color: colors.text }]}>• Wait for automatic detection</Text>
            </View>
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Point the camera at the visitor ticket; exit is recorded when the code is read successfully.
            </Text>
          </>
        ) : null}

        {scanState.type === 'processing' ? (
          <View style={styles.stateRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.panelText, { color: colors.text }]}>Processing exit...</Text>
          </View>
        ) : null}

        {scanState.type === 'error' ? (
          <View style={styles.resultBlock}>
            <Text style={[styles.errorTitle, { color: '#DC3545' }]}>Scan failed</Text>
            <Text style={[styles.resultText, { color: colors.text }]}>{scanState.message}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={resetScanner}
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
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
});
