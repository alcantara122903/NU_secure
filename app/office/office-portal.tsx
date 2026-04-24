import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

  const [loadingOfficeData, setLoadingOfficeData] = useState(true);
  const [officeDataError, setOfficeDataError] = useState<string | null>(null);
  const [officeData, setOfficeData] = useState({
    officeName: '',
    department: '',
    employeeName: '',
    position: '',
    todayVisitors: 0,
    pendingScans: 0,
    expectedVisitors: 0,
    officeId: null as number | null,
  });

  const quickTips = [
    'Ask visitor to show their QR ticket',
    'Ensure QR code is clearly visible',
    'Hold device steady during scan',
    'Audio feedback sounds once verified',
  ];

  const loadOfficeDashboardData = useCallback(async () => {
    try {
      setLoadingOfficeData(true);
      setOfficeDataError(null);

      const userId = authSessionService.getCurrentUserId();
      if (!userId) {
        setOfficeDataError('Session not found. Please log in again.');
        return;
      }

      const session = authSessionService.getSession();

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email, role_id, status')
        .eq('user_id', userId)
        .maybeSingle();

      if (userError) {
        console.error('❌ Failed to fetch users row:', userError);
        setOfficeDataError('Could not load account profile. Please try again.');
        return;
      }

      const { data: staffRow, error: staffError } = await supabase
        .from('office_staff')
        .select('staff_id, user_id, office_id, position')
        .eq('user_id', userId)
        .maybeSingle();

      if (staffError) {
        console.error('❌ Failed to fetch office staff mapping:', staffError);
        if (staffError.code === 'PGRST205') {
          setOfficeDataError('Office staff table is not available in Supabase schema cache.');
        } else {
          setOfficeDataError('Could not load office staff mapping. Please try again.');
        }
        return;
      }

      if (!staffRow) {
        setOfficeDataError('No office staff account is linked to this user.');
        return;
      }

      const { data: officeRow, error: officeError } = await supabase
        .from('office')
        .select('office_id, office_name, floor, is_active')
        .eq('office_id', staffRow.office_id)
        .maybeSingle();

      if (officeError) {
        console.error('❌ Failed to fetch office details:', officeError);
        setOfficeDataError('Could not load office details. Please try again.');
        return;
      }

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const [todayVisitorsRes, pendingScansRes, expectedVisitorsRes] = await Promise.all([
        supabase
          .from('visit')
          .select('visit_id', { count: 'exact', head: true })
          .eq('primary_office_id', staffRow.office_id)
          .gte('entry_time', startOfDay.toISOString())
          .lte('entry_time', endOfDay.toISOString()),
        supabase
          .from('office_expectation')
          .select('expectation_id', { count: 'exact', head: true })
          .eq('office_id', staffRow.office_id)
          .eq('expectation_status_id', 1),
        supabase
          .from('office_expectation')
          .select('expectation_id', { count: 'exact', head: true })
          .eq('office_id', staffRow.office_id),
      ]);

      if (todayVisitorsRes.error || pendingScansRes.error || expectedVisitorsRes.error) {
        console.error('❌ Failed to fetch office stats:', {
          todayVisitorsError: todayVisitorsRes.error,
          pendingScansError: pendingScansRes.error,
          expectedVisitorsError: expectedVisitorsRes.error,
        });
        setOfficeDataError('Could not load office statistics. Please try again.');
        return;
      }

      const employeeName = `${userRow?.first_name || session?.userProfile?.first_name || ''} ${userRow?.last_name || session?.userProfile?.last_name || ''}`.trim();

      setOfficeData({
        officeName: officeRow?.office_name || 'Office',
        department: officeRow?.office_name || 'Office',
        employeeName: employeeName || userRow?.email || session?.userProfile?.email || 'Office Staff',
        position: staffRow.position || 'Office Staff',
        todayVisitors: todayVisitorsRes.count || 0,
        pendingScans: pendingScansRes.count || 0,
        expectedVisitors: expectedVisitorsRes.count || 0,
        officeId: staffRow.office_id,
      });
    } catch (error) {
      console.error('❌ Error loading office dashboard data:', error);
      setOfficeDataError('An unexpected error occurred while loading office data.');
    } finally {
      setLoadingOfficeData(false);
    }
  }, []);

  useEffect(() => {
    loadOfficeDashboardData();
  }, [loadOfficeDashboardData]);

  const handleScanQR = () => {
    if (loadingOfficeData || officeDataError) {
      Alert.alert('Office data not ready', 'Please wait for office profile data before scanning.');
      return;
    }

    router.push('/office/exit-scan');
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
        {loadingOfficeData ? (
          <View style={[styles.stateCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.stateTitle, { color: colors.text }]}>Loading office data...</Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>Fetching your account profile and dashboard stats.</Text>
          </View>
        ) : null}

        {!loadingOfficeData && officeDataError ? (
          <View style={[styles.stateCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.stateTitle, { color: colors.text }]}>Unable to load office data</Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>{officeDataError}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={loadOfficeDashboardData}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loadingOfficeData && !officeDataError ? (
          <>
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
          disabled={loadingOfficeData || !!officeDataError}
        >
          <MaterialIcons name="qr-code-2" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>
            Open Exit QR Scanner
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
          </>
        ) : null}
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
  stateCard: {
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
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  stateSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
