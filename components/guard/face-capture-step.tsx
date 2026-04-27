import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Glasses,
  Lightbulb,
  RefreshCw,
  ScanFace,
} from 'lucide-react-native';

export type FaceCaptureStepScreenProps = {
  badgeIconLetter: string;
  badgeLabel: string;
  onBack: () => void;
  photoPreview: string | null;
  isCapturingPhoto: boolean;
  isCreatingEnrollee: boolean;
  onCaptureFace: () => void;
  onConfirmPhoto: () => void;
  onRetakePhoto: () => void;
};

function HeaderPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 270"
      preserveAspectRatio="none"
    >
      <Path
        d="M-60 175 C42 110, 135 245, 270 158 C348 108, 398 132, 480 68"
        stroke="rgba(142,209,230,0.15)"
        strokeWidth="1.4"
        fill="none"
      />
      <Path
        d="M-55 205 C75 126, 165 268, 300 178 C365 135, 415 148, 475 100"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.4"
        fill="none"
      />
      <Path
        d="M310 72
           C340 68, 362 55, 377 40
           C392 55, 414 68, 444 72
           L444 125
           C444 166, 410 192, 377 206
           C344 192, 310 166, 310 125
           Z"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
        fill="none"
      />
      <Circle cx="377" cy="113" r="24" fill="rgba(255,255,255,0.05)" />
      {Array.from({ length: 32 }).map((_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        return (
          <Circle
            key={index}
            cx={20 + col * 22}
            cy={136 + row * 20}
            r="2.5"
            fill="rgba(255,255,255,0.08)"
          />
        );
      })}
    </Svg>
  );
}

function FaceFrameGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 230" fill="none">
      {Array.from({ length: 8 }).map((_, index) => (
        <Line
          key={`v-${index}`}
          x1={35 + index * 35}
          y1="20"
          x2={35 + index * 35}
          y2="210"
          stroke="rgba(6,72,168,0.06)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 6 }).map((_, index) => (
        <Line
          key={`h-${index}`}
          x1="20"
          y1={35 + index * 32}
          x2="300"
          y2={35 + index * 32}
          stroke="rgba(6,72,168,0.06)"
          strokeWidth="1"
        />
      ))}
      <Circle cx="160" cy="88" r="54" fill="rgba(142,209,230,0.22)" />
      <Path
        d="M72 205C85 163 118 143 160 143C202 143 235 163 248 205H72Z"
        fill="rgba(142,209,230,0.20)"
      />
      <Line
        x1="20"
        y1="118"
        x2="300"
        y2="118"
        stroke="#8ED1E6"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Circle
        cx="160"
        cy="118"
        r="42"
        fill="#FFFFFF"
        stroke="rgba(15,23,42,0.08)"
        strokeWidth="1"
      />
      <Path
        d="M134 103H145L151 96H171L177 103H186C191 103 195 107 195 112V136C195 141 191 145 186 145H134C129 145 125 141 125 136V112C125 107 129 103 134 103Z"
        fill="#0648A8"
      />
      <Circle cx="160" cy="124" r="13" fill="#FFFFFF" />
      <Circle cx="160" cy="124" r="7" fill="#0648A8" />
      <Circle cx="181" cy="113" r="3" fill="#FFFFFF" />
      <Path
        d="M34 54V33C34 26 40 20 47 20H70"
        stroke="#0648A8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Path
        d="M250 20H273C280 20 286 26 286 33V54"
        stroke="#0648A8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Path
        d="M34 176V197C34 204 40 210 47 210H70"
        stroke="#0648A8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Path
        d="M286 176V197C286 204 280 210 273 210H250"
        stroke="#0648A8"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function InstructionItem({
  icon,
  text,
  isLast = false,
}: {
  icon: React.ReactNode;
  text: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.instructionItem, isLast && styles.instructionItemLast]}>
      <View style={styles.bulletDot} />
      <View style={styles.instructionIconCircle}>{icon}</View>
      <Text style={styles.instructionText}>{text}</Text>
    </View>
  );
}

