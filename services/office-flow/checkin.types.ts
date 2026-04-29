export type OfficeCheckInScanRequest = {
  rawQrValue: string;
  scanningOfficeId: number;
  scannedByUserId: number;
};

export type OfficeCheckInScanResult = {
  success: boolean;
  authorized: boolean;
  title: string;
  message: string;
  visitorName?: string;
  purposeLabel?: string;
  purposeReason?: string | null;
  entryTime?: string | null;
  scanTime?: string | null;
  registeredBy?: string | null;
  destinationStatusLabel?: string;
  enrolleeStatusLabel?: string;
  isCorrectDestination?: boolean;
  destinationOffice?: string;
  passNumber?: string | null;
  controlNumber?: string | null;
  expectedOfficeName?: string;
  scanningOfficeName?: string;
  visitId?: number;
  errorCode?: string;
};
