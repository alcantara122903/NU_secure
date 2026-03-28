import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VisitorInfoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const visitorData = {
    name: 'John Anderson',
    id: 'ID12345',
    initials: 'JA',
    destination: 'Human Resources',
    destinationCorrect: true,
    purpose: 'Job Interview',
    timeIn: 'Jan 25, 2026 02:32 PM',
    controlNumber: 'SWS-250125-0001',
    registeredBy: 'Officer Martinez',
  };

  const handleDone = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back to Scanner</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visitor Information Title */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Visitor Information
        </Text>

        {/* Visitor Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Visitor Details */}
          <Text style={styles.visitorName}>{visitorData.name}</Text>
          <Text style={styles.visitorId}>{visitorData.id}</Text>
        </View>

        {/* Details Section */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
          {/* Destination */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="location-on" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Destination
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {visitorData.destination}
              </Text>
              {visitorData.destinationCorrect && (
                <View style={styles.correctBadge}>
                  <MaterialIcons name="check-circle" size={16} color="#28A745" />
                  <Text style={styles.correctText}>Correct destination</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Purpose of Visit */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="description" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Purpose of Visit
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {visitorData.purpose}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Time In */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="schedule" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Time In
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {visitorData.timeIn}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Additional Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoColumn}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Control Number
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {visitorData.controlNumber}
              </Text>
            </View>
            <View style={styles.infoColumn}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Registered by
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {visitorData.registeredBy}
              </Text>
            </View>
          </View>
        </View>

        {/* Done Button */}
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
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
  avatarContainer: {
    marginBottom: 16,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  visitorId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E0E0E0',
  },
  detailsCard: {
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  detailIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  correctText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#28A745',
  },
  divider: {
    height: 1,
    marginVertical: 0,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 16,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