export function FaceCaptureStepScreen({
  badgeIconLetter,
  badgeLabel,
  onBack,
  photoPreview,
  isCapturingPhoto,
  isCreatingEnrollee,
  onCaptureFace,
  onConfirmPhoto,
  onRetakePhoto,
}: FaceCaptureStepScreenProps) {
  const showPreview = Boolean(photoPreview);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <HeaderPattern />

          <View style={styles.headerTop}>
            <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.visitorBadge}>
              <View style={styles.badgeIconBox}>
                <Text style={styles.badgeIconText}>{badgeIconLetter}</Text>
              </View>
              <Text style={styles.visitorBadgeText}>{badgeLabel}</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.stepTitle}>Step 3 of 3</Text>
          <Text style={styles.stepSubtitle}>Face Capture</Text>

          <View style={styles.stepperWrapper}>
            <View style={styles.stepperLine} />
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <Text style={styles.stepCompletedText}>1</Text>
            </View>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <Text style={styles.stepCompletedText}>2</Text>
            </View>
            <View style={[styles.stepCircle, styles.stepCurrent]}>
              <Text style={styles.stepCurrentText}>3</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentPanel}>
          {!showPreview ? (
            <>
              <View style={styles.captureCard}>
                <View style={styles.faceFrame}>
                  <FaceFrameGraphic />
                </View>

                <Text style={styles.captureTitle}>Position visitor in frame</Text>
                <Text style={styles.captureSubtitle}>
                  Ensure good lighting and clear view
                </Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.captureButton}
                  onPress={onCaptureFace}
                  disabled={isCapturingPhoto}
                >
                  <View style={styles.captureIconBox}>
                    {isCapturingPhoto ? (
                      <ActivityIndicator size="small" color="#0648A8" />
                    ) : (
                      <Camera size={24} color="#0648A8" fill="#0648A8" />
                    )}
                  </View>
                  <Text style={styles.captureButtonText}>
                    {isCapturingPhoto ? 'Opening camera…' : 'Capture Face'}
                  </Text>
                  {!isCapturingPhoto ? (
                    <ChevronRight size={22} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <View style={{ width: 22 }} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.instructionsCard}>
                <View style={styles.instructionsHeader}>
                  <View style={styles.instructionsIconCircle}>
                    <ClipboardList size={18} color="#0648A8" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.instructionsTitle}>Instructions</Text>
                </View>

                <View style={styles.divider} />

                <InstructionItem
                  icon={<Glasses size={18} color="#0648A8" strokeWidth={2.2} />}
                  text="Ask visitor to remove glasses if needed"
                />
                <InstructionItem
                  icon={<Lightbulb size={18} color="#0648A8" strokeWidth={2.2} />}
                  text="Ensure face is fully visible and well-lit"
                />
                <InstructionItem
                  icon={<ScanFace size={18} color="#0648A8" strokeWidth={2.2} />}
                  text="Position face within the frame guidelines"
                  isLast
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.captureCard}>
                <View style={styles.faceFrame}>
                  <Image
                    source={{ uri: photoPreview }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>

                <Text style={styles.captureTitle}>Photo preview</Text>
                <Text style={styles.captureSubtitle}>
                  Review the captured face photo, then confirm or retake
                </Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.captureButton, styles.confirmButton]}
                  onPress={onConfirmPhoto}
                  disabled={isCreatingEnrollee}
                >
                  <View style={styles.captureIconBox}>
                    {isCreatingEnrollee ? (
                      <ActivityIndicator size="small" color="#15803D" />
                    ) : (
                      <CheckCircle2 size={22} color="#15803D" strokeWidth={2.4} />
                    )}
                  </View>
                  <Text style={[styles.captureButtonText, styles.confirmButtonText]}>
                    {isCreatingEnrollee ? 'Processing…' : 'Confirm photo'}
                  </Text>
                  {!isCreatingEnrollee ? (
                    <ChevronRight size={22} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <View style={{ width: 22 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.captureButton, styles.retakeButton]}
                  onPress={onRetakePhoto}
                  disabled={isCreatingEnrollee}
                >
                  <View style={[styles.captureIconBox, styles.retakeIconBox]}>
                    <RefreshCw size={20} color="#C2410C" strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.captureButtonText, styles.retakeButtonText]}>
                    Retake photo
                  </Text>
                  <ChevronRight size={22} color="#FFFFFF" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>

              <View style={[styles.instructionsCard, styles.successCard]}>
                <View style={styles.instructionsHeader}>
                  <View style={[styles.instructionsIconCircle, styles.successIconCircle]}>
                    <CheckCircle2 size={18} color="#15803D" strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.instructionsTitle, styles.successTitle]}>Face captured</Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.successBody}>
                  {isCreatingEnrollee
                    ? 'Processing registration…'
                    : 'This photo will be used for visitor verification. Ensure the face is clearly visible and well-lit.'}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0648A8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#0648A8',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 26,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTop: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 88,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 40, 100, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  visitorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD914',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  badgeIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#0648A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeIconText: {
    color: '#FFD914',
    fontSize: 14,
    fontWeight: '900',
  },
  visitorBadgeText: {
    color: '#0648A8',
    fontSize: 14,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 88,
  },
  stepTitle: {
    zIndex: 2,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: -0.35,
  },
  stepSubtitle: {
    zIndex: 2,
    color: '#DCEBFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  stepperWrapper: {
    zIndex: 2,
    width: 168,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  stepperLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(142,209,230,0.65)',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    zIndex: 3,
  },
  stepCompleted: {
    backgroundColor: '#0648A8',
    borderColor: '#2CA6F3',
  },
  stepCurrent: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2CA6F3',
  },
  stepCompletedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stepCurrentText: {
    color: '#0648A8',
    fontSize: 14,
    fontWeight: '800',
  },
  contentPanel: {
    backgroundColor: '#F8FAFC',
    marginTop: -18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
  },
  captureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  faceFrame: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#F7FBFF',
    borderWidth: 1,
    borderColor: '#E1E8F2',
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  captureTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  captureSubtitle: {
    color: '#5B6472',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  captureButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0648A8',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  confirmButton: {
    backgroundColor: '#22C55E',
    marginBottom: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
  },
  retakeButton: {
    backgroundColor: '#F97316',
    marginBottom: 0,
  },
  retakeButtonText: {
    color: '#FFFFFF',
  },
  retakeIconBox: {
    backgroundColor: '#FFEDD5',
  },
  captureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  captureButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successIconCircle: {
    backgroundColor: '#DCFCE7',
  },
  successTitle: {
    color: '#15803D',
  },
  successBody: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionsIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  instructionsTitle: {
    color: '#0648A8',
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5EAF2',
    marginVertical: 10,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  instructionItemLast: {
    paddingBottom: 2,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0648A8',
    marginRight: 10,
  },
  instructionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  instructionText: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
