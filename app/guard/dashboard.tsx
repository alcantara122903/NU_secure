import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database';
import { fetchReadyToExitVisitors } from '@/services/guard-alerts-dashboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

type InsideType = 'all' | 'enrollee' | 'contractor' | 'normal';

type InsideVisitor = {
  id: number;
  name: string;
  detail: string;
  timeLabel: string;
  type: Exclude<InsideType, 'all'>;
  typeLabel: string;
  status: 'Arrived' | 'Ready to Exit';
};

const INSIDE_PAGE_SIZE = 5;

function HeaderBackgroundPattern() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 190"
      preserveAspectRatio="none"
    >
      <Path
        d="M-40 150 C60 85, 150 210, 270 120 C345 65, 395 85, 470 35"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1.4"
        fill="none"
      />
      <Path
        d="M-35 160 C75 95, 160 215, 285 130 C350 85, 405 95, 465 50"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.2"
        fill="none"
      />
      <Path
        d="M-30 170 C90 105, 175 220, 300 140 C365 100, 415 110, 465 70"
        stroke="rgba(142,209,230,0.18)"
        strokeWidth="1.3"
        fill="none"
      />

      <Path
        d="M230 -20 L460 -20 L335 210 L110 210 Z"
        fill="rgba(255,255,255,0.035)"
      />

      <Path
        d="M355 85 
           C382 82, 400 70, 410 58
           C420 70, 438 82, 465 85
           L465 130
           C465 165, 438 184, 410 195
           C382 184, 355 165, 355 130
           Z"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="4"
        fill="none"
      />

      <Circle cx="310" cy="42" r="2" fill="rgba(255,255,255,0.14)" />
      <Circle cx="335" cy="62" r="1.6" fill="rgba(255,255,255,0.10)" />
      <Circle cx="275" cy="88" r="1.4" fill="rgba(142,209,230,0.18)" />
    </Svg>
  );
}

