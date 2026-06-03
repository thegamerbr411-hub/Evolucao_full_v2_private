import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Vibration, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function QuickExerciseRegister({ exercise, onRegister, lastWeight }) {
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    await onRegister(lastWeight);
    Vibration.vibrate(80);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{exercise.name}</Text>
      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
        <Text style={styles.btnText}>Registrar {lastWeight}kg</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { margin: 8, alignItems: 'center' },
  label: { fontSize: 16, marginBottom: 8, color: colors.textPrimary, fontWeight: '700' },
  btn: { backgroundColor: colors.primary, padding: 12, borderRadius: 8 },
  btnText: { color: colors.textInverse, fontWeight: 'bold' },
});
