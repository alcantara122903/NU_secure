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
  const router = useRouter();
  const params = useLocalSearchParams();

  const visitorName = (params.visitorName as string) || '(visitor not found)';
  const visitorId = (params.visitorId as string) || '';
  const passNumber = (params.passNumber as string) || '';
  const destinationOffice = (params.destinationOffice as string) || '(not available)';
  const expectedOffice = (params.expectedOffice as string) || '';
  const purposeReason = (params.purposeReason as string) || '(not provided)';
  const purposeLabel = (params.purposeLabel as string) || 'Purpose of Visit';
  const scanTimeRaw = (params.scanTime as string) || (params.entryTime as string) || '';
  const entryTime = formatDateTime(scanTimeRaw);
  const controlNumber = (params.controlNumber as string) || '(not available)';
  const registeredBy = (params.registeredBy as string) || '(not available)';
  const destinationStatusLabel = (params.destinationStatusLabel as string) || 'Destination needs review';
  const enrolleeStatusLabel = (params.enrolleeStatusLabel as string) || '';
  const isCorrectDestination = (params.isCorrectDestination as string) === 'true';
  const idLabel = passNumber || visitorId || '(no id)';
  const destinationLabel = isCorrectDestination ? 'Destination' : 'Expected Office';
  const destinationValue = isCorrectDestination ? destinationOffice : expectedOffice || destinationOffice;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back to Scanner</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor Information</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={48} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.visitorName}>{visitorName}</Text>
          <Text style={styles.visitorId}>{idLabel}</Text>

          <View style={styles.detailPanel}>
            <View style={styles.detailBox}>
              <View style={styles.rowLabelWrap}>
                <View style={styles.iconBadge}>
                  <MaterialIcons
                    name={isCorrectDestination ? 'business' : 'location-on'}
                    size={18}
                    color={isCorrectDestination ? '#4052A5' : '#F26A21'}
                  />
                </View>
                <Text style={styles.detailLabel}>{destinationLabel}</Text>
              </View>
              <Text style={styles.detailValue}>{destinationValue || '(not available)'}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isCorrectDestination ? '#CCF0D8' : '#F5EDE2',
                    borderColor: isCorrectDestination ? '#A0DCB8' : '#F0C18F',
                  },
                ]}
              >
                <MaterialIcons
                  name={isCorrectDestination ? 'check-circle-outline' : 'warning-amber'}
                  size={14}
                  color={isCorrectDestination ? '#1F8B4C' : '#F26A21'}
                />
                <Text style={[styles.statusText, { color: isCorrectDestination ? '#1F8B4C' : '#F26A21' }]}>
                  {destinationStatusLabel}
                </Text>
              </View>
              {isCorrectDestination && !!enrolleeStatusLabel ? (
                <View style={[styles.statusBadge, { backgroundColor: '#E9F7EF', borderColor: '#BFE5CC', marginTop: 8 }]}>
                  <MaterialIcons name="verified" size={14} color="#1F8B4C" />
                  <Text style={[styles.statusText, { color: '#1F8B4C' }]}>{enrolleeStatusLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailBox}>
              <View style={styles.rowLabelWrap}>
                <View style={[styles.iconBadge, { backgroundColor: '#EFE6FF' }]}>
                  <MaterialIcons name="description" size={18} color="#7A3CF3" />
                </View>
                <Text style={styles.detailLabel}>{purposeLabel}</Text>
              </View>
              <Text style={styles.detailValue}>{purposeReason}</Text>
            </View>

            {isCorrectDestination ? (
              <View style={styles.detailBox}>
                <View style={styles.rowLabelWrap}>
                  <View style={[styles.iconBadge, { backgroundColor: '#D6F0FA' }]}>
                    <MaterialIcons name="access-time" size={18} color="#0A90BB" />
                  </View>
                  <Text style={styles.detailLabel}>Time In</Text>
                </View>
                <Text style={styles.detailValue}>{entryTime}</Text>
              </View>
            ) : null}

            <View style={styles.rowBox}>
              <View style={styles.rowItem}>
                <Text style={styles.detailLabel}>Control Number</Text>
                <Text style={styles.rowValue}>{controlNumber}</Text>
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.detailLabel}>Registered By</Text>
                <Text style={styles.rowValue}>{registeredBy}</Text>
              </View>
            </View>

            {!isCorrectDestination ? (
              <View style={styles.actionBox}>
                <Text style={styles.actionTitle}>What to do:</Text>
                <Text style={styles.actionLine}>• Ask visitor to wait for security</Text>
                <Text style={styles.actionLine}>• Do not allow entry without verification</Text>
                <Text style={styles.actionLine}>• Provide directions to correct office if needed</Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/office/office-scan')}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED',
  },
  header: {
    backgroundColor: '#3C469C',
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
    fontSize: 30,
    fontWeight: '500',
  },
  content: {
    padding: 24,
    paddingBottom: 28,
    gap: 16,
  },
  card: {
    backgroundColor: '#3C469C',
    borderRadius: 18,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
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
    marginBottom: 8,
  },
  avatarCircle: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: '#F6C625',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorName: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 31,
    fontWeight: '500',
    lineHeight: 36,
  },
  visitorId: {
    color: '#EDF2FF',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '500',
    marginTop: 3,
    marginBottom: 14,
  },
  detailPanel: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  detailBox: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F2F3F7',
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#DEE7FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
  },
  detailValue: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    color: '#222',
  },
  statusBadge: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F2F3F7',
  },
  rowItem: {
    flex: 1,
  },
  rowValue: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    color: '#222',
  },
  actionBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0B478',
    backgroundColor: '#F9EFE5',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionTitle: {
    color: '#F26A21',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 3,
  },
  actionLine: {
    color: '#F26A21',
    fontSize: 12,
    lineHeight: 18,
  },
  doneButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#3C469C',
    marginHorizontal: 70,
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
    fontSize: 35,
    fontWeight: '700',
  },
});
