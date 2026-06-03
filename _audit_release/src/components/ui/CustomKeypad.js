import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../../theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

function digitTestId(key) {
  if (key === '⌫') return 'keypad-backspace';
  if (key === '.') return 'keypad-digit-dot';
  return `keypad-digit-${key}`;
}

export default function CustomKeypad({
  visible,
  value,
  title = 'Teclado',
  onChange,
  onClose,
  onConfirm,
}) {
  const slideAnim = React.useRef(new Animated.Value(120)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : 120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) {
    return null;
  }

  const appendKey = (key) => {
    if (typeof onChange !== 'function') return;
    const current = String(value || '');

    if (key === '⌫') {
      onChange(current.slice(0, -1));
      return;
    }

    if (key === '.') {
      if (current.includes('.')) return;
      onChange(current ? `${current}.` : '0.');
      return;
    }

    if (current.length >= 8) return;
    onChange(`${current}${key}`);
  };

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity testID="keypad-close" onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="keypad-confirm" onPress={onConfirm} style={[styles.headerBtn, styles.confirmBtn]}>
            <Text style={[styles.headerBtnText, styles.confirmBtnText]}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.valueText}>{String(value || '0')}</Text>
      <View style={styles.grid}>
        {KEYS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                testID={digitTestId(key)}
                onPress={() => appendKey(key)}
                style={styles.keyBtn}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f1724',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    zIndex: 90,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#162131',
  },
  headerBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: '#1f7a57',
    borderColor: '#2ea36f',
  },
  confirmBtnText: {
    color: '#e8fff3',
  },
  valueText: {
    marginTop: 8,
    marginBottom: 10,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  keyBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b3d57',
    backgroundColor: '#152339',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  keyText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
});
