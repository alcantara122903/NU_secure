import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [guardName, setGuardName] = useState('Guard');
  const [activeVisitors, setActiveVisitors] = useState<number | null>(null);
  const [activeAlerts] = useState(1);
  const [currentTime, setCurrentTime] = useState('');
  const [insidePage, setInsidePage] = useState(1);
  const [insideTypeFilter, setInsideTypeFilter] = useState<'all' | 'enrollee' | 'contractor' | 'normal'>('all');
  const [insideVisitors, setInsideVisitors] = useState<
    Array<{
      id: number;
      name: string;
      detail: string;
      timeLabel: string;
      type: 'enrollee' | 'contractor' | 'normal';
      typeLabel: string;
      status: 'Arrived';
    }>
  >([]);
  const [isLoadingInside, setIsLoadingInside] = useState(true);
  const INSIDE_PAGE_SIZE = 5;

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setCurrentTime(time);
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const name = authSessionService.getCurrentUserFirstLastName();
    if (name) {
      setGuardName(name);
    }
  }, []);

  const loadCurrentlyInside = useCallback(async () => {
    try {
      const { data: openVisits, error: visitErr } = await supabase
        .from('visit')
        .select('visit_id, visitor_id, visit_type_id, entry_time, purpose_reason, destination_text, primary_office_id')
        .is('exit_time', null)
        .order('entry_time', { ascending: false });

      if (visitErr) {
        console.error('Dashboard currently-inside visits:', visitErr);
        setInsideVisitors([]);
        setActiveVisitors(0);
        return;
      }

      const visits = openVisits ?? [];
      setActiveVisitors(visits.length);
      setInsidePage(1);

      if (visits.length === 0) {
        setInsideVisitors([]);
        return;
      }

      const visitorIds = [
        ...new Set(visits.map((v) => Number(v.visitor_id)).filter((id) => Number.isFinite(id))),
      ];

      const officeIds = [
        ...new Set(
          visits
            .map((v) => (v.primary_office_id != null ? Number(v.primary_office_id) : null))
            .filter((id): id is number => id != null && Number.isFinite(id)),
        ),
      ];

      const [{ data: visitorRows }, { data: officeRows }] = await Promise.all([
        visitorIds.length > 0
          ? supabase
              .from('visitor')
              .select('visitor_id, first_name, last_name, pass_number, control_number')
              .in('visitor_id', visitorIds)
          : Promise.resolve({ data: [] as any[] }),
        officeIds.length > 0
          ? supabase.from('office').select('office_id, office_name').in('office_id', officeIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const visitorMap = new Map(
        (visitorRows ?? []).map((v) => [
          Number(v.visitor_id),
          {
            firstName: String(v.first_name ?? '').trim(),
            lastName: String(v.last_name ?? '').trim(),
            pass: String(v.pass_number ?? '').trim(),
            control: String(v.control_number ?? '').trim(),
          },
        ]),
      );

      const officeMap = new Map(
        (officeRows ?? []).map((o) => [Number(o.office_id), String(o.office_name ?? '').trim()]),
      );

      const formatted = visits.map((v) => {
        const visitor = visitorMap.get(Number(v.visitor_id));
        const name =
          [visitor?.firstName ?? '', visitor?.lastName ?? ''].filter(Boolean).join(' ').trim() || 'Visitor';

        const purpose = String(v.purpose_reason ?? '').trim();
        const destinationText = String(v.destination_text ?? '').trim();
        const officeName =
          v.primary_office_id != null ? officeMap.get(Number(v.primary_office_id)) || '' : '';
        const tag = visitor?.control || visitor?.pass || '';
        const primaryDetail = purpose || destinationText || officeName || 'Inside campus';
        const detail = tag ? `${primaryDetail} • ${tag}` : primaryDetail;

        const entry = v.entry_time ? new Date(v.entry_time) : null;
        const timeLabel =
          entry && !Number.isNaN(entry.getTime())
            ? entry.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : '—';

        const visitTypeId = Number(v.visit_type_id);
        const type: 'enrollee' | 'contractor' | 'normal' =
          visitTypeId === 1 ? 'enrollee' : visitTypeId === 2 ? 'contractor' : 'normal';
        const typeLabel = type === 'enrollee' ? 'Enrollee' : type === 'contractor' ? 'Contractor' : 'Visitor';

        return {
          id: Number(v.visit_id),
          name,
          detail,
          timeLabel,
          type,
          typeLabel,
          status: 'Arrived' as const,
        };
      });

      setInsideVisitors(formatted);
    } finally {
      setIsLoadingInside(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoadingInside(true);
      void loadCurrentlyInside();
    }, [loadCurrentlyInside]),
  );

  const handleLogout = () => {
    try {
      authSessionService.clearSession();
      console.log('✅ Session cleared successfully');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('❌ Error clearing session:', error);
      router.replace('/(tabs)');
    }
  };

  const filteredInsideVisitors =
    insideTypeFilter === 'all'
      ? insideVisitors
      : insideVisitors.filter((v) => v.type === insideTypeFilter);

  const totalInsidePages = Math.max(1, Math.ceil(filteredInsideVisitors.length / INSIDE_PAGE_SIZE));
  const safeInsidePage = Math.min(Math.max(insidePage, 1), totalInsidePages);
  const insideStart = (safeInsidePage - 1) * INSIDE_PAGE_SIZE;
  const pagedInsideVisitors = filteredInsideVisitors.slice(insideStart, insideStart + INSIDE_PAGE_SIZE);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerIdentity}>
          <Text style={styles.headerTitle}>Guard Portal</Text>
          <Text style={styles.headerSubtitle}>{guardName}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.logoutButtonContainer, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={18} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Overview */}
        <View style={styles.statsRow}>
          {/* Active Visitors */}
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
            <MaterialIcons name="people" size={28} color={colors.primary} style={{marginBottom: 8}} />
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {activeVisitors === null ? '—' : activeVisitors}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Active Visitors
            </Text>
          </View>

          {/* Current Time */}
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderLeftColor: colors.accent, borderLeftWidth: 4 }]}>
            <MaterialIcons name="schedule" size={28} color={colors.accent} style={{marginBottom: 8}} />
            <Text style={[styles.statNumber, { color: colors.accent }]}>{currentTime}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Current Time
            </Text>
          </View>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsContainer}>
          {/* Register New Visitor */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/guard/select-visitor-type')}
            activeOpacity={0.8}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.14)' }]}>
                <MaterialIcons name="person-add" size={30} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Register Visitor</Text>
                <Text style={styles.actionSubtitle}>New entry</Text>
              </View>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Exit Scan */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            onPress={() => router.push('/guard/exit-scan')}
            activeOpacity={0.8}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                <MaterialIcons name="exit-to-app" size={30} color={colors.text} />
              </View>
              <View>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Exit Scan</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Process exit</Text>
              </View>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Active Alerts Card */}
        <TouchableOpacity
          style={[styles.alertsCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/guard/alerts')}
          activeOpacity={0.8}
        >
          <View style={styles.alertsLeft}>
            <View style={styles.alertsBadge}>
              <MaterialIcons name="notifications" size={24} color="#003D99" />
            </View>
            <View>
              <Text style={styles.alertsTitle}>Active Alerts</Text>
              <Text style={styles.alertsSubtitle}>{activeAlerts} ready to exit</Text>
            </View>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Active Visitors Section */}
        <View style={styles.visitorsSection}>
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Currently Inside</Text>
            {!isLoadingInside ? (
              <View style={[styles.sectionCountPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                  {filteredInsideVisitors.length}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.filterRow}>
            {[
              { key: 'all', label: 'All' },
              { key: 'enrollee', label: 'Enrollee' },
              { key: 'contractor', label: 'Contractor' },
              { key: 'normal', label: 'Visitor' },
            ].map((option) => {
              const selected = insideTypeFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setInsideTypeFilter(option.key as 'all' | 'enrollee' | 'contractor' | 'normal');
                    setInsidePage(1);
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoadingInside ? (
            <View style={[styles.loadingRow, { backgroundColor: colors.surface }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading visitors…</Text>
            </View>
          ) : null}

          {!isLoadingInside && filteredInsideVisitors.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No active visitors</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                No visitors match this type right now.
              </Text>
            </View>
          ) : null}

          {pagedInsideVisitors.map((visitor) => (
            <View
              key={visitor.id}
              style={[styles.visitorCard, { backgroundColor: colors.surface, borderLeftColor: colors.primary, borderLeftWidth: 3 }]}
            >
              <View style={styles.visitorLeft}>
                <View style={[styles.visitorIconWrap, { backgroundColor: colors.background }]}>
                  <MaterialIcons name="person" size={26} color={colors.primary} />
                </View>
                <View style={styles.visitorTextWrap}>
                  <Text style={[styles.visitorName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {visitor.name}
                  </Text>
                  <Text style={[styles.visitorTypeText, { color: colors.primary }]} numberOfLines={1}>
                    {visitor.typeLabel}
                  </Text>
                  <Text style={[styles.visitorInfo, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    {visitor.detail}
                  </Text>
                  <Text style={[styles.visitorTime, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    Entered at {visitor.timeLabel}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.statusText, { color: colors.text }]}>{visitor.status}</Text> 
              </View>
            </View>
          ))}

          {!isLoadingInside && filteredInsideVisitors.length > INSIDE_PAGE_SIZE ? (
            <View style={[styles.paginationRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  {
                    backgroundColor: safeInsidePage === 1 ? colors.border : colors.primary,
                  },
                ]}
                disabled={safeInsidePage === 1}
                onPress={() => setInsidePage((prev) => Math.max(1, prev - 1))}
                activeOpacity={0.85}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </TouchableOpacity>

              <Text style={[styles.pageInfo, { color: colors.textSecondary }]}>
                Page {safeInsidePage} of {totalInsidePages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  {
                    backgroundColor: safeInsidePage === totalInsidePages ? colors.border : colors.primary,
                  },
                ]}
                disabled={safeInsidePage === totalInsidePages}
                onPress={() => setInsidePage((prev) => Math.min(totalInsidePages, prev + 1))}
                activeOpacity={0.85}
              >
                <Text style={styles.pageButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  headerIdentity: {
    flexShrink: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E0E0E0',
    marginTop: 2,
  },
  logoutButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 128,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  statNumber: {
    fontSize: 38,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionsContainer: {
    marginBottom: 18,
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    marginTop: 3,
    fontWeight: '500',
  },
  visitorsSection: {
    marginBottom: 8,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionCountPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  visitorCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  visitorLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  visitorIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  visitorTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  visitorTypeText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  visitorInfo: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  visitorTime: {
    fontSize: 11,
    marginTop: 2,
  },
  loadingRow: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 8,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paginationRow: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  pageButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pageInfo: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  alertsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  alertsBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  alertsIcon: {
    fontSize: 24,
    fontWeight: '700',
  },
  alertsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  alertsSubtitle: {
    fontSize: 12,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  alertsArrow: {},
});
