import React from 'react';
import { SubscriptionProvider } from './subscription/SubscriptionProvider';
import { AppProvider } from './AppContext';

export function RootProvider({ children }) {
  return (
    <SubscriptionProvider>
      <AppProvider>{children}</AppProvider>
    </SubscriptionProvider>
  );
}
