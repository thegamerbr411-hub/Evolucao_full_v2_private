import { useSubscriptionDomain } from '../context/subscription/SubscriptionProvider';

export function useNotifications() {
  return useSubscriptionDomain();
}
