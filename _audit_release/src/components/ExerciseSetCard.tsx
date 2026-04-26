// src/components/ExerciseSetCard.tsx
/**
 * Card de série melhorado
 * - Sem "0kg x 0"
 * - Layout compacto
 * - Input inline para RPE
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { formatSetDisplay, formatRPE, validateExerciseInput } from '../utils/formatters'

type Props = {
  set: number
  weight?: number
  reps?: number
  sets?: number
  rpe?: number
  onWeightChange: (value: number) => void
  onRepsChange: (value: number) => void
  onRPEChange: (value: number) => void
  onDelete: () => void
  isActive: boolean
}

export const ExerciseSetCard = ({
  set,
  weight,
  reps,
  sets,
  rpe,
  onWeightChange,
  onRepsChange,
  onRPEChange,
  onDelete,
  isActive,
}: Props) => {
  const [editMode, setEditMode] = useState(false)
  const display = formatSetDisplay(weight, reps, sets)

  return (
    <Pressable
      onLongPress={() => setEditMode(!editMode)}
      style={[styles.container, isActive && styles.activeContainer]}
    >
      {/* Header - Set number + Display */}
      <View style={styles.header}>
        <View style={styles.setNumber}>
          <Text style={styles.setNumberText}>#{set}</Text>
        </View>

        {display ? (
          <Text style={styles.displayText}>{display}</Text>
        ) : (
          <Text style={styles.placeholderText}>Registre sua primeira série</Text>
        )}
      </View>

      {/* RPE inline */}
      {!editMode && rpe && (
        <Text style={styles.rpeText}>RPE: {formatRPE(rpe)}</Text>
      )}

      {/* Edit Mode - Inputs inline */}
      {editMode && (
        <View style={styles.editContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Peso</Text>
            <TextInput
              style={styles.input}
              placeholder="kg"
              keyboardType="decimal-pad"
              value={weight?.toString() || ''}
              onChangeText={(val) => onWeightChange(parseFloat(val) || 0)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reps</Text>
            <TextInput
              style={styles.input}
              placeholder="reps"
              keyboardType="number-pad"
              value={reps?.toString() || ''}
              onChangeText={(val) => onRepsChange(parseInt(val) || 0)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>RPE</Text>
            <TextInput
              style={styles.input}
              placeholder="rpe"
              keyboardType="decimal-pad"
              value={rpe?.toString() || ''}
              onChangeText={(val) => onRPEChange(parseFloat(val) || 0)}
            />
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {editMode && (
          <>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={onDelete}
            >
              <Text style={styles.deleteBtnText}>🗑️ Remover</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => setEditMode(false)}
            >
              <Text style={styles.saveBtnText}>✅ Salvar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#666',
  },
  activeContainer: {
    borderLeftColor: '#ff6b35',
    backgroundColor: '#252525',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setNumber: {
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  setNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  displayText: {
    color: '#4ecdc4',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
  },
  rpeText: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  editContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#999',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4ecdc4',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
})
