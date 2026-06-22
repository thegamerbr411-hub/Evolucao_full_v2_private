import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

/** Tab bar height when inside Bottom Tabs; 0 on Stack routes (e.g. SocialChallenges from Treino hub). */
export function useSafeBottomTabBarHeight() {
  const height = useContext(BottomTabBarHeightContext);
  return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}
