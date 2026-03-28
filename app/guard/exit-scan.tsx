import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExitScanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [isScanning, setIsScanning] = useState(false);
  const [scannedInfo, setScannedInfo] = useState<{
    name?: string;
    department?: string;
    exitTime?: string;
  } | null>(null);

  const handleBack = () => {
    if (scannedInfo) {
      setScannedInfo(null);
    } else {
      router.back();
    }
  };

  const handleScanQR = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScannedInfo({
        name: 'Robert Kim',
        department: 'Finance Department',
        exitTime: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      });
      setIsScanning(false);
    }, 2000);
  };

  const handleCompleteExit = () => {
    alert('Visitor exit processed successfully!');
    setScannedInfo(null);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Process visitor exit</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!scannedInfo ? (
          <>
            {/* QR Scanner Card */}
            <View style={[styles.scannerCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.qrFrame, { borderColor: colors.primary }]}>
                <MaterialIcons name="qr-code-2" size={56} color={colors.primary} />
              </View>
              <Text style={[styles.scannerTitle, { color: colors.text }]}>
                Position QR Code in frame
              </Text>
              <Text style={[styles.scannerSubtitle, { color: colors.textSecondary }]}>
                Hold steady for scanning
              </Text>
            </View>

            {/* Scan Button */}
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.primary }]}
              onPress={handleScanQR}
              activeOpacity={0.8}
              disabled={isScanning}
            >
              <MaterialIcons name="qr-code-2" size={28} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan Exit QR'}
              </Text>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={[styles.instructionsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.instructionsTitle, { color: colors.primary }]}>
                How to scan:
              </Text>
              <View style={styles.instructionsList}>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Hold phone steady and level
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Position QR code within the frame
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                  <Text style={[styles.instructionText, { color: colors.text }]}>
                    Wait for automatic detection
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Success Card */}
            <View style={[styles.successCard, { backgroundColor: colors.surface }]}>
              <MaterialIcons name="check-circle" size={48} color="#28A745" />
              <Text style={[styles.successTitle, { color: colors.text }]}>
                QR Code Scanned
              </Text>
              <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                Visitor details confirmed
              </Text>
            </View>

            {/* Visitor Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Visitor Name
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {scannedInfo.name}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Department
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {scannedInfo.department}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Exit Time
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {scannedInfo.exitTime}
                </Text>
              </View>
            </View>

            {/* Complete Button */}
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: colors.primary }]}
              onPress={handleCompleteExit}
              activeOpacity={0.8}
            >
              <MaterialIcons name="check-circle" size={28} color="#28A745" />
              <Text style={styles.completeButtonText}>Process Exit</Text>
            </TouchableOpacity>
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
  scannerCard: {
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
  qrFrame: {
    width: 140,
    height: 140,
    borderWidth: 3,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrIcon: {
    fontSize: 56,
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  scannerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  scanButton: {
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
  scanButtonIcon: {
    fontSize: 20,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
  successIcon: {
    fontSize: 52,
    color: '#28A745',
    marginBottom: 12,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
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
  completeButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
