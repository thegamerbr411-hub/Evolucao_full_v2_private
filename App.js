
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { AppProvider } from './src/context/AppContext';
import { initializeNotifications } from './src/utils/notifications';

export default function App() {
  React.useEffect(() => {
    initializeNotifications().catch(() => {
      // Mantem inicializacao resiliente mesmo sem permissao.
    });
  }, []);

  return (
    <AppProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </AppProvider>
  );
}
