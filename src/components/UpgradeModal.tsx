// src/components/UpgradeModal.tsx
/**
 * Modal de upgrade pro
 * - Mostra benefícios
 * - Call to action clara
 * - Sem spam
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { PrimaryButton } from './PrimaryButton'

type Props = {
  visible: boolean
  onClose: () => void
  onUpgrade: () => void
  title: string
  description: string
  benefits: string[]
}

export const UpgradeModal = ({
  visible,
  onClose,
  onUpgrade,
  title,
  description,
  benefits,
}: Props) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Description */}
            <Text style={styles.description}>{description}</Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Desbloqueados com PRO:</Text>

              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Text style={styles.benefitCheck}>✓</Text>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Pricing */}
            <View style={styles.pricingContainer}>
              <Text style={styles.price}>R$ 29,90</Text>
              <Text style={styles.period}>/mês</Text>
              <Text style={styles.fineprint}>Cancele quando quiser</Text>
            </View>
          </ScrollView>

          {/* CTA Buttons */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>Agora Não</Text>
            </TouchableOpacity>

            <PrimaryButton
              title="Virar PRO 🔥"
              onPress={onUpgrade}
              variant="success"
              style={styles.upgradeBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingRight: 10,
    paddingBottom: 10,
  },
  closeBtnText: {
    fontSize: 24,
    color: '#999',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsContainer: {
    marginBottom: 24,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ecdc4',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitCheck: {
    fontSize: 18,
    color: '#4ecdc4',
    fontWeight: '700',
    marginRight: 12,
    minWidth: 20,
  },
  benefitText: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#333',
    borderBottomColor: '#333',
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ecdc4',
  },
  period: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  fineprint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  ctaContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  cancelBtnText: {
    color: '#999',
    fontWeight: '600',
  },
  upgradeBtn: {
    flex: 1,
  },
})
