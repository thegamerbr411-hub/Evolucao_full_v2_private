// src/components/CoachCard.tsx
/**
 * UI do Coach - aparece durante treino
 * Sem popup, card fixo e leve
 */

import React from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

type Props = {
  message?: string | null
  loadSuggestion?: {
    weight: number
    message: string
  } | null
}

export const CoachCard = ({ message, loadSuggestion }: Props) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (message) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [message])

  if (!message) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Mensagem principal */}
      <View style={styles.messageBox}>
        <Text style={styles.messageText}>{message}</Text>
      </View>

      {/* Sugestão de carga (se houver) */}
      {loadSuggestion && (
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionLabel}>Próximo:</Text>
          <Text style={styles.suggestionWeight}>{loadSuggestion.weight}kg</Text>
          <Text style={styles.suggestionMessage}>{loadSuggestion.message}</Text>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  messageBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  suggestionBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#4ecdc4',
  },
  suggestionLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  suggestionWeight: {
    color: '#4ecdc4',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  suggestionMessage: {
    color: '#ccc',
    fontSize: 13,
  },
})
