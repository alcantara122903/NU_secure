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

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [wrongOfficeAlerts] = useState(0);
  const [readyToExit] = useState(1);

  const completedVisitors = [
    {
      id: 1,
      name: 'Robert Kim',
      department: 'Finance',
      departmentCode: 'D123456',
      completedTime: '5:00 PM',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitor visitor activities and alerts</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Alert Stats */}
        <View style={styles.statsContainer}>
          {/* Wrong Office Alerts */}
          <View style={[styles.alertStatCard, { backgroundColor: colors.surface }]}>
            <View style={styles.alertStatHeader}>
              <MaterialIcons name="error" size={24} color="#D32F2F" />
              <Text style={[styles.alertLabel, { color: colors.text }]}>Wrong Office</Text>
            </View>
            <Text style={[styles.alertCount, { color: '#D32F2F' }]}>{wrongOfficeAlerts}</Text>
            <Text style={[styles.alertSubtext, { color: colors.textSecondary }]}>Active alerts</Text>
          </View>

          {/* Completed Alerts */}
          <View style={[styles.alertStatCard, { backgroundColor: colors.surface }]}>
            <View style={styles.alertStatHeader}>
              <MaterialIcons name="check-circle" size={24} color="#28A745" />
              <Text style={[styles.alertLabel, { color: colors.text }]}>Completed</Text>
            </View>
            <Text style={[styles.alertCount, { color: '#28A745' }]}>{readyToExit}</Text>
            <Text style={[styles.alertSubtext, { color: colors.textSecondary }]}>Ready to exit</Text>
          </View>
        </View>

        {/* Completed Visitors Section */}
        <View style={styles.visitorsSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="check-circle" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed Visitors</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Visitors who have completed their business and are ready to exit
          </Text>

          {completedVisitors.map((visitor) => (
            <View
              key={visitor.id}
              style={[styles.visitorCard, { backgroundColor: colors.surface, borderLeftColor: '#28A745', borderLeftWidth: 4 }]}
            >
              <View style={styles.visitorContent}>
                <View style={styles.visitorIcon}>
                  <MaterialIcons name="person" size={28} color={colors.primary} />
                </View>
                <View style={styles.visitorInfo}>
                  <Text style={[styles.visitorName, { color: colors.text }]}>{visitor.name}</Text>
                  <Text style={[styles.visitorDetail, { color: colors.textSecondary }]}>
                    {visitor.department} • {visitor.departmentCode}
                  </Text>
                  <Text style={[styles.visitorTime, { color: colors.textSecondary }]}>
                    Completed at {visitor.completedTime}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.readyToExitButton, { backgroundColor: '#28A745' }]}
                activeOpacity={0.8}
                onPress={() => {}}
              >
                <Text style={styles.readyToExitText}>Ready to Exit</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  alertStatCard: {
    flex: 1,
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
  alertStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  alertLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  alertCount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  visitorsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 16,
    lineHeight: 18,
  },
  visitorCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  visitorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  visitorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorInitial: {
    fontSize: 24,
    fontWeight: '700',
  },
  visitorInfo: {
    flex: 1,
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  visitorDetail: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  visitorTime: {
    fontSize: 11,
    fontWeight: '400',
  },
  readyToExitButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  readyToExitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
