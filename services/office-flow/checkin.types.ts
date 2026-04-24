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
  passNumber?: string | null;
  controlNumber?: string | null;
  expectedOfficeName?: string;
  scanningOfficeName?: string;
  visitId?: number;
  errorCode?: string;
};
