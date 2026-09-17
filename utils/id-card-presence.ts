/**
 * Lightweight "is there an ID card in the guide?" heuristic.
 * Uses luminance variance + edge density on a tiny JPEG crop.
 * Not ML — good enough to avoid empty-frame auto-capture in Expo Go.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

export type Rect = { x: number; y: number; width: number; height: number };

function base64ToUint8Array(base64: string): Uint8Array {
  const pure = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = globalThis.atob(pure);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function computeGuideCrop(params: {
  photoWidth: number;
  photoHeight: number;
  preview: { width: number; height: number };
  guide: Rect;
}): { originX: number; originY: number; width: number; height: number } | null {
  const { photoWidth, photoHeight, preview, guide } = params;
  if (
    photoWidth <= 0 ||
    photoHeight <= 0 ||
    preview.width <= 0 ||
    preview.height <= 0 ||
    guide.width <= 0 ||
    guide.height <= 0
  ) {
    return null;
  }

  const imageAspect = photoWidth / photoHeight;
  const viewAspect = preview.width / preview.height;
  let displayedW: number;
  let displayedH: number;
  let offsetX = 0;
  let offsetY = 0;
  if (imageAspect > viewAspect) {
    displayedH = preview.height;
    displayedW = preview.height * imageAspect;
    offsetX = (displayedW - preview.width) / 2;
  } else {
    displayedW = preview.width;
    displayedH = preview.width / imageAspect;
    offsetY = (displayedH - preview.height) / 2;
  }

  const crop = {
    originX: Math.max(0, Math.round(((guide.x + offsetX) / displayedW) * photoWidth)),
    originY: Math.max(0, Math.round(((guide.y + offsetY) / displayedH) * photoHeight)),
    width: Math.max(1, Math.round((guide.width / displayedW) * photoWidth)),
    height: Math.max(1, Math.round((guide.height / displayedH) * photoHeight)),
  };
  if (crop.originX + crop.width > photoWidth) crop.width = photoWidth - crop.originX;
  if (crop.originY + crop.height > photoHeight) crop.height = photoHeight - crop.originY;
  if (crop.width < 16 || crop.height < 16) return null;
  return crop;
}

/**
 * Returns true when the guide region looks like a plastic ID card
 * (enough texture/edges), false for empty desk/wall/blurry nothing.
 */
export async function detectIdInGuide(params: {
  uri: string;
  photoWidth: number;
  photoHeight: number;
  preview: { width: number; height: number };
  guide: Rect;
}): Promise<boolean> {
  const crop = computeGuideCrop(params);
  if (!crop) return false;

  const resized = await ImageManipulator.manipulateAsync(
    params.uri,
    [{ crop }, { resize: { width: 96 } }],
    {
      compress: 0.55,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  let b64 = resized.base64 ?? '';
  if (!b64 && resized.uri) {
    b64 = await FileSystem.readAsStringAsync(resized.uri, { encoding: 'base64' });
  }
  if (!b64) return false;

  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(base64ToUint8Array(b64), { useTArray: true });
  } catch {
    return false;
  }

  const { width, height, data } = decoded;
  if (width < 8 || height < 8) return false;

  const luminances: number[] = [];
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luminances.push(lum);

      if (x + 1 < width && y + 1 < height) {
        const right = (y * width + (x + 1)) * 4;
        const down = ((y + 1) * width + x) * 4;
        const lumR = 0.299 * data[right] + 0.587 * data[right + 1] + 0.114 * data[right + 2];
        const lumD = 0.299 * data[down] + 0.587 * data[down + 1] + 0.114 * data[down + 2];
        edgeSum += Math.abs(lum - lumR) + Math.abs(lum - lumD);
        edgeCount += 2;
      }
    }
  }

  const n = luminances.length;
  if (n < 64) return false;

  const mean = luminances.reduce((a, b) => a + b, 0) / n;
  let variance = 0;
  for (const lum of luminances) {
    const d = lum - mean;
    variance += d * d;
  }
  variance /= n;

  const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : 0;

  // Empty wall/desk: low variance + low edges.
  // ID card (text/photo/borders): higher variance + edges.
  // Too dark / blown-out glare also tends to fail these thresholds.
  const hasTexture = variance >= 280;
  const hasEdges = edgeAvg >= 9.5;
  const notTooDark = mean >= 28;
  const notBlownOut = mean <= 235;

  return hasTexture && hasEdges && notTooDark && notBlownOut;
}
