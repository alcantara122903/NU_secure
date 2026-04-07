/**
 * Office Scan Screen
 * Allows office staff to scan a visitor's QR ticket and validate the visit
 * Route: app/guard/office-scan.tsx
 */

import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScanResult {
  status: 'scanning' | 'success' | 'error' | 'wrong-office';
  visitorName?: string;
  passNumber?: string;
  controlNumber?: string;
  message: string;
  expectedOffice?: string;
  actualOffice?: string;
}

export default function OfficeScanScreen() {
  const router = useRouter();
  const colors = {
    primary: useThemeColor({}, 'primary'),
    surface: useThemeColor({}, 'surface'),
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    border: useThemeColor({}, 'border'),
    background: useThemeColor({}, 'background'),
  };

  const [scanResult, setScanResult] = useState<ScanResult>({ status: 'scanning', message: 'Ready to scan QR code' });
  const [manualToken, setManualToken] = useState('');
  const [currentOffice, setCurrentOffice] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Handle QR code scan (simulated - in real app would use camera scanner)
  const handleManualScan = async () => {
    if (!manualToken.trim()) {
      Alert.alert('Error', 'Please enter a QR token');
      return;
    }

    if (!currentOffice) {
      Alert.alert('Error', 'Please select your office');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Simulate API call to validate the scan
      // In production, this would call normalVisitorService.validateOfficeVisit()
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate random office validation (50% chance correct office)
      const isCorrectOffice = Math.random() > 0.5;

      if (isCorrectOffice) {
        setScanResult({
          status: 'success',
          visitorName: 'Sample Visitor Name', // Would come from API
          passNumber: 'PASS-ABC12345',
          controlNumber: 'CTRL-XYZ98765',
          message: `✅ Visitor verified for ${currentOffice}`,
          expectedOffice: currentOffice,
        });
      } else {
        setScanResult({
          status: 'wrong-office',
          message: `❌ Wrong Office!\nVisitor expected at: Faculty Office`,
          expectedOffice: 'Faculty Office',
          actualOffice: currentOffice,
        });
      }
      
      setManualToken('');
    } catch (error) {
      setScanResult({
        status: 'error',
        message: 'Failed to verify visitor. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScanResult({ status: 'scanning', message: 'Ready to scan QR code' });
    setManualToken('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visitor Verification</Text>
          <View style={styles.spacer} />
        </View>

        {/* Office Selection */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Office</Text>
          <View style={[styles.officePicker, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.officeScrollView}>
              {offices.map((office, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.officeButton,
                    currentOffice === office && {
                      backgroundColor: colors.primary,
                    },
                    currentOffice !== office && {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setCurrentOffice(office)}
                >
                  <Text
                    style={[
                      styles.officeButtonText,
                      {
                        color: currentOffice === office ? '#FFFFFF' : colors.text,
                      },
                    ]}
                  >
                    {office}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Token Entry */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>QR Token</Text>
          <Text style={[styles.tokenLabel, { color: colors.textSecondary }]}>
            Paste the QR token from the visitor's ticket
          </Text>
          
          <TextInput
            style={[
              styles.tokenInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.text,
              },
            ]}
            placeholder="e.g., 7GHIJK-LMNOP"
            placeholderTextColor={colors.textSecondary}
            value={manualToken}
            onChangeText={setManualToken}
            editable={!isProcessing}
          />

          <TouchableOpacity
            style={[
              styles.scanButton,
              {
                backgroundColor: colors.primary,
                opacity: isProcessing || !manualToken || !currentOffice ? 0.6 : 1,
              },
            ]}
            onPress={handleManualScan}
            disabled={isProcessing || !manualToken || !currentOffice}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>Verify Visitor</Text>
          </TouchableOpacity>
        </View>

        {/* Result Display */}
        {scanResult.status !== 'scanning' && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor:
                  scanResult.status === 'success'
                    ? '#E8F5E9'
                    : scanResult.status === 'wrong-office'
                    ? '#FFEBEE'
                    : '#FFF3E0',
                borderColor:
                  scanResult.status === 'success'
                    ? '#4CAF50'
                    : scanResult.status === 'wrong-office'
                    ? '#F44336'
                    : '#FF9800',
              },
            ]}
          >
            <MaterialIcons
              name={
                scanResult.status === 'success'
                  ? 'check-circle'
                  : 'error'
              }
              size={40}
              color={
                scanResult.status === 'success'
                  ? '#4CAF50'
                  : '#F44336'
              }
            />

            <Text
              style={[
                styles.resultMessage,
                {
                  color:
                    scanResult.status === 'success'
                      ? '#2E7D32'
                      : '#C62828',
                },
              ]}
            >
              {scanResult.message}
            </Text>

            {scanResult.status === 'success' && scanResult.visitorName && (
              <>
                <View style={[styles.resultDetail, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Visitor Name</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scanResult.visitorName}
                  </Text>
                </View>
                <View style={[styles.resultDetail, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Pass Number</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scanResult.passNumber}
                  </Text>
                </View>
                <View style={[styles.resultDetail, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Control Number</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scanResult.controlNumber}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spacer: {
    width: 40,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  officePicker: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  officeScrollView: {
    flexGrow: 0,
  },
  officeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  officeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tokenLabel: {
    fontSize: 12,
    marginBottom: 12,
  },
  tokenInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultMessage: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  resultDetail: {
    width: '100%',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
