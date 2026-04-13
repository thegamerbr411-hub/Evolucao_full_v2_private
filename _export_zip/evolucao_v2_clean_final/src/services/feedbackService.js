import * as Haptics from 'expo-haptics';

export const success = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const impact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};
