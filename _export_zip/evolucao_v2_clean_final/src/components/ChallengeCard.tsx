// src/components/ChallengeCard.tsx
/**
 * Card de desafio estilo Duolingo
 * - Barra de progresso
 * - Badge de completado
 * - Animação ao completar
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native'
import { Challenge } from '../stores/useChallengesStore'

type Props = {
  challenge: Challenge
  onPress?: () => void
}

export const ChallengeCard = ({ challenge, onPress }: Props) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (challenge.completed) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [challenge.completed])

  const progressPercent = (challenge.progress / challenge.goal) * 100

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.content,
          challenge.completed && styles.completedContent,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Completed badge */}
        {challenge.completed && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.xp}>+{challenge.reward} XP</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(progressPercent, 100)}%`,
              },
            ]}
          />
        </View>

        {/* Progress text */}
        <View style={styles.footer}>
          <Text style={styles.progressText}>
            {Math.round(challenge.progress)}/{Math.round(challenge.goal)}
          </Text>
          <Text style={styles.percentText}>{Math.round(progressPercent)}%</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  content: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
  },
  completedContent: {
    borderLeftColor: '#4ecdc4',
    backgroundColor: '#1f3a3a',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4ecdc4',
    borderRadius: 50,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 40,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  xp: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4ecdc4',
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#999',
  },
  percentText: {
    fontSize: 12,
    color: '#4ecdc4',
    fontWeight: '600',
  },
})
