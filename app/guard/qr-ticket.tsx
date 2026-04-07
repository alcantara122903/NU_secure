/**
 * Normal Visitor QR Ticket Display
 * Shows token, pass number, control number, and visitor details
 * Route: app/guard/qr-ticket.tsx
 */

import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface QRTicketData {
  qrToken: string;
  passNumber: string;
  controlNumber: string;
  visitorId: number;
  visitId: number;
  firstName: string;
  lastName: string;
  contactNo: string;
  offices: Array<{ id: number; name: string }>;
}

export default function QRTicketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [ticketData, setTicketData] = useState<QRTicketData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);

  const colors = {
    primary: useThemeColor({}, 'primary'),
    surface: useThemeColor({}, 'surface'),
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    border: useThemeColor({}, 'border'),
    background: useThemeColor({}, 'background'),
  };

  useEffect(() => {
    if (params?.data) {
      try {
        const data = JSON.parse(params.data as string);
        setTicketData(data);
      } catch (error) {
        console.error('Error parsing ticket data:', error);
        Alert.alert('Error', 'Failed to load ticket data');
        router.back();
      }
    }
    setIsGenerating(false);
  }, []);

  if (isGenerating || !ticketData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <MaterialIcons name="qr-code-2" size={80} color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Generating QR Ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const visitorName = `${ticketData.firstName} ${ticketData.lastName}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR Ticket</Text>
          <View style={styles.spacer} />
        </View>

        {/* Main Ticket Card */}
        <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Success Banner */}
          <View style={[styles.successBanner, { backgroundColor: '#E8F5E9' }]}>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={[styles.successText, { color: '#2E7D32' }]}>
              Visitor Registered Successfully
            </Text>
          </View>

          {/* QR Code Section */}
          <View style={[styles.qrSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>Scan this code at each office</Text>
            <View style={styles.qrContainer}>
              <View style={[styles.qrTokenBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={[styles.qrTokenLabel, { color: colors.textSecondary }]}>QR Token:</Text>
                <Text style={[styles.qrTokenText, { color: colors.text }]}>{ticketData.qrToken}</Text>
              </View>
            </View>
          </View>

          {/* Visitor Information */}
          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Visitor Name</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{visitorName}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Contact Number</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{ticketData.contactNo}</Text>
            </View>
          </View>

          {/* Pass & Control Numbers */}
          <View style={[styles.numbersSection, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.numberBox}>
              <Text style={[styles.numberLabel, { color: colors.textSecondary }]}>Pass Number</Text>
              <Text style={[styles.numberValue, { color: colors.primary }]}>{ticketData.passNumber}</Text>
            </View>

            <View style={styles.numberBox}>
              <Text style={[styles.numberLabel, { color: colors.textSecondary }]}>Control Number</Text>
              <Text style={[styles.numberValue, { color: colors.primary }]}>{ticketData.controlNumber}</Text>
            </View>
          </View>

          {/* Destination Offices */}
          <View style={styles.officesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Destination Offices to Visit</Text>
            <View style={[styles.officeList, { borderColor: colors.border }]}>
              {ticketData.offices.map((office, index) => (
                <View
                  key={index}
                  style={[
                    styles.officeItem,
                    {
                      borderBottomColor: index < ticketData.offices.length - 1 ? colors.border : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.officeNumber,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.officeNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.officeName, { color: colors.text }]}>{office.name}</Text>
                  <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          </View>

          {/* Instructions */}
          <View style={[styles.instructionsBox, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
            <MaterialIcons name="info" size={20} color="#E65100" />
            <Text style={[styles.instructionsText, { color: '#E65100' }]}>
              Please keep this QR code visible. Guards at each office will scan it to validate your visit.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.printButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            Alert.alert('Print', 'Printing QR Ticket (feature coming soon)');
          }}
        >
          <MaterialIcons name="print" size={20} color="#FFFFFF" />
          <Text style={styles.printButtonText}>Print Ticket</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.returnButton, { borderColor: colors.primary, backgroundColor: colors.background }]}
          onPress={() => {
            Alert.alert(
              'Return to Dashboard',
              'This ticket has been saved. You can retrieve it anytime.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Return', onPress: () => router.replace('/(tabs)') },
              ]
            );
          }}
        >
          <Text style={[styles.returnButtonText, { color: colors.primary }]}>Return to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spacer: {
    width: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  qrLabel: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  infoItem: {
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  numbersSection: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  numberBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  numberLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  numberValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  officesSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  officeList: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  officeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  officeNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  officeNumberText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  officeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsBox: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  instructionsText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  printButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  returnButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 20,
  },
  returnButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  qrTokenBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 250,
  },
  qrTokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  qrTokenText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 20,
  },
});
