// src/stores/useMonetizationStore.ts
import { create } from 'zustand'

export type Plan = 'free' | 'pro' | 'premium'

type Subscription = {
  plan: Plan
  startDate: number
  expiryDate?: number
  active: boolean
}

type MonetizationStore = {
  subscription: Subscription | null
  isPro: boolean
  priceList: Record<string, number>

  setSubscription: (sub: Subscription) => void
  upgradeToPro: (durationDays?: number) => void
  cancelSubscription: () => void
  checkIsPro: () => boolean
}

export const useMonetizationStore = create<MonetizationStore>((set, get) => ({
  subscription: null,
  isPro: false,
  priceList: {
    pro_monthly: 29.9,
    pro_yearly: 199.9,
    premium_monthly: 59.9,
    premium_yearly: 399.9,
  },

  setSubscription: (sub) => {
    set({
      subscription: sub,
      isPro: sub.plan === 'pro' || sub.plan === 'premium',
    })
  },

  upgradeToPro: (durationDays = 30) => {
    const now = Date.now()
    const expiry = now + durationDays * 24 * 60 * 60 * 1000

    const subscription: Subscription = {
      plan: 'pro',
      startDate: now,
      expiryDate: expiry,
      active: true,
    }

    get().setSubscription(subscription)
  },

  cancelSubscription: () => {
    set({
      subscription: null,
      isPro: false,
    })
  },

  checkIsPro: () => {
    const { subscription } = get()
    if (!subscription || !subscription.active) return false

    if (subscription.expiryDate && subscription.expiryDate < Date.now()) {
      get().cancelSubscription()
      return false
    }

    return true
  },
}))

/**
 * Helper pra verificar se feature é pro
 */
export const isPro = (): boolean => {
  return useMonetizationStore.getState().checkIsPro()
}

/**
 * Features bloqueadas pro free
 */
export const PREMIUM_FEATURES = {
  ADVANCED_COACH: 'advanced_coach',
  FULL_PROGRESSION: 'full_progression',
  ADVANCED_RANKING: 'advanced_ranking',
  CUSTOM_PLANS: 'custom_plans',
  PRIORITY_SUPPORT: 'priority_support',
  EXPORT_DATA: 'export_data',
} as const

/**
 * Features free (sem limite)
 */
export const FREE_FEATURES = {
  BASIC_WORKOUT: 'basic_workout',
  BASIC_NUTRITION: 'basic_nutrition',
  SOCIAL_VIEW: 'social_view',
  BASIC_COACH: 'basic_coach',
}
