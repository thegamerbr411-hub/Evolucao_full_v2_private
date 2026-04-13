import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../theme';

export function ProgressItem({
  label,
  value,
  status,
  onPress,
  testID,
  fillWidth,
  fillColor = '#60A5FA',
}) {
  return (
    <TouchableOpacity testID={testID} style={styles.row} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={status === 'ok' ? styles.ok : styles.pending}>
            {value}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: fillColor }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#141922',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  ok: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
  },
  pending: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '800',
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});