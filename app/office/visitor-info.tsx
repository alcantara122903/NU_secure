import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatDateTime = (value: string): string => {
  if (!value) {
    return '(not available)';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function VisitorInfoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();

  const visitorName = (params.visitorName as string) || '(visitor not found)';
  const visitorId = (params.visitorId as string) || '';
  const passNumber = (params.passNumber as string) || '';
  const destinationOffice = (params.destinationOffice as string) || '(not available)';
  const expectedOffice = (params.expectedOffice as string) || '';
  const purposeReason = (params.purposeReason as string) || '(not provided)';
  const entryTime = formatDateTime((params.entryTime as string) || '');
  const controlNumber = (params.controlNumber as string) || '(not available)';
  const registeredBy = (params.registeredBy as string) || '(not available)';
  const destinationStatusLabel =
    (params.destinationStatusLabel as string) || 'Destination needs review';
  const isCorrectDestination = (params.isCorrectDestination as string) === 'true';

  const idLabel = passNumber || visitorId || '(no id)';
  const sectionSurface = colorScheme === 'dark' ? '#111A36' : '#F2F5F9';
  const panelSurface = colorScheme === 'dark' ? '#0F1732' : '#F7F9FC';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back to Scanner</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor Information</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.card, { backgroundColor: colors.primary }]}> 
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={48} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.visitorName}>{visitorName}</Text>
          <Text style={styles.visitorId}>{idLabel}</Text>

          <View style={[styles.detailPanel, { backgroundColor: panelSurface }]}> 
            <View style={[styles.detailBox, { backgroundColor: sectionSurface }]}> 
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Destination</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{destinationOffice}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isCorrectDestination ? '#D7F3E3' : '#FDE2E2',
                    borderColor: isCorrectDestination ? '#9EDDBD' : '#F7B4B4',
                  },
                ]}
              >
                <MaterialIcons
                  name={isCorrectDestination ? 'check-circle-outline' : 'error-outline'}
                  size={14}
                  color={isCorrectDestination ? '#1F8B4C' : '#B63838'}
                />
                <Text
                  style={{
                    color: isCorrectDestination ? '#1F8B4C' : '#B63838',
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {destinationStatusLabel}
                </Text>
              </View>
              {!isCorrectDestination && expectedOffice ? (
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  Expected: {expectedOffice}
                </Text>
              ) : null}
            </View>

            <View style={[styles.detailBox, { backgroundColor: sectionSurface }]}> 
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Purpose of Visit</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{purposeReason}</Text>
            </View>

            <View style={[styles.detailBox, { backgroundColor: sectionSurface }]}> 
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Time In</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{entryTime}</Text>
            </View>

            <View style={[styles.rowBox, { backgroundColor: sectionSurface }]}> 
              <View style={styles.rowItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Control Number</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{controlNumber}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Registered By</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{registeredBy}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/office/exit-scan')}
        >
          <Text style={styles.doneText}>Done</Text>
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
    paddingTop: 10,
    paddingBottom: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 22,
    gap: 16,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F6C625',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorName: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 34,
  },
  visitorId: {
    color: '#EDF2FF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  detailPanel: {
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  detailBox: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  statusBadge: {
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '600',
  },
  rowBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowItem: {
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  doneButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 15,
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
  doneText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
