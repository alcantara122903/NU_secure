import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

export type AlertVariant = 'success' | 'error' | 'warning';

export type AlertModalAction = {
  text: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
};

export type AlertModalProps = {
  visible: boolean;
  variant: AlertVariant;
  title: string;
  message?: string;
  /** When false, tapping the backdrop does not close the modal. Default true. */
  dismissOnBackdropPress?: boolean;
  onRequestClose?: () => void;
  /** Primary action (e.g. OK). Shown as filled button. */
  confirmText?: string;
  onConfirm?: () => void;
  /** Optional second button (e.g. Cancel). */
  cancelText?: string;
  onCancel?: () => void;
  /** Full control over buttons; when set, overrides confirm/cancel props. */
  actions?: AlertModalAction[];
};

const VARIANT_META: Record<AlertVariant, { icon: React.ComponentProps<typeof MaterialIcons>['name']; accent: string; soft: string }> = {
  success: {
    icon: 'check-circle',
    accent: '#198754',
    soft: 'rgba(25, 135, 84, 0.12)',
  },
  error: {
    icon: 'error',
    accent: '#DC3545',
    soft: 'rgba(220, 53, 69, 0.12)',
  },
  warning: {
    icon: 'warning',
    accent: '#D97706',
    soft: 'rgba(217, 119, 6, 0.15)',
  },
};

export function AlertModal({
  visible,
  variant,
  title,
  message,
  dismissOnBackdropPress = true,
  onRequestClose,
  confirmText = 'OK',
  onConfirm,
  cancelText,
  onCancel,
  actions,
}: AlertModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const meta = VARIANT_META[variant];

  const close = () => {
    onRequestClose?.();
  };

  const handleBackdropPress = (_e: GestureResponderEvent) => {
    if (dismissOnBackdropPress) {
      close();
    }
  };

  const runAndClose = (fn?: () => void) => {
    fn?.();
    close();
  };

  const builtActions: AlertModalAction[] =
    actions && actions.length > 0
      ? actions
      : [
          ...(cancelText
            ? [{ text: cancelText, variant: 'secondary' as const, onPress: onCancel }]
            : []),
          { text: confirmText, variant: 'primary' as const, onPress: onConfirm },
        ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.soft }]}>
            <MaterialIcons name={meta.icon} size={44} color={meta.accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}

          <View style={[styles.actionsRow, builtActions.length === 1 && styles.actionsRowSingle]}>
            {builtActions.map((action, index) => {
              const isPrimary = action.variant !== 'secondary';
              const single = builtActions.length === 1;
              return (
                <Pressable
                  key={`${action.text}-${index}`}
                  style={({ pressed }) => [
                    styles.button,
                    isPrimary
                      ? { backgroundColor: meta.accent }
                      : {
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
                    pressed && { opacity: 0.88 },
                    !single && styles.buttonMulti,
                    single && styles.buttonFullWidth,
                  ]}
                  onPress={() => runAndClose(action.onPress)}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      { color: isPrimary ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {action.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  actionsRowSingle: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: '40%',
  },
  buttonMulti: {
    flexBasis: '45%',
  },
  buttonFullWidth: {
    width: '100%',
    flexBasis: 'auto',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
