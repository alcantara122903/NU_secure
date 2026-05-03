/**
 * Unified QR Ticket Display Screen
 * Handles all visitor types: enrollee, contractor, normal_visitor
 * Route: app/guard/qr-ticket.tsx
 */

import { EnhancedQrTicketView } from '@/components/guard/enhanced-qr-ticket-view';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getBluetoothPrinterDevices,
  isThermalPrinterNativeAvailable,
  printVisitorThermalTicket,
  requestThermalBluetoothPermissions,
} from '@/services/thermal-visitor-ticket-print';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type VisitorType = 'enrollee' | 'contractor' | 'normal_visitor' | 'normal';

interface VisitorQRTicketData {
  type: VisitorType;
  qrToken: string;
  /** JSON v1 payload encoded in the QR image (offices route + ids). Falls back to qrToken when absent. */
  qrPayload?: string;
  passNumber: string;
  controlNumber: string;
  visitorId: number;
  visitId: number;
  firstName: string;
  lastName: string;
  contactNo: string;
  offices: { id: number; name: string }[];
  /** Face capture preview URI (`file://` / `content://`) shown on ticket */
  facePhotoUri?: string;
  /** Normal visitor — shown as Purpose on ticket */
  reasonForVisit?: string;
  // Contractor-specific
  contractorId?: number;
  companyName?: string;
  purpose?: string;
  address?: string;
  // Enrollee-specific
  enrolleeId?: number;
  enrolleeStatus?: string;
}

