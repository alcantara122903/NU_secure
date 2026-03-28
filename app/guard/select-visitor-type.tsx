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

export default function SelectVisitorTypeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const visitorTypes = [
    {
      id: 'enrollee',
      icon: 'school',
      title: 'Enrollee',
      description: 'New student or staff members enrolling in the institution',
    },
    {
      id: 'contractor',
      icon: 'build',
      title: 'Contractor',
      description: 'Service provider, maintenance workers, or external vendors',
    },
    {
      id: 'normal',
      icon: 'person',
      title: 'Normal Visitor',
      description: 'General visitor, guest or anyone with a scheduled appointment',
    },
  ];

  const handleSelectVisitorType = (type: string) => {
    router.push({
      pathname: '/guard/register-visitor',
      params: { visitorType: type },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Select Visitor Type</Text>
          <Text style={styles.headerSubtitle}>Choose the type of visitor to register</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visitor Type Cards */}
        <View style={styles.cardsContainer}>
          {visitorTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, { backgroundColor: colors.primary }]}
              onPress={() => handleSelectVisitorType(type.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.iconBadge, { backgroundColor: '#FFD700' }]}>
                <MaterialIcons name={type.icon as any} size={36} color="#003D99" />
              </View>
                <View style={styles.textContent}>
                  <Text style={styles.typeTitle}>{type.title}</Text>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                </View>
              </View>
              <Text style={styles.arrowIcon}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Registration Process Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info" size={20} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Registration Process</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            After selecting the visitor type, you will proceed to face recognition, ID scanning, and completing the visitor details form. A QR ticket will be generated upon completion.
          </Text>
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
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 28,
  },
  typeCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconText: {
    fontSize: 36,
    fontWeight: '700',
  },
  textContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 13,
    color: '#E0E0E0',
    fontWeight: '400',
    lineHeight: 16,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 16,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#A1CEDC',
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
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
});
