import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSessionService } from '@/services/auth-session';
import { officeExitApiService } from '@/services/office-exit-api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ExitScanState =
  | { type: 'idle' }
  | { type: 'processing'; token: string }
  | { type: 'error'; token?: string; message: string };

export default function OfficeExitScanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ExitScanState>({ type: 'idle' });
  const isProcessingRef = useRef(false);

  const extractQrToken = (rawValue: string): string => {
    const trimmed = rawValue.trim();

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

  const onQRCodeScanned = async (rawValue: string) => {
    if (!rawValue || isProcessingRef.current) {
      return;
    }

    const userId = authSessionService.getCurrentUserId();
    if (!userId) {
      setScanState({
        type: 'error',
        message: 'Session not found. Please log in again.',
      });
      return;
    }

    const qrToken = extractQrToken(rawValue);

    isProcessingRef.current = true;
    console.log('📷 Raw QR scan value:', rawValue);
    console.log('📷 Parsed QR lookup value:', qrToken);
    setScanState({ type: 'processing', token: qrToken });

    try {
      const result = await officeExitApiService.processExitScan({
        qrToken,
        rawQrValue: rawValue,
        scannedByUserId: userId,
      });

      if (!result.success || !result.data) {
        if (result.debug) {
          console.warn('⚠️ Exit scan request returned an application failure', {
            functionName: result.debug.functionName,
            method: result.debug.method,
            status: result.debug.status,
            requestBody: result.debug.requestBody,
            rawError: result.debug.rawError,
            message: result.message,
            errorCode: result.errorCode,
          });
        }

        const detail = result.debug?.functionName
          ? `Function: ${result.debug.functionName}`
          : '';

        setScanState({
          type: 'error',
          token: qrToken,
          message: `${result.message || 'QR is invalid, expired, already exited, or not found.'}${detail ? ` (${detail})` : ''}`,
        });
        return;
      }

      router.push({
        pathname: '/office/visitor-info',
        params: {
          visitId: String(result.data.visitId),
          visitorId: String(result.data.visitorId),
          visitorName: result.data.visitorName,
          passNumber: result.data.passNumber || '',
          controlNumber: result.data.controlNumber || '',
          destinationOffice: result.data.destinationOffice || '',
          expectedOffice: result.data.expectedOffice || '',
          purposeReason: result.data.purposeReason || '',
          entryTime: result.data.entryTime || '',
          registeredBy: result.data.registeredBy || '',
          isCorrectDestination: result.data.isCorrectDestination ? 'true' : 'false',
          destinationStatusLabel: result.data.destinationStatusLabel,
        },
      });

      setScanState({ type: 'idle' });
    } catch (error) {
      console.error('❌ Unexpected exit scan handler failure', error);
      setScanState({
        type: 'error',
        token: qrToken,
        message: 'Unable to process the scan right now. Please try again.',
      });
    } finally {
      isProcessingRef.current = false;
    }
  };

  const resetScanner = () => {
    setScanState({ type: 'idle' });
  };

  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.centeredContent}>
          <MaterialIcons name="camera-alt" size={56} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access required</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>Office Exit Scan needs camera access to read visitor QR codes.</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Office Exit Scan</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanState.type === 'idle' ? (event) => onQRCodeScanned(event.data) : undefined}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.scanFrame, { borderColor: '#FFFFFF' }]} />
        </View>
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: colors.surface }]}> 
        {scanState.type === 'idle' ? (
          <Text style={[styles.panelText, { color: colors.textSecondary }]}>Point the camera at the visitor QR code to process exit.</Text>
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
          </View>
        ) : null}

        {scanState.type !== 'idle' ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={resetScanner}
          >
            <Text style={styles.primaryButtonText}>Scan Another QR</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => {
            if (scanState.type === 'processing') {
              Alert.alert('Please wait', 'Exit processing is in progress.');
              return;
            }
            router.back();
          }}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back to Office Portal</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  headerButton: {
    width: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderRadius: 18,
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    margin: 12,
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
  panelText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  resultBlock: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
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
    marginBottom: 4,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 16,
  },
});
