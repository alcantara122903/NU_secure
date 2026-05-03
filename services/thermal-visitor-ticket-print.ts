import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import type { ThermalPrinterDevice } from 'react-native-thermal-pos-printer';

const LINE_WIDTH = 24;

/** Single-line header; keep ≤12 for compact width on 58mm (24 columns). */
const SIZE_VISITOR_QR_PASS_HEADER = 12;
/** Footer: numeric size ≤12 is smallest GS scale bucket; use font B for smaller glyphs. */
const SIZE_FOOTER_NOTE = 12;
const SIZE_CONTROL_TEXT = 12;
/** Value lines use Font B (~24 cols on 58mm). */
const CONTROL_NO_WRAP_WIDTH = 24;
/** Blank lines after footer before cut — room to pull ticket without tearing through text. */
const FOOTER_FEED_LINES_BEFORE_CUT = 4;
/** Smaller QR = less native feed + tighter gap before CONTROL NO. Raise to 5 if scan reliability drops. */
const QR_MODULE_SIZE = 4;

/** ESC/POS: taller line spacing (dots) while header prints — avoids bottom of letters clipping. */
const ESC_SET_LINE_SPACING = (n: number): number[] => [0x1b, 0x33, n & 0xff];
/** ESC/POS: restore default line spacing (1/6"). */
const ESC_DEFAULT_LINE_SPACING = [0x1b, 0x32];
/** Raise if letters still clip; lower if header has too much gap (many printers: 40–56). */
const HEADER_LINE_SPACING_DOTS = 0x24;
/** Tall line box after QR for CONTROL + value + footer — default spacing clips bottom of glyphs on many 58mm units. */
const CONTROL_BLOCK_LINE_SPACING_DOTS = 0x4e;

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
  /** Printed centered below the QR image (optional — defaults to em dash) */
  controlNumber?: string;
}

function strField(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

/**
 * Wrap control number for 58mm: prefer breaks after `- _ . /` or space near line end
 * so digits/letters are not split awkwardly; otherwise hard-wrap at maxChars.
 */
function wrapControlNumberLines(text: string | undefined | null, maxChars: number): string[] {
  const t = strField(text) || '—';
  if (maxChars < 8) return [t];
  if (t.length <= maxChars) return [t];

  const lines: string[] = [];
  let rest = t;
  const delimRe = /[-_.\s/]/;

  while (rest.length > maxChars) {
    const head = rest.slice(0, maxChars);
    let cut = maxChars;
    const searchFrom = Math.max(4, maxChars - 10);
    for (let i = maxChars - 1; i >= searchFrom; i--) {
      if (delimRe.test(head[i])) {
        cut = i + 1;
        break;
      }
    }
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
    if (!rest) break;
  }
  if (rest.length > 0) {
    lines.push(rest);
  }
  return lines.length > 0 ? lines : ['—'];
}

/**
 * Connects by MAC address, prints ESC/POS receipt, disconnects.
 * Caller should ensure permissions + init (or call getBluetoothPrinterDevices first).
 */
export async function printVisitorThermalTicket(
  deviceAddress: string,
  payload: VisitorThermalTicketPayload | null | undefined,
): Promise<void> {
  if (payload == null || typeof payload !== 'object') {
    throw new Error('Invalid ticket payload for printing.');
  }
  const RN = getPosPrinter();
  const name = strField(payload.fullName) || '—';
  const destination = strField(payload.destination) || '—';
  const controlNo = strField(payload.controlNumber) || '—';
  const qr = strField(payload.qrData);
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

  const headerOpts = {
    align: 'CENTER' as const,
    bold: true,
    size: SIZE_VISITOR_QR_PASS_HEADER,
  };

  try {
    await printer.sendRawCommand(ESC_SET_LINE_SPACING(HEADER_LINE_SPACING_DOTS));
    await printer.printText('VISITOR QR PASS\n', headerOpts);
    await RN.newLine(1);
    await printer.sendRawCommand(ESC_DEFAULT_LINE_SPACING);

    await printer.printText(`${dashedLine()}\n`, { align: 'CENTER' });

    await printer.printText('NAME:\n', { bold: true });
    await printer.printText(`${name}\n`);

    await printer.printText('DESTINATION:\n', { bold: true });
    await printer.printText(`${destination}\n`);

    await printer.printQRCode(qr, {
      align: 'CENTER',
      size: QR_MODULE_SIZE,
      errorLevel: 'M',
    });
    /*
     * After QR: restore default, then use *taller* per-line spacing for the control block.
     * Default/narrow spacing here often clips the bottom of characters (descenders / next line overlap).
     */
    await printer.sendRawCommand(ESC_DEFAULT_LINE_SPACING);
    await printer.sendRawCommand(ESC_SET_LINE_SPACING(CONTROL_BLOCK_LINE_SPACING_DOTS));

    await printer.printText('CONTROL NO.\n', {
      align: 'CENTER',
      bold: true,
      size: SIZE_CONTROL_TEXT,
      fontType: 'A',
    });
    await RN.newLine(1);

    const controlValueOpts = {
      align: 'CENTER' as const,
      size: SIZE_CONTROL_TEXT,
      fontType: 'B' as const,
      bold: false,
    };
    for (const segment of wrapControlNumberLines(controlNo, CONTROL_NO_WRAP_WIDTH)) {
      await printer.printText(`${segment}\n`, controlValueOpts);
    }
    await RN.newLine(1);

    await printer.printText('Please present ticket.\n', {
      align: 'CENTER',
      size: SIZE_FOOTER_NOTE,
      fontType: 'B',
    });
    await printer.sendRawCommand(ESC_DEFAULT_LINE_SPACING);
    await RN.newLine(FOOTER_FEED_LINES_BEFORE_CUT);

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