export default function QRTicketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [ticketData, setTicketData] = useState<VisitorQRTicketData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [btPrinterModalVisible, setBtPrinterModalVisible] = useState(false);
  const [btPrinterRows, setBtPrinterRows] = useState<{ name: string; address: string }[]>([]);

  const paramsDataKey = typeof params.data === 'string' ? params.data : params.data?.[0] ?? '';

  useEffect(() => {
    if (!paramsDataKey) {
      setIsGenerating(false);
      return;
    }
    try {
      const data = JSON.parse(paramsDataKey) as VisitorQRTicketData;
      setTicketData(data);
    } catch (error) {
      console.error('Error parsing ticket data:', error);
      Alert.alert('Error', 'Failed to load ticket data');
      router.back();
    } finally {
      setIsGenerating(false);
    }
  }, [paramsDataKey, router]);

  const runThermalPrintToAddress = async (address: string) => {
    if (!ticketData) return;
    const visitorName = `${ticketData.firstName} ${ticketData.lastName}`.trim();
    const destination =
      ticketData.offices?.length > 0
        ? ticketData.offices.map((o) => o.name).join(', ')
        : '—';
    const qrData = ticketData.qrPayload ?? ticketData.qrToken;

    await printVisitorThermalTicket(address, {
      fullName: visitorName,
      destination,
      qrData,
    });
    Alert.alert('Success', 'Ticket sent to the thermal printer.');
  };

  const handlePrintTicket = async () => {
    if (!ticketData) return;

    if (Platform.OS !== 'android') {
      Alert.alert(
        'Thermal printer',
        'Bluetooth ESC/POS printing runs on an Android development build with native modules (not Expo Go). Use Download on other platforms.',
      );
      return;
    }

    if (!isThermalPrinterNativeAvailable()) {
      Alert.alert(
        'Thermal printer',
        'Expo Go does not include the Bluetooth printer native module. Create a development build: npx expo prebuild, then npx expo run:android (or EAS Build). Until then, use Download for a PDF.',
      );
      return;
    }

    try {
      setIsPrinting(true);
      const granted = await requestThermalBluetoothPermissions();
      if (!granted) {
        Alert.alert(
          'Permissions',
          'Bluetooth and location permissions are required to find and connect to the printer.',
        );
        return;
      }

      const devices = await getBluetoothPrinterDevices();
      if (devices.length === 0) {
        Alert.alert(
          'No printer found',
          'No Bluetooth printer was found. Pair your thermal printer in Android Settings → Bluetooth, then try again.',
        );
        return;
      }

      const rows = devices.map((d) => ({
        name: d.getName() || 'Printer',
        address: d.getAddress(),
      }));

      if (rows.length === 1) {
        await runThermalPrintToAddress(rows[0].address);
        return;
      }

      setBtPrinterRows(rows);
      setBtPrinterModalVisible(true);
    } catch (error) {
      console.error('Error printing ticket:', error);
      const message =
        error instanceof Error ? error.message : 'Could not print the ticket.';
      Alert.alert('Print error', message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSelectBluetoothPrinter = async (address: string) => {
    setBtPrinterModalVisible(false);
    try {
      setIsPrinting(true);
      await runThermalPrintToAddress(address);
    } catch (error) {
      console.error('Thermal print failed:', error);
      const message =
        error instanceof Error ? error.message : 'Could not print the ticket.';
      Alert.alert('Print error', message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadTicket = async () => {
    if (!ticketData) return;

    try {
      setIsDownloading(true);
      const visitorName = `${ticketData.firstName} ${ticketData.lastName}`;
      const officesList = ticketData.offices.map((o, i) => `${i + 1}. ${o.name}`).join('<br/>');
      
      // Build type-specific content
      let typeSpecificHtml = '';
      if (ticketData.type === 'contractor') {
        typeSpecificHtml = `
          <div class="section">
            <div class="section-title">Company Information</div>
            <div class="info-row">
              <div class="info-label">Company Name:</div>
              <div class="info-value">${ticketData.companyName || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Purpose:</div>
              <div class="info-value">${ticketData.purpose || 'N/A'}</div>
            </div>
            ${ticketData.address ? `
            <div class="info-row">
              <div class="info-label">Address:</div>
              <div class="info-value">${ticketData.address}</div>
            </div>
            ` : ''}
          </div>
        `;
      } else if (ticketData.type === 'enrollee') {
        typeSpecificHtml = `
          <div class="section">
            <div class="section-title">Enrollee Information</div>
            ${ticketData.enrolleeStatus ? `
            <div class="info-row">
              <div class="info-label">Status:</div>
              <div class="info-value">${ticketData.enrolleeStatus}</div>
            </div>
            ` : ''}
          </div>
        `;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Pass - ${visitorName}</title>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px;
                background-color: #fff;
              }
              .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background-color: white; 
                padding: 30px; 
                border: 1px solid #ddd;
                border-radius: 8px;
              }
              .header { 
                text-align: center; 
                border-bottom: 3px solid #1976d2; 
                padding-bottom: 20px; 
                margin-bottom: 30px; 
              }
              .header-title { 
                font-size: 28px; 
                font-weight: bold; 
                color: #1976d2; 
                margin: 0;
              }
              .badge {
                display: inline-block;
                background-color: #E3F2FD;
                color: #1976d2;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                margin-top: 10px;
              }
              .header-subtitle { 
                font-size: 14px; 
                color: #666; 
                margin: 8px 0 0 0;
              }
              .section { 
                margin-bottom: 24px; 
              }
              .section-title { 
                font-size: 16px; 
                font-weight: bold; 
                color: #1976d2; 
                margin-bottom: 12px;
                border-bottom: 1px solid #1976d2;
                padding-bottom: 8px;
              }
              .info-row { 
                display: flex; 
                padding: 10px 0; 
                border-bottom: 1px solid #eee;
              }
              .info-label { 
                font-size: 12px; 
                font-weight: bold; 
                color: #666; 
                width: 150px;
              }
              .info-value { 
                font-size: 14px; 
                color: #333; 
                flex: 1;
                word-break: break-word;
              }
              .qr-section { 
                text-align: center; 
                padding: 30px; 
                background-color: #f5f5f5; 
                border: 2px dashed #1976d2;
                border-radius: 8px;
                margin: 30px 0;
              }
              .qr-label { 
                font-size: 14px; 
                font-weight: bold; 
                color: #1976d2; 
                margin-bottom: 15px;
              }
              .qr-image { 
                max-width: 400px; 
                height: auto; 
                display: inline-block;
                margin: 15px 0;
                padding: 25px;
                background-color: white;
                border-radius: 8px;
              }
              .footer { 
                text-align: center; 
                font-size: 10px; 
                color: #999; 
                margin-top: 30px; 
                border-top: 1px solid #ddd; 
                padding-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="header-title">QR PASS</div>
                <div class="badge">${ticketData.type === 'contractor' ? 'CONTRACTOR' : ticketData.type === 'enrollee' ? 'ENROLLEE' : 'VISITOR'}</div>
                <div class="header-subtitle">Visitor ID: ${ticketData.visitorId}</div>
              </div>
              
              <div class="section">
                <div class="section-title">Visitor Information</div>
                <div class="info-row">
                  <div class="info-label">Name:</div>
                  <div class="info-value">${visitorName}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Contact:</div>
                  <div class="info-value">${ticketData.contactNo}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Pass Number:</div>
                  <div class="info-value">${ticketData.passNumber}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Control Number:</div>
                  <div class="info-value">${ticketData.controlNumber}</div>
                </div>
              </div>
              
              ${typeSpecificHtml}
              
              <div class="qr-section">
                <div class="qr-label">Scan this code at each office</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=30&data=${encodeURIComponent(ticketData.qrPayload ?? ticketData.qrToken)}" alt="QR Code" class="qr-image" />
                <div style="font-size: 10px; color: #666; margin-top: 10px;">${ticketData.qrPayload ? 'Digital ticket (JSON)' : 'Token'}: ${(ticketData.qrPayload ?? ticketData.qrToken).substring(0, 200)}…</div>
              </div>
              
              <div class="section">
                <div class="section-title">Offices to Visit</div>
                <div style="padding: 10px 0;">${officesList}</div>
              </div>
              
              <div class="footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>Visitor ID: ${ticketData.visitorId}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
      });

      // Share/Download the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `QR_Ticket_${ticketData.visitorId}.pdf`,
          UTI: 'com.adobe.pdf',
        });
        Alert.alert('Success', 'QR ticket downloaded successfully');
      } else {
        Alert.alert('Info', 'Download not available on this device');
      }
    } catch (error) {
      console.error('Error downloading ticket:', error);
      Alert.alert('Download Error', 'Failed to download ticket. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

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

  const visitorName = `${ticketData.firstName} ${ticketData.lastName}`.trim();
  const qrEncoded = ticketData.qrPayload ?? ticketData.qrToken;

  const typeLabel =
    ticketData.type === 'contractor'
      ? 'Contractor'
      : ticketData.type === 'enrollee'
        ? 'Enrollee'
        : 'Normal Visitor';

  const purposeText =
    ticketData.type === 'contractor'
      ? (ticketData.purpose?.trim() || '—')
      : ticketData.type === 'enrollee'
        ? 'Campus enrollment'
        : (ticketData.reasonForVisit?.trim() || '—');

  const destinationText =
    ticketData.offices?.length > 0 ? ticketData.offices.map((o) => o.name).join(', ') : '—';

  const visitRoute = (ticketData.offices ?? []).map((o) => ({ id: o.id, name: o.name }));

  return (
    <>
      <EnhancedQrTicketView
        fullName={visitorName}
        passNumber={String(ticketData.passNumber)}
        controlNumber={String(ticketData.controlNumber)}
        purpose={purposeText}
        destination={destinationText}
        visitorTypeLabel={typeLabel}
        photoUri={ticketData.facePhotoUri}
        visitRoute={visitRoute}
        qrValue={qrEncoded}
        onBack={() => router.back()}
        onDownload={handleDownloadTicket}
        onPrint={handlePrintTicket}
        onCompleteReturn={() => router.replace('/guard/dashboard')}
        isDownloading={isDownloading}
        isPrinting={isPrinting}
      />

      <Modal
        visible={btPrinterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBtPrinterModalVisible(false)}
      >
        <View style={styles.btModalBackdrop}>
          <View style={[styles.btModalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.btModalTitle, { color: colors.text }]}>
              Choose Bluetooth printer
            </Text>
            <ScrollView
              style={styles.btPrinterScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {btPrinterRows.map((item) => (
                <TouchableOpacity
                  key={item.address}
                  style={[styles.btPrinterRow, { borderColor: colors.border }]}
                  onPress={() => void handleSelectBluetoothPrinter(item.address)}
                >
                  <MaterialIcons name="print" size={22} color={colors.primary} />
                  <View style={styles.btPrinterRowText}>
                    <Text style={[styles.btPrinterName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.btPrinterAddr, { color: colors.textSecondary }]}>
                      {item.address}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btModalCancel, { backgroundColor: colors.border }]}
              onPress={() => setBtPrinterModalVisible(false)}
            >
              <Text style={[styles.btModalCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  btModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  btModalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '55%',
  },
  btModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  btPrinterScroll: {
    maxHeight: 280,
  },
  btPrinterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
  },
  btPrinterRowText: {
    flex: 1,
  },
  btPrinterName: {
    fontSize: 16,
    fontWeight: '600',
  },
  btPrinterAddr: {
    fontSize: 12,
    marginTop: 2,
  },
  btModalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
