/**
 * Office check-in scan: validates visitor QR against the next expected office on the route.
 * Authorized = correct office for current step; Unauthorized = wrong office (alert recorded).
 */

import { useThemeColor } from '@/hooks/use-theme-color';
import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database';
import { processOfficeCheckInScan, type OfficeCheckInScanResult } from '@/services/office-checkin-scan';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Phase = 'loading_office' | 'need_permission' | 'ready' | 'processing' | 'result' | 'error';

export default function OfficeScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const colors = {
    primary: useThemeColor({}, 'primary'),
    surface: useThemeColor({}, 'surface'),
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    border: useThemeColor({}, 'border'),
    background: useThemeColor({}, 'background'),
  };

  const successColor = '#198754';
  const errorColor = '#DC3545';

  const [phase, setPhase] = useState<Phase>('loading_office');
  const [officeData, setOfficeData] = useState<{ office_id: number; office_name: string } | null>(null);
  const [scanResult, setScanResult] = useState<OfficeCheckInScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRaw, setManualRaw] = useState('');
  const isProcessingRef = useRef(false);

  const loadOfficeData = useCallback(async () => {
    try {
      const userId = authSessionService.getCurrentUserId();
      if (!userId) {
        setErrorMessage('Not signed in. Please log in again.');
        setPhase('error');
        return;
      }

      const { data, error } = await supabase
        .from('office_staff')
        .select('office_id, office:office_id(office_id, office_name)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data?.office_id) {
        setErrorMessage('Your account is not linked to an office.');
        setPhase('error');
        return;
      }

      const embedded = data.office;
      const officeRow = Array.isArray(embedded) ? embedded[0] : embedded;
      const office = officeRow as { office_id?: number; office_name?: string } | null;
      setOfficeData({
        office_id: Number(data.office_id),
        office_name: office?.office_name || 'Your office',
      });
      setPhase('ready');
    } catch (e) {
      console.error('[OfficeScan] loadOfficeData', e);
      setErrorMessage('Failed to load office information.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    loadOfficeData();
  }, [loadOfficeData]);

  const runScan = async (rawQrValue: string) => {
    if (!rawQrValue?.trim() || isProcessingRef.current || !officeData) {
      return;
    }

    const userId = authSessionService.getCurrentUserId();
    if (!userId) {
      setErrorMessage('Session expired. Please log in again.');
      setPhase('error');
      return;
    }

    isProcessingRef.current = true;
    setPhase('processing');
    setScanResult(null);
    setErrorMessage('');

    try {
      const result = await processOfficeCheckInScan({
        rawQrValue: rawQrValue.trim(),
        scanningOfficeId: officeData.office_id,
        scannedByUserId: userId,
      });

      setScanResult(result);
      setPhase('result');
    } catch (e) {
      console.error('[OfficeScan] runScan', e);
      setErrorMessage('Something went wrong. Please try again.');
      setPhase('error');
    } finally {
      isProcessingRef.current = false;
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setErrorMessage('');
    setManualRaw('');
    setShowManualEntry(false);
    if (officeData) {
      setPhase('ready');
    }
  };

  const onBarcodeScanned = (data: string) => {
    if (phase !== 'ready' || isProcessingRef.current) {
      return;
    }
    void runScan(data);
  };

  const handleManualSubmit = () => {
    if (!manualRaw.trim()) {
      return;
    }
    void runScan(manualRaw);
  };

  if (phase === 'loading_office' || phase === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Office check-in</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.centered}>
          {phase === 'loading_office' ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <MaterialIcons name="error-outline" size={56} color={errorColor} />
              <Text style={[styles.centerTitle, { color: colors.text }]}>Cannot scan</Text>
              <Text style={[styles.centerSub, { color: colors.textSecondary }]}>{errorMessage}</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={loadOfficeData}>
                <Text style={styles.primaryBtnText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'result' && scanResult) {
    const failed = !scanResult.success;
    const ok = scanResult.success && scanResult.authorized;
    const iconName = failed ? 'error-outline' : ok ? 'verified-user' : 'gpp-bad';
    const accent = failed || !ok ? errorColor : successColor;
    const headline = failed ? scanResult.title : ok ? 'Authorized' : 'Unauthorized';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan result</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollPad}>
          <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name={iconName} size={72} color={accent} />
            <Text style={[styles.resultTitle, { color: accent }]}>{headline}</Text>
            <Text style={[styles.resultMessage, { color: colors.text }]}>{scanResult.message}</Text>
            {scanResult.visitorName ? (
              <Text style={[styles.visitorLine, { color: colors.text }]}>{scanResult.visitorName}</Text>
            ) : null}
            {scanResult.expectedOfficeName ? (
              <Text style={[styles.detailLine, { color: colors.textSecondary }]}>
                Expected office: {scanResult.expectedOfficeName}
              </Text>
            ) : null}
            {scanResult.scanningOfficeName ? (
              <Text style={[styles.detailLine, { color: colors.textSecondary }]}>
                This desk: {scanResult.scanningOfficeName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={resetScan}>
            <Text style={styles.primaryBtnText}>Scan another</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Office check-in</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.centered}>
          <MaterialIcons name="camera-alt" size={56} color={colors.primary} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>Camera required</Text>
          <Text style={[styles.centerSub, { color: colors.textSecondary }]}>
            Allow camera access to scan visitor QR tickets.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Office check-in</Text>
        <View style={styles.headerBtn} />
      </View>

      {officeData ? (
        <View style={[styles.officeStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="business" size={20} color={colors.primary} />
          <Text style={[styles.officeStripText, { color: colors.text }]}>{officeData.office_name}</Text>
        </View>
      ) : null}

      <View style={styles.cameraWrap}>
        <View style={[styles.cameraBox, { borderColor: colors.border }]}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={phase === 'ready' ? (e) => onBarcodeScanned(e.data) : undefined}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, { borderColor: '#FFFFFF' }]} />
          </View>
        </View>
        {phase === 'processing' ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.text, marginLeft: 10 }}>Validating…</Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Point the camera at the visitor ticket QR. The next expected office on their route must match this
            office.
          </Text>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!showManualEntry ? (
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={() => setShowManualEntry(true)}>
            <MaterialIcons name="keyboard" size={20} color={colors.primary} />
            <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Enter QR payload manually</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Raw QR contents</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="Paste JSON or token"
              placeholderTextColor={colors.textSecondary}
              value={manualRaw}
              onChangeText={setManualRaw}
              multiline
              editable={phase === 'ready'}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: phase === 'ready' ? 1 : 0.5 }]}
              onPress={handleManualSubmit}
              disabled={phase !== 'ready'}
            >
              <Text style={styles.primaryBtnText}>Validate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowManualEntry(false)}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  officeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  officeStripText: { fontSize: 15, fontWeight: '600', flex: 1 },
  cameraWrap: { flex: 1, padding: 16 },
  cameraBox: {
    flex: 1,
    minHeight: 260,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  camera: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  frame: { width: 220, height: 220, borderWidth: 3, borderRadius: 16 },
  hint: { marginTop: 12, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  panel: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  centerSub: { fontSize: 14, textAlign: 'center' },
  scrollPad: { padding: 16, paddingBottom: 32 },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  resultTitle: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  resultMessage: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  visitorLine: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  detailLine: { fontSize: 13, textAlign: 'center' },
});
