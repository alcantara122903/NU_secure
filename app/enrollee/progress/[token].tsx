/**
 * Public enrollee visit tracker — mimics NU Lipa Enrollee Visit Tracker design.
 * Route: /enrollee/progress/[token]
 * QR tickets encode: https://www.nu-secure.com/enrollee/progress/QR-...
 */

import { extractQrTokenFromAnyScan } from '@/lib/enrollee-progress-url';
import {
  loadEnrolleeProgressByQrToken,
  type EnrolleeProgressTrackerData,
  type EnrolleeRouteStep,
} from '@/services/enrollee-progress-tracker';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#1e3a8a';
const BLUE_SOFT = '#dbeafe';
const GREEN = '#10b981';
const GREEN_SOFT = '#ecfdf5';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BG = '#eff6ff';

export default function EnrolleeProgressScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawParam = Array.isArray(params.token) ? params.token[0] : params.token;
  const token =
    extractQrTokenFromAnyScan(rawParam || '') ||
    (rawParam || '').trim();

  const [data, setData] = useState<EnrolleeProgressTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing QR token.');
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const next = await loadEnrolleeProgressByQrToken(token);
      if (!next) {
        setError('Visit not found for this QR pass.');
        setData(null);
      } else {
        setError(null);
        setData(next);
      }
    } catch (e) {
      console.warn('[EnrolleeProgressScreen]', e);
      setError('Could not load progress.');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => {
      void load();
    }, 15000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  // Hard guarantee: never render 1,1,2,2… even if API returns duplicates.
  const routeSteps = useMemo(() => {
    const seen = new Set<number>();
    const out: EnrolleeRouteStep[] = [];
    for (const step of data?.steps ?? []) {
      const order = Number(step.stepOrder) || 0;
      if (order <= 0 || seen.has(order)) continue;
      seen.add(order);
      out.push(step);
    }
    return out;
  }, [data?.steps]);

  const currentStep = routeSteps.find((s) => s.status === 'current');
  const completedCount = routeSteps.filter((s) => s.status === 'done').length;
  const totalCount = routeSteps.length;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const percentComplete =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const isFullyComplete = totalCount > 0 && remainingCount === 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.muted}>Loading enrollee progress…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>QR Pass not found</Text>
          <Text style={styles.muted}>{error || 'Try scanning again.'}</Text>
          <Text style={styles.tokenHint}>{token || '—'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>NU</Text>
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.appTitle}>NU Lipa Enrollee Visit Tracker</Text>
            <Text style={styles.appSubtitle}>QR browser view for enrollee progress monitoring.</Text>
            <Text style={styles.visitorChip}>👤  {data.visitorName}</Text>
          </View>
          <View style={styles.passBadge}>
            <View style={styles.passDot} />
            <Text style={styles.passBadgeText}>QR Pass Active: {data.passNumber}</Text>
          </View>
        </View>

        <View style={styles.topCards}>
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Enrollment Route</Text>
            <Text style={styles.cardHeading}>Track each office step in order.</Text>
            <Text style={styles.cardBody}>
              Your enrollment visit updates automatically when office staff scans your QR pass. Follow
              the route below and proceed only to your current office.
            </Text>
            <Text style={styles.progressLabel}>
              Overall progress{' '}
              <Text style={styles.progressStrong}>
                {completedCount} of {totalCount} completed
              </Text>
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, percentComplete))}%` }]} />
            </View>
            <View style={styles.metricsRow}>
              <Metric value={`${percentComplete}%`} label="Completion" />
              <Metric
                value={isFullyComplete ? 'Done' : currentStep?.officeName || '—'}
                label="Current office"
              />
              <Metric value={String(remainingCount)} label="Remaining steps" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Current Step</Text>
            {isFullyComplete ? (
              <>
                <View style={styles.doneCircle}>
                  <Text style={styles.doneCheck}>✓</Text>
                </View>
                <Text style={styles.cardHeading}>Enrollment route completed</Text>
                <Text style={styles.cardBody}>
                  All office steps are done. You may keep this page for reference or exit the campus
                  when finished.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.currentCircle}>
                  <Text style={styles.currentNum}>
                    {currentStep?.stepOrder ?? '•'}
                  </Text>
                </View>
                <Text style={styles.cardHeading}>
                  {currentStep?.officeName || 'Waiting for next office'}
                </Text>
                <Text style={styles.cardBody}>
                  Proceed to {currentStep?.officeName || 'your current office'} and present your QR
                  pass for validation.
                </Text>
              </>
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Keep this page open or screenshot your QR pass. Progress refreshes when an office
                validates your visit.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Office Scan QR</Text>
            <Text style={styles.qrName}>{data.visitorName}</Text>
            <View style={styles.qrWrap}>
              <QRCode value={data.progressUrl} size={Platform.OS === 'web' ? 180 : 160} />
            </View>
            <Text style={styles.passLine}>Pass: {data.passNumber}</Text>
            <Text style={styles.cardBody}>
              One QR for all offices. Staff scan this from their office portal — the system detects
              which office scanned.
            </Text>
          </View>
        </View>

        <View style={styles.routeSection}>
          <Text style={styles.routeTitle}>Visit Route in Order</Text>
          <Text style={styles.cardBody}>
            Complete each office step as staff scan and validate your QR.
          </Text>
          <View style={styles.legendRow}>
            <Legend color={GREEN} label="Done" />
            <Legend color={ORANGE} label="Current" />
            <Legend color="#9ca3af" label="Pending" />
          </View>

          {routeSteps.map((step) => (
            <RouteRow key={`step-order-${step.stepOrder}`} step={step} />
          ))}
          {totalCount < 9 ? (
            <Text style={styles.missingStepsHint}>
              Expected 9 enrolment steps. This pass currently has {totalCount}. Ask admin to sync
              Step 9 in enrollee_progress.
            </Text>
          ) : null}
        </View>

        <View style={styles.footerBanner}>
          <Text style={styles.footerText}>
            This page is for enrollee viewing. Office staff should scan the QR code from their
            assigned office portal to validate and record the step.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function RouteRow({ step }: { step: EnrolleeRouteStep }) {
  const isDone = step.status === 'done';
  const isCurrent = step.status === 'current';
  return (
    <View
      style={[
        styles.routeRow,
        isDone && styles.routeRowDone,
        isCurrent && styles.routeRowCurrent,
      ]}
    >
      <View
        style={[
          styles.routeNum,
          isDone && styles.routeNumDone,
          isCurrent && styles.routeNumCurrent,
        ]}
      >
        <Text style={[styles.routeNumText, (isDone || isCurrent) && styles.routeNumTextOn]}>
          {isDone ? '✓' : step.stepOrder}
        </Text>
      </View>
      <View style={styles.routeBody}>
        <Text style={styles.routeOffice}>{step.officeName}</Text>
        <Text style={styles.routeHint}>
          {step.stepName &&
          step.stepName.trim().toLowerCase() !== step.officeName.trim().toLowerCase()
            ? step.stepName
            : `Proceed to ${step.officeName} and present your QR pass for validation.`}
        </Text>
      </View>
      <View
        style={[
          styles.statusPill,
          isDone && styles.statusPillDone,
          isCurrent && styles.statusPillCurrent,
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            isDone && styles.statusPillTextDone,
            isCurrent && styles.statusPillTextCurrent,
          ]}
        >
          {isDone ? 'Done' : isCurrent ? 'Current' : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  muted: { color: GRAY, textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: BLUE },
  tokenHint: { marginTop: 8, fontSize: 12, color: '#9ca3af', textAlign: 'center' },

  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerTextCol: { flex: 1, minWidth: 180 },
  appTitle: { fontSize: 20, fontWeight: '800', color: BLUE },
  appSubtitle: { fontSize: 13, color: GRAY, marginTop: 2 },
  visitorChip: { marginTop: 8, fontSize: 14, color: '#111827', fontWeight: '600' },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BLUE_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  passDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  passBadgeText: { color: BLUE, fontWeight: '700', fontSize: 12 },

  topCards: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardEyebrow: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  cardHeading: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  cardBody: { fontSize: 14, color: GRAY, lineHeight: 20 },
  progressLabel: { marginTop: 14, fontSize: 13, color: '#334155' },
  progressStrong: { fontWeight: '800', color: BLUE },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 999 },
  metricsRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  metric: { flex: 1 },
  metricValue: { fontSize: 16, fontWeight: '800', color: BLUE },
  metricLabel: { fontSize: 11, color: GRAY, marginTop: 2 },

  doneCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  doneCheck: { color: '#fff', fontSize: 28, fontWeight: '800' },
  currentCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  currentNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  infoBox: {
    marginTop: 12,
    backgroundColor: BLUE_SOFT,
    borderRadius: 10,
    padding: 12,
  },
  infoBoxText: { fontSize: 13, color: BLUE, lineHeight: 18 },

  qrName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  passLine: { textAlign: 'center', fontWeight: '700', color: BLUE, marginBottom: 8 },

  routeSection: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  routeTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  missingStepsHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
  },
  legendRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: GRAY, fontWeight: '600' },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeRowDone: { backgroundColor: GREEN_SOFT, borderColor: '#a7f3d0' },
  routeRowCurrent: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  routeNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeNumDone: { backgroundColor: GREEN },
  routeNumCurrent: { backgroundColor: ORANGE },
  routeNumText: { fontWeight: '800', color: '#334155' },
  routeNumTextOn: { color: '#fff' },
  routeBody: { flex: 1 },
  routeOffice: { fontWeight: '800', color: BLUE, fontSize: 14 },
  routeHint: { fontSize: 12, color: GRAY, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  statusPillDone: { backgroundColor: '#d1fae5' },
  statusPillCurrent: { backgroundColor: '#ffedd5' },
  statusPillText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  statusPillTextDone: { color: '#047857' },
  statusPillTextCurrent: { color: '#c2410c' },

  footerBanner: {
    marginTop: 16,
    backgroundColor: BLUE,
    borderRadius: 12,
    padding: 14,
  },
  footerText: { color: '#fff', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
