import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { enrolleeService } from '@/services/enrollee';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function VisitorInfoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);

  // Get data from route params (passed from office portal after QR scan)
  const visitorName = (params.visitorName as string) || 'John Anderson';
  const visitorId = (params.visitorId as string) || 'ID12345';
  const address = (params.address as string) || '';
  const contactNo = (params.contactNo as string) || '';
  const passNumber = (params.passNumber as string) || '';
  const visitId = (params.visitId as string) || '';
  const visitStatus = (params.visitStatus as string) || 'pending';
  const enrolleeStatus = (params.enrolleeStatus as string) || 'pending';

  const handleMarkAsCompleted = async () => {
    if (!visitId) {
      Alert.alert('Error', 'Visit ID not found. Cannot mark as completed.');
      return;
    }

    try {
      setIsUpdating(true);
      console.log('✁ Marking visit as completed...');
      
      const success = await enrolleeService.updateVisitStatus(
        parseInt(visitId),
        'completed'
      );

      setIsUpdating(false);

      if (success) {
        Alert.alert(
          'Visit Completed',
          `${visitorName} visit has been marked as completed.`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert(
          'Update Failed',
          'Could not update visit status. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error updating visit status:', error);
      setIsUpdating(false);
      Alert.alert('Error', 'An error occurred while updating the visit status.');
    }
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
          <Text style={styles.visitorName}>{visitorName}</Text>
          <Text style={styles.visitorId}>{visitorId}</Text>
        </View>

        {/* Details Section */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
          {/* Contact Number */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="phone" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Contact Number
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {contactNo || '(not provided)'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Address */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="location-on" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Address
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {address || '(not provided)'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Pass Number */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons name="badge" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Pass Number
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {passNumber || '(none)'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Visit Status */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons 
                name={visitStatus === 'completed' ? 'check-circle' : 'schedule'} 
                size={20} 
                color={visitStatus === 'completed' ? '#28A745' : '#FF9800'} 
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Visit Status
              </Text>
              <Text style={[
                styles.detailValue, 
                { color: visitStatus === 'completed' ? '#28A745' : '#FF9800' }
              ]}>
                {visitStatus === 'completed' ? '✓ Completed' : 'Pending'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Enrollee Status */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialIcons 
                name={enrolleeStatus === 'completed' ? 'check-circle' : 'schedule'} 
                size={20} 
                color={enrolleeStatus === 'completed' ? '#28A745' : '#FF9800'} 
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Enrollment Status
              </Text>
              <Text style={[
                styles.detailValue, 
                { color: enrolleeStatus === 'completed' ? '#28A745' : '#FF9800' }
              ]}>
                {enrolleeStatus === 'completed' ? '✓ Completed' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          {visitStatus !== 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#28A745' }]}
              onPress={handleMarkAsCompleted}
              disabled={isUpdating}
              activeOpacity={0.8}
            >
              <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>
                {isUpdating ? 'Updating...' : 'Mark as Completed'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
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
  buttonGroup: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
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
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
