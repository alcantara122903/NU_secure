import {
  loadGuardAlertsDashboard,
  type ReadyToExitVisitor,
  type UnresolvedWrongDestinationAlert,
} from '@/services/guard-alerts-dashboard';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PAGE_SIZE = 5;
const BLUE = '#064AA5';
const RED = '#DC2626';
const GREEN = '#16A34A';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6B7280';

type AlertRow = {
  id: number;
  name: string;
  office: string;
  controlNumber: string;
  raisedAt: string;
  detailMessage: string;
};

type CompletedRow = {
  id: number;
  name: string;
  purpose: string;
  controlNumber: string;
  completedAt: string;
};

export default function MonitorVisitorActivitiesScreen() {
  const router = useRouter();

  const [wrongDestinationVisitCount, setWrongDestinationVisitCount] = useState(0);
  const [readyToExitCount, setReadyToExitCount] = useState(0);
  const [completedVisitors, setCompletedVisitors] = useState<ReadyToExitVisitor[]>([]);
  const [unresolvedAlerts, setUnresolvedAlerts] = useState<UnresolvedWrongDestinationAlert[]>([]);
  const [expandedAlertId, setExpandedAlertId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertsPage, setAlertsPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const { wrongDestinationVisitCount, readyToExitVisitors, unresolvedWrongDestinationAlerts } =
        await loadGuardAlertsDashboard();
      setWrongDestinationVisitCount(wrongDestinationVisitCount);
      setCompletedVisitors(readyToExitVisitors);
      setReadyToExitCount(readyToExitVisitors.length);
      setUnresolvedAlerts(unresolvedWrongDestinationAlerts);
      setExpandedAlertId((current) =>
        unresolvedWrongDestinationAlerts.some((a) => a.alertId === current) ? current : null,
      );
      setAlertsPage(1);
      setCompletedPage(1);
    } catch (error) {
      console.error('MonitorVisitorActivitiesScreen loadData', error);
      setWrongDestinationVisitCount(0);
      setCompletedVisitors([]);
      setReadyToExitCount(0);
      setUnresolvedAlerts([]);
      setExpandedAlertId(null);
      setAlertsPage(1);
      setCompletedPage(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const alertRows = useMemo<AlertRow[]>(
    () =>
      unresolvedAlerts.map((item) => ({
        id: item.alertId,
        name: item.visitorName || 'Visitor',
        office: item.scannedOfficeName || 'Unknown office',
        controlNumber: item.controlNumber || item.passNumber || '—',
        raisedAt: item.createdAtLabel || '—',
        detailMessage: item.message || 'Wrong destination alert',
      })),
    [unresolvedAlerts],
  );

  const completedRows = useMemo<CompletedRow[]>(
    () =>
      completedVisitors.map((item) => {
        const detailParts = (item.detailLine || '').split(' • ');
        return {
          id: item.visitId,
          name: item.name || 'Visitor',
          purpose: detailParts[0] || 'Visit',
          controlNumber: detailParts[1] || '—',
          completedAt: item.completedAtLabel || '—',
        };
      }),
    [completedVisitors],
  );

  const alertPageCount = Math.max(1, Math.ceil(alertRows.length / PAGE_SIZE));
  const completedPageCount = Math.max(1, Math.ceil(completedRows.length / PAGE_SIZE));

  const pagedAlerts = useMemo(() => {
    const start = (alertsPage - 1) * PAGE_SIZE;
    return alertRows.slice(start, start + PAGE_SIZE);
  }, [alertRows, alertsPage]);

  const pagedCompleted = useMemo(() => {
    const start = (completedPage - 1) * PAGE_SIZE;
    return completedRows.slice(start, start + PAGE_SIZE);
  }, [completedRows, completedPage]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backCircle} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitor visitor activities and alerts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.redIconCircle}>
                <Ionicons name="warning-outline" size={28} color={RED} />
              </View>
              <Text style={styles.summaryTitle}>Wrong destination</Text>
            </View>
            <Text style={styles.redNumber}>{loading ? '—' : wrongDestinationVisitCount}</Text>
            <Text style={styles.summaryDescription}>Unresolved wrong-office scans</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.greenIconCircle}>
                <Ionicons name="checkmark" size={28} color={GREEN} />
              </View>
              <Text style={styles.summaryTitle}>Completed</Text>
            </View>
            <Text style={styles.greenNumber}>{loading ? '—' : readyToExitCount}</Text>
            <Text style={styles.summaryDescription}>Ready to exit</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconRed}>
            <Ionicons name="alert-circle-outline" size={22} color={RED} />
          </View>
          <View style={styles.sectionTextBox}>
            <Text style={styles.sectionTitle}>All Alerts (Unresolved)</Text>
            <Text style={styles.sectionSubtitle}>Every unresolved wrong-destination scan for active visits</Text>
          </View>
        </View>

        {!loading && alertRows.length === 0 ? (
          <Text style={styles.emptyText}>No unresolved wrong-destination alerts right now.</Text>
        ) : (
          pagedAlerts.map((item) => (
            <AlertCard
              key={item.id}
              item={item}
              expanded={expandedAlertId === item.id}
              onToggle={() => setExpandedAlertId((current) => (current === item.id ? null : item.id))}
            />
          ))
        )}

        {alertRows.length > 0 ? (
          <PaginationRow
            page={alertsPage}
            pageCount={alertPageCount}
            onPrev={() => setAlertsPage((p) => Math.max(1, p - 1))}
            onNext={() => setAlertsPage((p) => Math.min(alertPageCount, p + 1))}
          />
        ) : null}

        <View style={styles.sectionHeaderCompleted}>
          <View style={styles.sectionIconGreen}>
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.sectionTextBox}>
            <Text style={styles.sectionTitle}>Completed Visitors</Text>
            <Text style={styles.sectionSubtitle}>
              Visitors who have completed their business and are ready to exit
            </Text>
          </View>
        </View>

        {!loading && completedRows.length === 0 ? (
          <Text style={styles.emptyText}>
            No visitors are ready to exit yet. They appear here after every office on their route has checked them in.
          </Text>
        ) : (
          pagedCompleted.map((item) => <CompletedVisitorCard key={item.id} item={item} onReadyToExit={() => router.push('/guard/exit-scan')} />)
        )}

        {completedRows.length > 0 ? (
          <PaginationRow
            page={completedPage}
            pageCount={completedPageCount}
            onPrev={() => setCompletedPage((p) => Math.max(1, p - 1))}
            onNext={() => setCompletedPage((p) => Math.min(completedPageCount, p + 1))}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertCard({
  item,
  expanded,
  onToggle,
}: {
  item: AlertRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertAccent} />
      <View style={styles.alertIconBox}>
        <Ionicons name="warning-outline" size={30} color={RED} />
      </View>
      <View style={styles.cardMainText}>
        <Text style={styles.visitorName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.cardSubText} numberOfLines={2}>
          {item.office} • {item.controlNumber}
        </Text>
        <Text style={styles.cardDateText}>Raised at {item.raisedAt}</Text>
        {expanded ? <Text style={styles.cardDetailText}>{item.detailMessage}</Text> : null}
      </View>
      <TouchableOpacity style={styles.detailsButton} activeOpacity={0.85} onPress={onToggle}>
        <Text style={styles.detailsButtonText}>{expanded ? 'Hide Details' : 'View Details'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CompletedVisitorCard({ item, onReadyToExit }: { item: CompletedRow; onReadyToExit: () => void }) {
  return (
    <View style={styles.completedCard}>
      <View style={styles.completedAccent} />
      <View style={styles.completedIconBox}>
        <Ionicons name="person" size={28} color={BLUE} />
      </View>
      <View style={styles.cardMainText}>
        <Text style={styles.visitorName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.cardSubText} numberOfLines={2}>
          {item.purpose} • {item.controlNumber}
        </Text>
        <Text style={styles.cardDateText}>Route completed at {item.completedAt}</Text>
      </View>
      <TouchableOpacity style={styles.readyButton} activeOpacity={0.85} onPress={onReadyToExit}>
        <Text style={styles.readyButtonText}>Ready to Exit</Text>
      </TouchableOpacity>
    </View>
  );
}

function PaginationRow({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.paginationRow}>
      <TouchableOpacity
        style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
        activeOpacity={0.85}
        onPress={onPrev}
        disabled={page === 1}
      >
        <Text style={[styles.pageButtonText, page === 1 && styles.pageButtonTextDisabled]}>Previous</Text>
      </TouchableOpacity>

      <Text style={styles.pageIndicator}>
        Page {page} of {pageCount}
      </Text>

      <TouchableOpacity
        style={[styles.pageButton, page === pageCount && styles.pageButtonDisabled]}
        activeOpacity={0.85}
        onPress={onNext}
        disabled={page === pageCount}
      >
        <Text style={[styles.pageButtonText, page === pageCount && styles.pageButtonTextDisabled]}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    minHeight: 118,
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingTop: 32,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    minHeight: 120,
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E6ECF5',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  redIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  greenIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  summaryTitle: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  redNumber: {
    color: RED,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 6,
  },
  greenNumber: {
    color: GREEN,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 6,
  },
  summaryDescription: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderCompleted: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionIconRed: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  sectionIconGreen: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionTextBox: {
    flex: 1,
  },
  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  sectionSubtitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 3,
  },
  alertCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 90,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    overflow: 'hidden',
  },
  alertAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: RED,
  },
  alertIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  completedCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 88,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0B2E5E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    overflow: 'hidden',
  },
  completedAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: GREEN,
  },
  completedIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardMainText: {
    flex: 1,
    paddingRight: 6,
  },
  visitorName: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  cardSubText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  cardDateText: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 3,
  },
  cardDetailText: {
    color: TEXT_DARK,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 4,
  },
  detailsButton: {
    backgroundColor: RED,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  readyButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 82,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  paginationRow: {
    marginHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pageButtonDisabled: {
    backgroundColor: '#C9D3E6',
  },
  pageButtonText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  pageButtonTextDisabled: {
    color: '#6B7280',
  },
  pageIndicator: {
    color: TEXT_DARK,
    fontSize: 10.5,
    fontWeight: '700',
  },
});
