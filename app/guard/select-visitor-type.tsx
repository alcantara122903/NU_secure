import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type VisitorType = 'enrollee' | 'contractor' | 'normal_visitor';

type VisitorOption = {
  id: VisitorType;
  title: string;
  description: string;
  routeValue: 'enrollee' | 'contractor' | 'normal';
};

const visitorOptions: VisitorOption[] = [
  {
    id: 'enrollee',
    title: 'Enrollee',
    description: 'New student or staff members enrolling in the institution',
    routeValue: 'enrollee',
  },
  {
    id: 'contractor',
    title: 'Contractor',
    description: 'Service provider, maintenance workers, or external vendors',
    routeValue: 'contractor',
  },
  {
    id: 'normal_visitor',
    title: 'Normal Visitor',
    description: 'General visitor, guest or anyone with a scheduled appointment',
    routeValue: 'normal',
  },
];

type IconProps = {
  size?: number;
  color?: string;
  backgroundColor?: string;
};

function EnrolleeIcon({
  size = 56,
  color = '#0648A8',
  backgroundColor = '#FFD914',
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 82 82" fill="none">
      <Rect width="82" height="82" rx="18" fill={backgroundColor} />

      <Path
        d="M41 22L17 34L41 46L65 34L41 22Z"
        fill={color}
      />

      <Path
        d="M27 41V50C27 52 33 57 41 57C49 57 55 52 55 50V41L41 48L27 41Z"
        fill={color}
      />

      <Path
        d="M61 36V51"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Circle cx="61" cy="57" r="4" fill={color} />
    </Svg>
  );
}

function ContractorIcon({
  size = 56,
  color = '#0648A8',
  backgroundColor = '#FFD914',
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 82 82" fill="none">
      <Rect width="82" height="82" rx="18" fill={backgroundColor} />

      <Path
        d="M29.2 21.5C35.1 20.3 41.4 22.2 45.9 26.7L36.8 35.8L46.2 45.2L55.3 36.1C59.8 40.6 61.7 46.9 60.5 52.8L37.2 29.5C34.5 32.2 30.2 32.2 27.5 29.5C25.3 27.3 24.8 24 26 21.3C26.9 21.4 28.1 21.7 29.2 21.5Z"
        fill={color}
        transform="rotate(45 41 41)"
      />

      <Path
        d="M31 36L57 62C59 64 59 67 57 69C55 71 52 71 50 69L24 43L31 36Z"
        fill={color}
        transform="rotate(-45 41 41)"
      />
    </Svg>
  );
}

function NormalVisitorIcon({
  size = 56,
  color = '#0648A8',
  backgroundColor = '#FFD914',
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 82 82" fill="none">
      <Rect width="82" height="82" rx="18" fill={backgroundColor} />

      <Circle cx="41" cy="31" r="11" fill={color} />

      <Path
        d="M22 62C22 51.5 30.5 45 41 45C51.5 45 60 51.5 60 62H22Z"
        fill={color}
      />
    </Svg>
  );
}

export default function SelectVisitorTypeScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleSelectVisitorType = (type: VisitorOption['routeValue']) => {
    router.push({
      pathname: '/guard/register-visitor',
      params: { visitorType: type },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0648A8" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <HeaderPattern />

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backButton}
            onPress={handleBack}
          >
            <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.8} />
          </TouchableOpacity>

          <View style={styles.headerTextWrapper}>
            <Text style={styles.headerTitle}>Select Visitor Type</Text>
            <Text style={styles.headerSubtitle}>
              Choose the type of visitor to register
            </Text>
          </View>
        </View>

        <View style={styles.contentPanel}>
          {visitorOptions.map((option) => (
            <VisitorTypeCard
              key={option.id}
              title={option.title}
              description={option.description}
              icon={
                option.id === 'enrollee' ? (
                  <EnrolleeIcon />
                ) : option.id === 'contractor' ? (
                  <ContractorIcon />
                ) : (
                  <NormalVisitorIcon />
                )
              }
              onPress={() => handleSelectVisitorType(option.routeValue)}
            />
          ))}

          <View style={styles.infoCard}>
            <View style={styles.infoAccent} />

            <View style={styles.infoHeader}>
              <View style={styles.infoIconCircle}>
                <Info size={20} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.infoTitle}>Registration Process</Text>
            </View>

            <Text style={styles.infoBody}>
              After selecting the visitor type, you will proceed to face
              recognition, ID scanning, and completing the visitor details form.
              A QR ticket will be generated upon completion.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 260"
      preserveAspectRatio="none"
    >
      <Circle cx="42" cy="42" r="7" fill="rgba(255,255,255,0.06)" />
      <Circle cx="75" cy="55" r="12" fill="rgba(255,255,255,0.045)" />
      <Circle cx="112" cy="42" r="8" fill="rgba(255,255,255,0.045)" />
      <Circle cx="52" cy="95" r="18" fill="rgba(255,255,255,0.035)" />
      <Circle cx="96" cy="100" r="13" fill="rgba(255,255,255,0.04)" />
      <Circle cx="135" cy="85" r="7" fill="rgba(255,255,255,0.045)" />
      <Circle cx="170" cy="42" r="5" fill="rgba(255,255,255,0.04)" />

      <Path
        d="M-40 195 C50 140, 145 260, 270 175 C345 122, 395 135, 470 85"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1.5"
        fill="none"
      />

      <Path
        d="M388 66
           C422 62, 448 48, 466 30
           C484 48, 510 62, 544 66
           L544 134
           C544 186, 505 218, 466 234
           C427 218, 388 186, 388 134
           Z"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
        fill="none"
      />

      <Path
        d="M390 -24 L566 -24 L494 292 L320 292 Z"
        fill="rgba(255,255,255,0.03)"
      />
    </Svg>
  );
}

function VisitorTypeCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.typeCard}
      onPress={onPress}
    >
      <View style={styles.typeIconBox}>{icon}</View>

      <View style={styles.typeTextWrapper}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeDescription}>{description}</Text>
      </View>

      <View style={styles.arrowCircle}>
        <ArrowRight size={24} color="#FFFFFF" strokeWidth={2.8} />
      </View>
    </TouchableOpacity>
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
    paddingBottom: 30,
  },

  header: {
    backgroundColor: '#0648A8',
    minHeight: 202,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 22,
    position: 'relative',
    overflow: 'hidden',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 14,
    zIndex: 2,
  },

  headerTextWrapper: {
    zIndex: 2,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },

  headerSubtitle: {
    color: '#DCEBFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 20,
  },

  contentPanel: {
    backgroundColor: '#F8FAFC',
    marginTop: -10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 24,
  },

  typeCard: {
    backgroundColor: '#0648A8',
    borderRadius: 18,
    minHeight: 114,
    paddingHorizontal: 14,
    paddingRight: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  typeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFD914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  typeTextWrapper: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
  },

  typeTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 4,
  },

  typeDescription: {
    color: '#EAF2FF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 6,
    flexShrink: 0,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  infoAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#8ED1E6',
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  infoIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0648A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  infoTitle: {
    color: '#0648A8',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  infoBody: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
  },
});
