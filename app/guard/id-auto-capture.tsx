import { ID_PHOTO_QUALITY } from '@/services/camera';
import { detectIdInGuide, type Rect } from '@/utils/id-card-presence';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation, useRouter } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STABLE_MS = 1400;
const WARMUP_MS = 900;
const PROBE_INTERVAL_MS = 900;
/** Consecutive positive probes required before we treat an ID as present */
const DETECT_STREAK_NEEDED = 2;

type Phase = 'warmup' | 'align' | 'detected' | 'hold' | 'capturing' | 'reading';

export type IdCaptureResult =
  | { ok: true; uri: string; base64: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

let pendingCapture: ((result: IdCaptureResult) => void) | null = null;

export function beginIdCapture(): Promise<IdCaptureResult> {
  pendingCapture?.({ ok: false, cancelled: true });
  return new Promise((resolve) => {
    pendingCapture = resolve;
  });
}

function finishIdCapture(result: IdCaptureResult): void {
  const resolve = pendingCapture;
  pendingCapture = null;
  resolve?.(result);
}

async function cropToGuide(params: {
  uri: string;
  photoWidth: number;
  photoHeight: number;
  preview: { width: number; height: number };
  guide: Rect;
  quality: number;
}): Promise<{ uri: string; base64: string } | null> {
  const { photoWidth, photoHeight, preview, guide } = params;
  let crop: { originX: number; originY: number; width: number; height: number } | null = null;

  if (
    photoWidth > 0 &&
    photoHeight > 0 &&
    preview.width > 0 &&
    preview.height > 0 &&
    guide.width > 0 &&
    guide.height > 0
  ) {
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
    crop = {
      originX: Math.max(0, Math.round(((guide.x + offsetX) / displayedW) * photoWidth)),
      originY: Math.max(0, Math.round(((guide.y + offsetY) / displayedH) * photoHeight)),
      width: Math.max(1, Math.round((guide.width / displayedW) * photoWidth)),
      height: Math.max(1, Math.round((guide.height / displayedH) * photoHeight)),
    };
    if (crop.originX + crop.width > photoWidth) crop.width = photoWidth - crop.originX;
    if (crop.originY + crop.height > photoHeight) crop.height = photoHeight - crop.originY;
    if (crop.width < 8 || crop.height < 8) crop = null;
  }

  const result = await ImageManipulator.manipulateAsync(
    params.uri,
    crop ? [{ crop }] : [],
    {
      compress: params.quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  let base64 = result.base64 ?? '';
  if (!base64 && result.uri) {
    base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: 'base64' });
  }
  if (!base64) return null;
  return { uri: result.uri, base64: `data:image/jpeg;base64,${base64}` };
}

export default function IdAutoCaptureScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const capturingRef = useRef(false);
  const probingRef = useRef(false);
  const finishedRef = useRef(false);
  const idPresentRef = useRef(false);
  const detectStreakRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const lastMagRef = useRef<number | null>(null);
  const previewRef = useRef({ width: 0, height: 0 });
  const guideRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('warmup');
  const [cameraReady, setCameraReady] = useState(false);

  const complete = useCallback(
    (result: Parameters<typeof finishIdCapture>[0]) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      finishIdCapture(result);
      if (router.canGoBack()) {
        router.back();
      }
    },
    [router],
  );

  const close = useCallback(() => {
    complete({ ok: false, cancelled: true });
  }, [complete]);

  const captureNow = useCallback(async () => {
    if (capturingRef.current || !cameraRef.current) {
      return;
    }
    capturingRef.current = true;
    setPhase('capturing');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        shutterSound: false,
      });

      if (!photo?.uri) {
        capturingRef.current = false;
        setPhase(idPresentRef.current ? 'detected' : 'align');
        return;
      }

      setPhase('reading');

      const cropped = await cropToGuide({
        uri: photo.uri,
        photoWidth: photo.width,
        photoHeight: photo.height,
        preview: previewRef.current,
        guide: guideRef.current,
        quality: ID_PHOTO_QUALITY,
      });

      if (!cropped) {
        complete({ ok: false, error: 'Could not process ID photo.' });
        return;
      }

      complete({ ok: true, uri: cropped.uri, base64: cropped.base64 });
    } catch (error) {
      console.error('[IdAutoCapture]', error);
      capturingRef.current = false;
      setPhase(idPresentRef.current ? 'detected' : 'align');
      stableSinceRef.current = null;
    }
  }, [complete]);

  const captureNowRef = useRef(captureNow);
  captureNowRef.current = captureNow;

  const clearDetection = useCallback(() => {
    idPresentRef.current = false;
    detectStreakRef.current = 0;
    stableSinceRef.current = null;
    if (!capturingRef.current) {
      setPhase((prev) => (prev === 'warmup' ? prev : 'align'));
    }
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', () => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        finishIdCapture({ ok: false, cancelled: true });
      }
    });
    return sub;
  }, [navigation]);

  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    const warmupAt = Date.now();
    setPhase('warmup');
    clearDetection();
    lastMagRef.current = null;

    let sensorSub: { remove: () => void } | null = null;
    let cancelled = false;

    const probeForId = async () => {
      if (
        cancelled ||
        capturingRef.current ||
        probingRef.current ||
        !cameraRef.current ||
        finishedRef.current
      ) {
        return;
      }

      const now = Date.now();
      if (now - warmupAt < WARMUP_MS) {
        setPhase('warmup');
        return;
      }

      // Need a laid-out guide before analyzing.
      if (guideRef.current.width < 8 || previewRef.current.width < 8) {
        return;
      }

      probingRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.2,
          shutterSound: false,
          skipProcessing: true,
        });

        if (!photo?.uri || cancelled || capturingRef.current) {
          return;
        }

        const present = await detectIdInGuide({
          uri: photo.uri,
          photoWidth: photo.width,
          photoHeight: photo.height,
          preview: previewRef.current,
          guide: guideRef.current,
        });

        if (cancelled || capturingRef.current) {
          return;
        }

        if (present) {
          detectStreakRef.current += 1;
          if (detectStreakRef.current >= DETECT_STREAK_NEEDED) {
            idPresentRef.current = true;
            if (stableSinceRef.current == null) {
              stableSinceRef.current = Date.now();
              setPhase('detected');
            } else {
              const heldFor = Date.now() - stableSinceRef.current;
              if (heldFor >= STABLE_MS) {
                setPhase('hold');
                void captureNowRef.current();
              } else {
                setPhase('hold');
              }
            }
          } else {
            setPhase('align');
          }
        } else {
          // No ID in frame — never auto-capture.
          clearDetection();
        }
      } catch (error) {
        console.warn('[IdAutoCapture] probe failed', error);
      } finally {
        probingRef.current = false;
      }
    };

    const probeTick = setInterval(() => {
      void probeForId();
    }, PROBE_INTERVAL_MS);

    // First probe shortly after warmup.
    const firstProbe = setTimeout(() => {
      void probeForId();
    }, WARMUP_MS + 150);

    void (async () => {
      if (Platform.OS === 'web') {
        return;
      }
      try {
        const accelerometerModule = require('expo-sensors/build/Accelerometer') as {
          default: {
            isAvailableAsync: () => Promise<boolean>;
            setUpdateInterval: (intervalMs: number) => void;
            addListener: (listener: (data: { x: number; y: number; z: number }) => void) => {
              remove: () => void;
            };
          };
        };
        const Accelerometer = accelerometerModule.default;
        const available = await Accelerometer.isAvailableAsync();
        if (!available) {
          return;
        }
        Accelerometer.setUpdateInterval(80);
        sensorSub = Accelerometer.addListener(({ x, y, z }) => {
          const mag = Math.sqrt(x * x + y * y + z * z);
          const prev = lastMagRef.current;
          lastMagRef.current = mag;
          if (prev == null) {
            return;
          }
          if (Math.abs(mag - prev) / Math.max(mag, 0.5) > 0.08) {
            // Motion resets hold timer, but keeps detection streak if ID still present.
            stableSinceRef.current = idPresentRef.current ? Date.now() : null;
            if (!capturingRef.current && idPresentRef.current) {
              setPhase('detected');
            }
          }
        });
      } catch {
        // Detection probe still gates capture without accelerometer.
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(probeTick);
      clearTimeout(firstProbe);
      sensorSub?.remove();
    };
  }, [cameraReady, clearDetection]);

  const instruction =
    phase === 'reading'
      ? 'Reading ID…'
      : phase === 'capturing'
        ? 'Capturing…'
        : phase === 'hold'
          ? 'ID detected — hold still…'
          : phase === 'detected'
            ? 'ID detected — keep it in the frame…'
            : phase === 'warmup'
              ? 'Starting camera…'
              : 'Place your ID inside the frame to capture.';

  const showBusy =
    phase === 'capturing' || phase === 'reading' || phase === 'hold';
  const canManualCapture =
    cameraReady &&
    !capturingRef.current &&
    phase !== 'capturing' &&
    phase !== 'reading' &&
    phase !== 'warmup';

  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.black, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Allow camera access to automatically capture the visitor ID.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={close}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.black}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View
        style={styles.preview}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          previewRef.current = { width, height };
        }}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
        />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.maskTop} />
          <View style={styles.maskMiddle}>
            <View style={styles.maskSide} />
            <View
              style={styles.guide}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                const previewSize = previewRef.current;
                guideRef.current = {
                  x: Math.max(0, (previewSize.width - width) / 2),
                  y: Math.max(0, (previewSize.height - height) / 2),
                  width,
                  height,
                };
              }}
            >
              <View
                style={[
                  styles.corner,
                  styles.tl,
                  (phase === 'hold' || phase === 'detected') && styles.cornerReady,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.tr,
                  (phase === 'hold' || phase === 'detected') && styles.cornerReady,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.bl,
                  (phase === 'hold' || phase === 'detected') && styles.cornerReady,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.br,
                  (phase === 'hold' || phase === 'detected') && styles.cornerReady,
                ]}
              />
            </View>
            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskBottom} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 10 }]}
        onPress={close}
        disabled={phase === 'capturing' || phase === 'reading'}
      >
        <X size={22} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>

      <View style={[styles.hintWrap, { bottom: insets.bottom + 28 }]}>
        <View style={styles.hintCard}>
          {showBusy && (
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.hintText}>{instruction}</Text>
        </View>

        {canManualCapture ? (
          <TouchableOpacity
            style={styles.manualBtn}
            activeOpacity={0.9}
            onPress={() => void captureNow()}
          >
            <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.manualBtnText}>Capture manually</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  preview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  maskBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  maskMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignSelf: 'stretch',
  },
  guide: {
    width: '92%',
    aspectRatio: 1.586,
    maxHeight: 340,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  },
  cornerReady: {
    borderColor: '#22C55E',
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 12,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 72, 168, 0.92)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    maxWidth: 360,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  manualBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  permTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  permBody: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permBtn: {
    backgroundColor: '#0648A8',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    marginBottom: 16,
  },
  permBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});