export default function DashboardScreen() {
  const router = useRouter();

  const [guardName, setGuardName] = useState(
    () => authSessionService.getCurrentUserFirstLastName() || 'Guard',
  );
  const [activeVisitors, setActiveVisitors] = useState<number | null>(null);
  const [readyToExitCount, setReadyToExitCount] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [insidePage, setInsidePage] = useState(1);
  const [insideTypeFilter, setInsideTypeFilter] = useState<InsideType>('all');
  const [insideVisitors, setInsideVisitors] = useState<InsideVisitor[]>([]);
  const [isLoadingInside, setIsLoadingInside] = useState(true);

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

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const name = authSessionService.getCurrentUserFirstLastName();
      setGuardName(name || 'Guard');
    }, []),
  );

  const loadCurrentlyInside = useCallback(async () => {
    try {
      const [{ data: openVisits, error: visitErr }, readyRows] = await Promise.all([
        supabase
          .from('visit')
          .select('visit_id, visitor_id, visit_type_id, entry_time, purpose_reason, destination_text, primary_office_id, pass_number, control_number')
          .is('exit_time', null)
          .order('entry_time', { ascending: false }),
        fetchReadyToExitVisitors().catch((e) => {
          console.error('Dashboard ready-to-exit:', e);
          return [] as Awaited<ReturnType<typeof fetchReadyToExitVisitors>>;
        }),
      ]);

      const readyVisitIds = new Set(readyRows.map((r) => r.visitId));
      setReadyToExitCount(readyRows.length);

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
              .select('visitor_id, first_name, last_name')
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
          },
        ]),
      );

      const officeMap = new Map(
        (officeRows ?? []).map((o) => [Number(o.office_id), String(o.office_name ?? '').trim()]),
      );

      const formatted: InsideVisitor[] = visits.map((v) => {
        const visitor = visitorMap.get(Number(v.visitor_id));
        const name =
          [visitor?.firstName ?? '', visitor?.lastName ?? ''].filter(Boolean).join(' ').trim() || 'Visitor';

        const purpose = String(v.purpose_reason ?? '').trim();
        const destinationText = String(v.destination_text ?? '').trim();
        const officeName =
          v.primary_office_id != null ? officeMap.get(Number(v.primary_office_id)) || '' : '';
        const tag = String(v.control_number ?? '').trim() || String(v.pass_number ?? '').trim() || '';
        const primaryDetail = purpose || destinationText || officeName || 'Inside campus';
        const detail = tag ? `${primaryDetail} • ${tag}` : primaryDetail;

        const entry = v.entry_time ? new Date(v.entry_time) : null;
        const timeLabel =
          entry && !Number.isNaN(entry.getTime())
            ? entry.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : '--';

        const visitTypeId = Number(v.visit_type_id);
        const type: Exclude<InsideType, 'all'> =
          visitTypeId === 1 ? 'enrollee' : visitTypeId === 2 ? 'contractor' : 'normal';
        const typeLabel = type === 'enrollee' ? 'Enrollee' : type === 'contractor' ? 'Contractor' : 'Visitor';
        const status: InsideVisitor['status'] = readyVisitIds.has(Number(v.visit_id)) ? 'Ready to Exit' : 'Arrived';

        return {
          id: Number(v.visit_id),
          name,
          detail,
          timeLabel,
          type,
          typeLabel,
          status,
        };
      });

      setInsideVisitors(formatted);
    } catch (e) {
      console.error('Dashboard loadCurrentlyInside', e);
      setReadyToExitCount(0);
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
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error clearing session:', error);
      router.replace('/(tabs)');
    }
  };

  const filteredInsideVisitors = useMemo(() => {
    if (insideTypeFilter === 'all') return insideVisitors;
    return insideVisitors.filter((v) => v.type === insideTypeFilter);
  }, [insideTypeFilter, insideVisitors]);

  const totalInsidePages = Math.max(1, Math.ceil(filteredInsideVisitors.length / INSIDE_PAGE_SIZE));
  const safeInsidePage = Math.min(Math.max(insidePage, 1), totalInsidePages);
  const insideStart = (safeInsidePage - 1) * INSIDE_PAGE_SIZE;
  const pagedInsideVisitors = filteredInsideVisitors.slice(insideStart, insideStart + INSIDE_PAGE_SIZE);

  const safeActiveVisitors = activeVisitors ?? 0;
  const timeParts = currentTime.split(' ');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#003F96" />

      <View style={styles.header}>
        <HeaderBackgroundPattern />

        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Guard Portal</Text>

            <View style={styles.guardRow}>
              <View style={styles.shieldIcon}>
                <Text style={styles.shieldText}>✓</Text>
              </View>
              <Text style={styles.headerSubtitle}>{guardName}</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.85} style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={22} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <MaterialIcons name="groups" size={26} color="#0648A8" />
              </View>
              <Text style={styles.statValue}>{safeActiveVisitors}</Text>
              <Text style={styles.statLabel}>Active Visitors</Text>
              <View style={[styles.statAccent, { backgroundColor: '#0648A8' }]} />
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, styles.clockIconCircle]}>
                <MaterialIcons name="schedule" size={24} color="#2E8FC0" />
              </View>
              <View style={styles.timeWrapper}>
                <Text style={[styles.statValue, styles.timeValue]}>{timeParts[0] ?? '--:--'}</Text>
                <Text style={styles.timePeriod}>{timeParts[1] ?? ''}</Text>
              </View>
              <Text style={styles.statLabel}>Current Time</Text>
              <View style={[styles.statAccent, { backgroundColor: '#8ED1E6' }]} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardBlue]}
            onPress={() => router.push('/guard/select-visitor-type')}
            activeOpacity={0.88}
          >
            <View style={styles.actionIconBox}>
              <MaterialIcons name="person-add-alt-1" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Register Visitor</Text>
              <Text style={styles.actionSubtitle}>New entry</Text>
            </View>
            <View style={styles.chevronCircle}>
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardLight]}
            onPress={() => router.push('/guard/exit-scan')}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconBox, styles.actionIconBoxLight]}>
              <MaterialIcons name="input" size={24} color="#0648A8" />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={[styles.actionTitle, styles.actionTitleDark]}>Exit Scan</Text>
              <Text style={[styles.actionSubtitle, styles.actionSubtitleDark]}>Process exit</Text>
            </View>
            <View style={[styles.chevronCircle, styles.chevronCircleLight]}>
              <MaterialIcons name="chevron-right" size={24} color="#111827" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardBlue]}
            onPress={() => router.push('/guard/alerts')}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconBox, styles.actionIconBoxAlert]}>
              <MaterialIcons name="notifications" size={24} color="#0648A8" />
              {readyToExitCount > 0 ? <View style={styles.alertDot} /> : null}
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Active Alerts</Text>
              <Text style={styles.actionSubtitle}>
                {readyToExitCount === 0
                  ? 'No visitors ready to exit'
                  : `${readyToExitCount} ${readyToExitCount === 1 ? 'visitor' : 'visitors'} ready to exit`}
              </Text>
            </View>
            <View style={styles.chevronCircle}>
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrapper}>
              <View style={styles.sectionIconCircle}>
                <MaterialIcons name="assignment" size={17} color="#0648A8" />
              </View>
              <Text style={styles.sectionTitle}>Currently Inside</Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredInsideVisitors.length}</Text>
            </View>
          </View>

          <View style={styles.filtersRow}>
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
                  activeOpacity={0.85}
                  style={[styles.filterPill, selected && styles.filterPillActive]}
                  onPress={() => {
                    setInsideTypeFilter(option.key as InsideType);
                    setInsidePage(1);
                  }}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoadingInside ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0648A8" />
              <Text style={styles.loadingText}>Loading visitors...</Text>
            </View>
          ) : null}

          {!isLoadingInside && filteredInsideVisitors.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No visitors found.</Text>
            </View>
          ) : null}

          <FlatList
            data={pagedInsideVisitors}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.visitorList}
            renderItem={({ item }) => {
              const isReadyToExit = item.status === 'Ready to Exit';

              return (
                <View style={styles.visitorCard}>
                  <View style={styles.avatarCircle}>
                    <MaterialIcons name="person" size={24} color="#0648A8" />
                  </View>

                  <View style={styles.visitorInfo}>
                    <Text style={styles.visitorName}>{item.name}</Text>
                    <Text style={styles.visitorType}>{item.typeLabel}</Text>
                    <Text style={styles.visitorPurpose} numberOfLines={1}>
                      {item.detail}
                    </Text>

                    <View style={styles.enteredRow}>
                      <MaterialIcons name="schedule" size={14} color="#6B7280" />
                      <Text style={styles.enteredText}>Entered at {item.timeLabel}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, isReadyToExit && styles.statusBadgeWarning]}>
                    <Text style={[styles.statusText, isReadyToExit && styles.statusTextWarning]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {!isLoadingInside && filteredInsideVisitors.length > INSIDE_PAGE_SIZE ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, safeInsidePage === 1 && styles.pageButtonDisabled]}
                disabled={safeInsidePage === 1}
                onPress={() => setInsidePage((prev) => Math.max(1, prev - 1))}
                activeOpacity={0.85}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.pageInfo}>
                Page {safeInsidePage} of {totalInsidePages}
              </Text>

              <TouchableOpacity
                style={[styles.pageButton, safeInsidePage === totalInsidePages && styles.pageButtonDisabled]}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#003F96',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: '#0648A8',
    paddingTop: 34,
    paddingBottom: 34,
    overflow: 'hidden',
    position: 'relative',
  },
  headerContent: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  shieldIcon: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: 'rgba(142, 209, 230, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8ED1E6',
  },
  shieldText: {
    color: '#8ED1E6',
    fontSize: 14,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#D7E8FF',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minHeight: 136,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  statIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  clockIconCircle: {
    backgroundColor: '#EFFBFF',
  },
  statValue: {
    color: '#0648A8',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  timeWrapper: {
    alignItems: 'center',
  },
  timeValue: {
    color: '#7BC5DE',
  },
  timePeriod: {
    color: '#9AD6E8',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -4,
  },
  statLabel: {
    color: '#555B66',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  statAccent: {
    position: 'absolute',
    bottom: 0,
    height: 4,
    width: '70%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  actionCard: {
    minHeight: 72,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionCardBlue: {
    backgroundColor: '#0648A8',
  },
  actionCardLight: {
    backgroundColor: '#FFFFFF',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionIconBoxLight: {
    backgroundColor: '#F0F5FC',
  },
  actionIconBoxAlert: {
    backgroundColor: '#FFD914',
  },
  alertDot: {
    position: 'absolute',
    top: -4,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB84D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  actionTextWrapper: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  actionTitleDark: {
    color: '#111827',
  },
  actionSubtitle: {
    color: '#D7E8FF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  actionSubtitleDark: {
    color: '#5B6472',
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronCircleLight: {
    backgroundColor: '#F3F4F6',
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EAF2FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E4F7',
  },
  countBadgeText: {
    color: '#0648A8',
    fontSize: 14,
    fontWeight: '800',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DEE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#0648A8',
    borderColor: '#0648A8',
  },
  filterText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  visitorList: {
    gap: 8,
  },
  visitorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  visitorInfo: {
    flex: 1,
    paddingRight: 8,
  },
  visitorName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  visitorType: {
    color: '#0648A8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  visitorPurpose: {
    color: '#5B6472',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  enteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  enteredText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusBadgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextWarning: {
    color: '#B45309',
  },
  loadingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  paginationRow: {
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    borderRadius: 16,
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
    backgroundColor: '#0648A8',
  },
  pageButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  pageButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pageInfo: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
});
