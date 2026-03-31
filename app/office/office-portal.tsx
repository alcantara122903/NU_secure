import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { enrolleeService } from '@/services/enrollee';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OfficePortalScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [isScanning, setIsScanning] = useState(false);
  const [scannedVisitData, setScannedVisitData] = useState<any | null>(null);

  const officeData = {
    officeName: 'Office Portal',
    department: 'Human Resources',
    employeeName: 'Sarah Johnson',
    position: 'HR Manager',
    todayVisitors: 3,
    pendingScans: 0,
    expectedVisitors: 5,
  };

  const quickTips = [
    'Ask visitor to show their QR ticket',
    'Ensure QR code is clearly visible',
    'Hold device steady during scan',
    'Audio feedback sounds once verified',
  ];

  const handleScanQR = async () => {
    try {
      // In a real implementation, this would use expo-barcode-scanner
      // For now, we accept a QR token parameter for testing
      const qrToken = undefined; // In production, this would come from barcode scanner
      
      if (!qrToken) {
        // TODO: Integrate real barcode scanner
        Alert.alert(
          'QR Scanner',
          'In production, this would use the device camera to scan QR codes.'
        );
        return;
      }

      setIsScanning(true);
      console.log('📱 Scanning QR code:', qrToken);

      // Fetch visit data by QR token
      const visitData = await enrolleeService.getVisitByQRToken(qrToken);

      if (!visitData) {
        setIsScanning(false);
        Alert.alert(
          'QR Code Not Found',
          'This QR code is not registered in the system. Please ask the visitor to verify their QR code.',
          [{ text: 'Try Again' }]
        );
        return;
      }

      console.log('✅ Visit found:', visitData);
      setScannedVisitData(visitData);
      setIsScanning(false);

      // Navigate to visitor info with the scanned data
      router.push({
        pathname: '/office/visitor-info',
        params: {
          visitId: String(visitData.visitId),
          qrToken: visitData.qrToken,
          visitorName: `${visitData.visitor?.first_name || ''} ${visitData.visitor?.last_name || ''}`,
          visitorId: String(visitData.visitor?.visitor_id),
          address: visitData.visitor?.address,
          contactNo: visitData.visitor?.contact_no,
          passNumber: visitData.visitor?.pass_number,
          enrolleeId: String(visitData.enrolleeId || ''),
          visitStatus: visitData.visitStatus,
          enrolleeStatus: visitData.enrollee?.enrollee_status,
        },
      });
    } catch (error) {
      console.error('❌ Error scanning QR code:', error);
      setIsScanning(false);
      Alert.alert(
        'Scan Error',
        'Failed to scan QR code. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="business" size={24} color="#FFD700" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{officeData.officeName}</Text>
              <Text style={styles.headerSubtitle}>{officeData.department}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Employee Info Card */}
        <View style={[styles.employeeCard, { backgroundColor: colors.surface }]}>
          <View style={styles.employeeAvatar}>
            <MaterialIcons name="person-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.employeeDetails}>
            <Text style={[styles.employeeName, { color: colors.text }]}>
              {officeData.employeeName}
            </Text>
            <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>
              {officeData.position}
            </Text>
          </View>
        </View>

        {/* QR Scanner Card */}
        <View style={[styles.scannerCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.qrFrame, { borderColor: colors.primary }]}>
            <MaterialIcons name="qr-code-2" size={64} color={colors.primary} />
            <Text style={[styles.readyText, { color: colors.textSecondary }]}>
              Ready to Scan
            </Text>
            <Text style={[styles.scanHintText, { color: colors.textSecondary }]}>
              Position QR code in frame
            </Text>
          </View>
        </View>

        {/* Scan Button */}
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.primary }]}
          onPress={handleScanQR}
          activeOpacity={0.8}
          disabled={isScanning}
        >
          <MaterialIcons name="qr-code-2" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Scanning...' : ' to Scan QR TapCode'}
          </Text>
        </TouchableOpacity>

        {/* Quick Tips Card */}
        <View style={[styles.tipsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.tipsHeader}>
            <MaterialIcons name="lightbulb-outline" size={18} color={colors.primary} />
            <Text style={[styles.tipsTitle, { color: colors.text }]}>Quick Tips</Text>
          </View>
          <View style={styles.tipsList}>
            {quickTips.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <View style={[styles.tipDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.tipText, { color: colors.text }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Today's Visitors Card */}
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statIcon}>
              <MaterialIcons name="groups" size={24} color="#28A745" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Today's Visitors
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {officeData.todayVisitors}
            </Text>
          </View>

          {/* Pending Scans Card */}
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statIcon}>
              <MaterialIcons name="pending-actions" size={24} color="#FFA500" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Pending Scans
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {officeData.pendingScans}
            </Text>
          </View>
        </View>

        {/* Expected Visitors Card */}
        <View style={[styles.expectedCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.expectedTitle, { color: colors.text }]}>
            Expected Visitors
          </Text>
          <View style={styles.expectedContent}>
            <Text style={[styles.expectedNumber, { color: colors.primary }]}>
              {officeData.expectedVisitors}
            </Text>
            <Text style={[styles.expectedDescription, { color: colors.textSecondary }]}>
              scheduled for today
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  employeeRole: {
    fontSize: 13,
    fontWeight: '500',
  },
  scannerCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
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
  qrFrame: {
    width: 160,
    height: 160,
    borderWidth: 3,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  readyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  scanHintText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },
  scanButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
  statIcon: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  expectedCard: {
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
        elevation: 2,
      },
    }),
  },
  expectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  expectedContent: {
    alignItems: 'center',
  },
  expectedNumber: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  expectedDescription: {
    fontSize: 13,
    fontWeight: '500',
  },
});
