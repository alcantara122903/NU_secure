/**
 * ID guide assessment for auto-capture gating.
 * Requires: card present + sharp (not blurry) + enough text-like detail to be readable.
 * Heuristic only (no OCR) — suitable for Expo Go.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

export type Rect = { x: number; y: number; width: number; height: number };

export type IdGuideRejectReason = 'empty' | 'blurry' | 'unreadable' | 'glare' | 'dark';

export type IdGuideAssessment = {
  /** True only when auto-capture is allowed */
  ready: boolean;
  hasCard: boolean;
  isSharp: boolean;
  isReadable: boolean;
  reason: IdGuideRejectReason | 'ready';
};

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
  if (crop.width < 24 || crop.height < 24) return null;
  return crop;
}

function reject(
  reason: IdGuideRejectReason,
  partial?: Partial<IdGuideAssessment>,
): IdGuideAssessment {
  return {
    ready: false,
    hasCard: false,
    isSharp: false,
    isReadable: false,
    reason,
    ...partial,
  };
}

/**
 * Assess whether the guide region has a clear, readable ID ready for capture.
 */
export async function assessIdInGuide(params: {
  uri: string;
  photoWidth: number;
  photoHeight: number;
  preview: { width: number; height: number };
  guide: Rect;
}): Promise<IdGuideAssessment> {
  const crop = computeGuideCrop(params);
  if (!crop) return reject('empty');

  // Higher res than presence-only check so blur/text detail is measurable.
  const resized = await ImageManipulator.manipulateAsync(
    params.uri,
    [{ crop }, { resize: { width: 180 } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  let b64 = resized.base64 ?? '';
  if (!b64 && resized.uri) {
    b64 = await FileSystem.readAsStringAsync(resized.uri, { encoding: 'base64' });
  }
  if (!b64) return reject('empty');

  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(base64ToUint8Array(b64), { useTArray: true });
  } catch {
    return reject('empty');
  }

  const { width, height, data } = decoded;
  if (width < 24 || height < 24) return reject('empty');

  const luminances = new Float32Array(width * height);
  let mean = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luminances[y * width + x] = lum;
      mean += lum;
    }
  }
  const n = width * height;
  mean /= n;

  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = luminances[i] - mean;
    variance += d * d;
  }
  variance /= n;

  // Focus on the inner content area (ignore outer border) for text readability.
  const x0 = Math.floor(width * 0.08);
  const x1 = Math.ceil(width * 0.92);
  const y0 = Math.floor(height * 0.12);
  const y1 = Math.ceil(height * 0.88);

  let edgeSum = 0;
  let edgeCount = 0;
  let strongEdgeCount = 0;
  let laplacianSumSq = 0;
  let laplacianCount = 0;
  let localContrastHits = 0;
  let localContrastSamples = 0;

  for (let y = y0 + 1; y < y1 - 1; y++) {
    for (let x = x0 + 1; x < x1 - 1; x++) {
      const idx = y * width + x;
      const c = luminances[idx];
      const l = luminances[idx - 1];
      const r = luminances[idx + 1];
      const u = luminances[idx - width];
      const d = luminances[idx + width];

      const dx = Math.abs(c - r);
      const dy = Math.abs(c - d);
      const edge = dx + dy;
      edgeSum += edge;
      edgeCount += 1;
      if (edge >= 28) strongEdgeCount += 1;

      // Discrete Laplacian — sharp images have higher variance of this response.
      const lap = Math.abs(4 * c - l - r - u - d);
      laplacianSumSq += lap * lap;
      laplacianCount += 1;

      // Local contrast in a tiny neighborhood (text strokes create peaks).
      const maxN = Math.max(c, l, r, u, d);
      const minN = Math.min(c, l, r, u, d);
      localContrastSamples += 1;
      if (maxN - minN >= 32) localContrastHits += 1;
    }
  }

  if (edgeCount < 100 || laplacianCount < 100) {
    return reject('empty');
  }

  const edgeAvg = edgeSum / edgeCount;
  const strongEdgeRatio = strongEdgeCount / edgeCount;
  const laplacianVar = laplacianSumSq / laplacianCount;
  const localContrastRatio = localContrastHits / Math.max(localContrastSamples, 1);

  // Lighting gates
  if (mean < 32) {
    return reject('dark', { hasCard: variance >= 220 });
  }
  if (mean > 232) {
    return reject('glare', { hasCard: variance >= 220 });
  }

  // Presence: enough overall structure for a card in frame
  const hasCard = variance >= 320 && edgeAvg >= 11;
  if (!hasCard) {
    return reject('empty');
  }

  // Sharpness: blurry frames smear edges → low Laplacian energy
  const isSharp = laplacianVar >= 420 && edgeAvg >= 14;
  if (!isSharp) {
    return reject('blurry', { hasCard: true, isSharp: false });
  }

  // Readability: enough strong local edges / contrast to imply text & photo detail
  const isReadable =
    strongEdgeRatio >= 0.085 &&
    localContrastRatio >= 0.12 &&
    laplacianVar >= 520 &&
    edgeAvg >= 16;

  if (!isReadable) {
    return reject('unreadable', {
      hasCard: true,
      isSharp: true,
      isReadable: false,
    });
  }

  return {
    ready: true,
    hasCard: true,
    isSharp: true,
    isReadable: true,
    reason: 'ready',
  };
}

/** @deprecated Prefer assessIdInGuide — kept for any older imports */
export async function detectIdInGuide(params: {
  uri: string;
  photoWidth: number;
  photoHeight: number;
  preview: { width: number; height: number };
  guide: Rect;
}): Promise<boolean> {
  const result = await assessIdInGuide(params);
  return result.ready;
}
