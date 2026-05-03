import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import type { ThermalPrinterDevice } from 'react-native-thermal-pos-printer';

const LINE_WIDTH = 24;

const DEV_BUILD_MESSAGE =
  'Bluetooth thermal printing needs a development build with native code (not Expo Go). Run: npx expo prebuild then npx expo run:android, or use an EAS development build.';

function dashedLine(): string {
  return '-'.repeat(LINE_WIDTH);
}

/** True when the native PosPrinter module is linked (custom dev build), not Expo Go. */
export function isThermalPrinterNativeAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  return !!(NativeModules as { PosPrinter?: unknown }).PosPrinter;
}

type PosPrinterModule = typeof import('react-native-thermal-pos-printer').default;

let cachedPrinter: PosPrinterModule | undefined;
let loadFailed = false;

function getPosPrinter(): PosPrinterModule {
  if (cachedPrinter) return cachedPrinter;
  if (loadFailed) {
    throw new Error(DEV_BUILD_MESSAGE);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-thermal-pos-printer') as {
      default: PosPrinterModule;
    };
    cachedPrinter = mod.default;
    return cachedPrinter;
  } catch {
    loadFailed = true;
    throw new Error(DEV_BUILD_MESSAGE);
  }
}

/** Runtime Bluetooth permissions for Android 12+ and location for classic discovery. */
export async function requestThermalBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const toRequest: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][] =
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  if (typeof Platform.Version === 'number' && Platform.Version >= 31) {
    toRequest.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
  }

  const result = await PermissionsAndroid.requestMultiple(toRequest);
  return Object.values(result).every((v) => v === 'granted');
}

export async function initThermalPrinter(): Promise<void> {
  await getPosPrinter().init();
}

/** Paired / known printers from the native module (typically Bluetooth bonded devices). */
export async function getBluetoothPrinterDevices(): Promise<ThermalPrinterDevice[]> {
  await initThermalPrinter();
  const RN = getPosPrinter();
  const list = await RN.getDeviceList();
  return list.filter(
    (d) => String(d.getType?.() ?? '').toUpperCase() === 'BLUETOOTH',
  );
}

export interface VisitorThermalTicketPayload {
  fullName: string;
  destination: string;
  /** Same string encoded in the on-screen QR */
  qrData: string;
}

/**
 * Connects by MAC address, prints ESC/POS receipt, disconnects.
 * Caller should ensure permissions + init (or call getBluetoothPrinterDevices first).
 */
export async function printVisitorThermalTicket(
  deviceAddress: string,
  payload: VisitorThermalTicketPayload,
): Promise<void> {
  const RN = getPosPrinter();
  const name = payload.fullName.trim() || '—';
  const destination = payload.destination.trim() || '—';
  const qr = payload.qrData.trim();
  if (!qr) {
    throw new Error('Missing QR data for printing.');
  }

  await initThermalPrinter();
  const devices = await RN.getDeviceList();
  const printer = devices.find((d) => d.getAddress() === deviceAddress);
  if (!printer) {
    throw new Error(
      `Printer not found for address ${deviceAddress}. Pair it in Bluetooth settings and try again.`,
    );
  }
  // connectPrinter() alone often leaves JS `connected` false; instance connect() sets it after native link.
  await printer.connect({ type: 'BLUETOOTH', encoding: 'UTF-8' });

  try {
    await printer.printText('VISITOR QR PASS\n', {
      align: 'CENTER',
      bold: true,
      size: 24,
    });
    await printer.printText(`${dashedLine()}\n`, { align: 'CENTER' });

    await printer.printText('NAME:\n', { bold: true });
    await printer.printText(`${name}\n\n`);

    await printer.printText('DESTINATION:\n', { bold: true });
    await printer.printText(`${destination}\n\n`);

    await printer.printQRCode(qr, {
      align: 'CENTER',
      size: 6,
      errorLevel: 'M',
    });
    await RN.newLine(2);

    await printer.printText('Please present this ticket.\n', {
      align: 'CENTER',
    });
    await RN.newLine(2);

    try {
      await printer.cutPaper();
    } catch {
      // Some portable units have no auto-cutter
    }
  } finally {
    try {
      await printer.disconnect();
    } catch {
      try {
        await RN.disconnectPrinter();
      } catch {
        // ignore
      }
    }
  }
}
