import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [guardName] = useState('Officer Martinez');
  const [guardId] = useState('GRD001');
  const [activeVisitors] = useState(4);
  const [activeAlerts] = useState(1);
  const [currentTime, setCurrentTime] = useState('');

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setCurrentTime(time);
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const visitors = [
    {
      id: 1,
      name: 'Robert Kim',
      department: 'Finance Department',
      time: '09:23 AM',
      status: 'Arrived',
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      department: 'HR Department',
      time: '10:15 AM',
      status: 'Arrived',
    },
    {
      id: 3,
      name: 'Michael Chen',
      department: 'IT Department',
      time: '10:45 AM',
      status: 'Arrived',
    },
  ];

  const handleLogout = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={styles.headerTitle}>Guard Portal</Text>
          <Text style={styles.headerSubtitle}>{guardName}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.logoutButtonContainer, { backgroundColor: '#FFFFFF' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={styles.exitIconBox}>
            <Text style={styles.exitArrow}>←</Text>
          </View>
          <Text style={[styles.logoutButtonText, { color: '#003D99' }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Overview */}
        <View style={styles.statsRow}>
          {/* Active Visitors */}
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
            <MaterialIcons name="people" size={28} color={colors.primary} style={{marginBottom: 8}} />
            <Text style={[styles.statNumber, { color: colors.primary }]}>{activeVisitors}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Active Visitors
            </Text>
          </View>

          {/* Current Time */}
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderLeftColor: colors.accent, borderLeftWidth: 4 }]}>
            <MaterialIcons name="schedule" size={28} color={colors.accent} style={{marginBottom: 8}} />
            <Text style={[styles.statNumber, { color: colors.accent }]}>{currentTime}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Current Time
            </Text>
          </View>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsContainer}>
          {/* Register New Visitor */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/guard/select-visitor-type')}
            activeOpacity={0.8}
          >
            <View style={styles.actionLeft}>
              <MaterialIcons name="person-add" size={40} color="#FFFFFF" />
              <View>
                <Text style={styles.actionTitle}>Register Visitor</Text>
                <Text style={styles.actionSubtitle}>New entry</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          {/* Exit Scan */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            onPress={() => router.push('/guard/exit-scan')}
            activeOpacity={0.8}
          >
            <View style={styles.actionLeft}>
              <MaterialIcons name="exit-to-app" size={40} color={colors.text} />
              <View>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Exit Scan</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Process exit</Text>
              </View>
            </View>
            <Text style={[styles.actionArrow, { color: colors.text }]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Active Alerts Card */}
        <TouchableOpacity
          style={[styles.alertsCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/guard/alerts')}
          activeOpacity={0.8}
        >
          <View style={styles.alertsLeft}>
            <View style={styles.alertsBadge}>
              <MaterialIcons name="notifications" size={24} color="#003D99" />
            </View>
            <View>
              <Text style={styles.alertsTitle}>Active Alerts</Text>
              <Text style={styles.alertsSubtitle}>{activeAlerts} ready to exit</Text>
            </View>
          </View>
          <Text style={styles.alertsArrow}>→</Text>
        </TouchableOpacity>

        {/* Active Visitors Section */}
        <View style={styles.visitorsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Currently Inside
          </Text>

          {visitors.map((visitor) => (
            <View
              key={visitor.id}
              style={[styles.visitorCard, { backgroundColor: colors.surface, borderLeftColor: colors.primary, borderLeftWidth: 3 }]}
            >
              <View style={styles.visitorLeft}>
                <Text style={styles.visitorIcon}>👤</Text>
                <View>
                  <Text style={[styles.visitorName, { color: colors.text }]}>
                    {visitor.name}
                  </Text>
                  <Text style={[styles.visitorInfo, { color: colors.textSecondary }]}>
                    {visitor.department} 
                  </Text>
                  <Text style={[styles.visitorTime, { color: colors.textSecondary }]}>
                    {visitor.time}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.statusText, { color: colors.text }]}>{visitor.status}</Text> 
              </View>
            </View>
          ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    marginTop: 4,
  },
  logoutButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#003D99',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  exitIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#003D99',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitArrow: {
    fontSize: 13,
    fontWeight: '900',
    color: '#003D99',
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
        elevation: 1,
      },
    }),
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsContainer: {
    marginBottom: 28,
    gap: 14,
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  actionIcon: {
    fontSize: 40,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    marginTop: 4,
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 12,
  },
  visitorsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  visitorCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  visitorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  visitorIcon: {
    fontSize: 28,
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  visitorInfo: {
    fontSize: 12,
    fontWeight: '500',
  },
  visitorTime: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alertsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  alertsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  alertsBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  alertsIcon: {
    fontSize: 24,
    fontWeight: '700',
  },
  alertsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  alertsSubtitle: {
    fontSize: 12,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  alertsArrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 12,
  },
});
