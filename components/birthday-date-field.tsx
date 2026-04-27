import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type BirthdayFieldColors = {
  background: string;
  surface: string;
  primary: string;
  text: string;
  textSecondary: string;
  border: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse YYYY-MM-DD to local calendar date; invalid returns null. */
export function parseIsoBirthday(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

export function formatIsoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDisplayMDY(iso: string): string {
  const d = parseIsoBirthday(iso);
  if (!d) return '';
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const pad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

type BirthdayDateFieldProps = {
  value: string;
  onChange: (isoYyyyMmDd: string) => void;
  colors: BirthdayFieldColors;
  label?: string;
  /** Merged with base input row (e.g. styles.fieldInput + theme border). */
  inputContainerStyle?: StyleProp<ViewStyle>;
};

export function BirthdayDateField({
  value,
  onChange,
  colors,
  label = 'Birthday',
  inputContainerStyle,
}: BirthdayDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoBirthday(value), [value]);

  const initialView = useCallback(() => {
    if (selected) return { y: selected.getFullYear(), m: selected.getMonth() };
    const t = startOfToday();
    return { y: t.getFullYear(), m: t.getMonth() };
  }, [selected]);

  const [viewYear, setViewYear] = useState(() => initialView().y);
  const [viewMonth, setViewMonth] = useState(() => initialView().m);

  const openModal = () => {
    const v = initialView();
    setViewYear(v.y);
    setViewMonth(v.m);
    setOpen(true);
  };

  const today = startOfToday();
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const canGoNext =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const onPickDay = (day: number) => {
    const picked = new Date(viewYear, viewMonth, day);
    picked.setHours(0, 0, 0, 0);
    if (picked > today) return;
    onChange(formatIsoFromDate(picked));
    setOpen(false);
  };

  const onClear = () => {
    onChange('');
  };

  const onToday = () => {
    onChange(formatIsoFromDate(today));
    setOpen(false);
  };

  const display = formatDisplayMDY(value);
  const headerTitle = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        onPress={openModal}
        style={({ pressed }) => [
          styles.inputRow,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.background : colors.surface,
          },
          inputContainerStyle,
        ]}
      >
        <Text
          style={[styles.inputText, { color: display ? colors.text : colors.textSecondary }]}
          numberOfLines={1}
        >
          {display || 'MM / DD / YYYY'}
        </Text>
        <MaterialIcons name="calendar-today" size={20} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.headerTitleWrap}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{headerTitle}</Text>
                <MaterialIcons name="arrow-drop-down" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.headerNav}>
                <TouchableOpacity
                  onPress={goPrevMonth}
                  style={styles.navBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="keyboard-arrow-up" size={26} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goNextMonth}
                  disabled={!canGoNext}
                  style={[styles.navBtn, !canGoNext && { opacity: 0.25 }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={26} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <View key={d} style={styles.weekCol}>
                  <Text style={[styles.weekCell, { color: colors.textSecondary }]}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {grid.map((cell, idx) => {
                if (cell === null) {
                  return <View key={`e-${idx}`} style={styles.dayCol} />;
                }
                const cellDate = new Date(viewYear, viewMonth, cell);
                cellDate.setHours(0, 0, 0, 0);
                const isFuture = cellDate > today;
                const isSelected = selected ? isSameDay(cellDate, selected) : false;
                return (
                  <View key={idx} style={styles.dayCol}>
                    <TouchableOpacity
                      style={styles.dayTouch}
                      disabled={isFuture}
                      onPress={() => onPickDay(cell)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          isSelected && {
                            backgroundColor: colors.primary,
                            borderWidth: 1,
                            borderColor: colors.text,
                          },
                          isFuture && { opacity: 0.28 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: colors.text },
                            isSelected && { color: '#FFFFFF', fontWeight: '600' },
                          ]}
                        >
                          {cell}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={onClear} hitSlop={{ top: 12, bottom: 12 }}>
                <Text style={[styles.footerBtn, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onToday} hitSlop={{ top: 12, bottom: 12 }}>
                <Text style={[styles.footerBtn, { color: colors.primary }]}>Today</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 0,
  },
  inputRow: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerNav: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  navBtn: {
    paddingVertical: 0,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekCell: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCol: {
    width: '14.28%',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    fontSize: 16,
    fontWeight: '600',
  },
});
