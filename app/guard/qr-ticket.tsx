/**
 * Unified QR Ticket Display Screen
 * Handles all visitor types: enrollee, contractor, normal_visitor
 * Route: app/guard/qr-ticket.tsx
 */

import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type VisitorType = 'enrollee' | 'contractor' | 'normal_visitor';

interface VisitorQRTicketData {
  type: VisitorType;
  qrToken: string;
  passNumber: string;
  controlNumber: string;
  visitorId: number;
  visitId: number;
  firstName: string;
  lastName: string;
  contactNo: string;
  offices: Array<{ id: number; name: string }>;
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
  const [ticketData, setTicketData] = useState<VisitorQRTicketData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handlePrintTicket = async () => {
    if (!ticketData) return;

    try {
      setIsPrinting(true);
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
              .qr-code { 
                width: 300px; 
                height: 300px; 
                margin: 0 auto 15px;
              }
              .office-list { 
                list-style: none; 
                padding: 0; 
                margin: 0;
              }
              .office-item { 
                padding: 10px 0; 
                border-bottom: 1px solid #eee;
              }
              .office-item:last-child { 
                border-bottom: none; 
              }
              .footer { 
                text-align: center; 
                font-size: 12px; 
                color: #999; 
                margin-top: 30px; 
                border-top: 1px solid #eee; 
                padding-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <p class="header-title">QR Pass</p>
                <div class="badge">${ticketData.type === 'contractor' ? 'Contractor' : ticketData.type === 'enrollee' ? 'Enrollee' : 'Visitor'}</div>
                <p class="header-subtitle">Visitor Management System</p>
              </div>

              <div class="section">
                <div class="section-title">Visitor Information</div>
                <div class="info-row">
                  <div class="info-label">Full Name:</div>
                  <div class="info-value">${visitorName}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Pass Number:</div>
                  <div class="info-value">${ticketData.passNumber}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Control Number:</div>
                  <div class="info-value">${ticketData.controlNumber}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Contact Number:</div>
                  <div class="info-value">${ticketData.contactNo}</div>
                </div>
              </div>

              ${typeSpecificHtml}

              <div class="section">
                <div class="section-title">Authorized Offices</div>
                <ul class="office-list">
                  ${officesList}
                </ul>
              </div>

              <div class="qr-section">
                <div class="qr-label">Scan QR Code for Verification</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketData.qrToken)}" alt="QR Code" class="qr-code" />
              </div>

              <div class="section">
                <div class="section-title">QR Token</div>
                <div class="info-row">
                  <div class="info-value" style="word-break: break-all; font-family: monospace; font-size: 11px;">${ticketData.qrToken}</div>
                </div>
              </div>

              <div class="footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>Visitor ID: ${ticketData.visitorId}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await Print.printAsync({
        html: htmlContent,
        printerUrl: undefined,
      });

      Alert.alert('Success', 'Ticket printed successfully');
    } catch (error) {
      console.error('Error printing ticket:', error);
      Alert.alert('Print Error', 'Failed to print ticket. Please try again.');
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
                max-width: 300px; 
                height: auto; 
                display: inline-block;
                margin: 15px 0;
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
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketData.qrToken)}" alt="QR Code" class="qr-image" />
                <div style="font-size: 10px; color: #666; margin-top: 10px;">Token: ${ticketData.qrToken}</div>
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

  const visitorName = `${ticketData.firstName} ${ticketData.lastName}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    ticketData.qrToken
  )}`;
  
  // Determine type label and success message
  const typeLabel = ticketData.type === 'contractor' ? 'Contractor' : 
                    ticketData.type === 'enrollee' ? 'Enrollee' : 'Visitor';
  const successMessage = `${typeLabel} Registered Successfully`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR Ticket</Text>
          <View style={styles.spacer} />
        </View>

        {/* Main Ticket Card */}
        <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Success Banner with Type Badge */}
          <View style={[styles.successBanner, { backgroundColor: '#E8F5E9' }]}>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.successText, { color: '#2E7D32' }]}>{successMessage}</Text>
              <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.typeBadgeText}>{typeLabel}</Text>
              </View>
            </View>
          </View>

          {/* QR Code Section with Visual QR */}
          <View style={[styles.qrSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>Scan this code at each office</Text>
            <View style={styles.qrContainer}>
              <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
            </View>
            
            {/* QR Token Display */}
            <View style={[styles.tokenBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tokenLabel, { color: colors.textSecondary }]}>QR Token</Text>
              <Text style={[styles.tokenValue, { color: colors.primary }]} selectable>
                {ticketData.qrToken}
              </Text>
            </View>
          </View>

          {/* Visitor Information */}
          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Full Name</Text>
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

          {/* Contractor-Specific Section */}
          {ticketData.type === 'contractor' && (
            <View style={styles.contractorSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Information</Text>
              
              {ticketData.companyName && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Company Name</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{ticketData.companyName}</Text>
                </View>
              )}

              {ticketData.purpose && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Purpose</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{ticketData.purpose}</Text>
                </View>
              )}

              {ticketData.address && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Address</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{ticketData.address}</Text>
                </View>
              )}
            </View>
          )}

          {/* Enrollee-Specific Section */}
          {ticketData.type === 'enrollee' && ticketData.enrolleeStatus && (
            <View style={styles.enrolleeSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Enrollee Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                <MaterialIcons name="info" size={18} color="#4CAF50" />
                <Text style={{ color: '#2E7D32', fontWeight: '600', marginLeft: 8 }}>
                  {ticketData.enrolleeStatus}
                </Text>
              </View>
            </View>
          )}

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
                  <View style={[styles.officeNumber, { backgroundColor: colors.primary }]}>
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

        {/* Download & Print Buttons */}
        <View style={styles.actionButtonsContainer}>
          {/* Download Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3', flex: 1, marginRight: 10 }]}
            onPress={handleDownloadTicket}
            disabled={isDownloading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="download" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>{isDownloading ? 'Downloading...' : 'Download'}</Text>
          </TouchableOpacity>

          {/* Print Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800', flex: 1, marginLeft: 10 }]}
            onPress={handlePrintTicket}
            disabled={isPrinting}
            activeOpacity={0.8}
          >
            <MaterialIcons name="print" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>{isPrinting ? 'Printing...' : 'Print'}</Text>
          </TouchableOpacity>
        </View>

        {/* Complete & Return Button */}
        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: '#4CAF50', marginHorizontal: 20 }]}
          onPress={() => {
            Alert.alert(
              'Ticket Saved',
              `${typeLabel} ticket has been generated and saved.\n\nVisitor: ${visitorName}`,
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/guard/dashboard'),
                },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
          <Text style={styles.generateButtonText}>Complete & Return</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
  qrImage: {
    width: 300,
    height: 300,
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
  contractorSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 12,
  },
  enrolleeSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
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
  tokenBox: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
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
  generateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 12,
    gap: 0,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
