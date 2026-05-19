import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Toast from 'react-native-toast-message';
import { handleAuthRedirectUrl, isAuthCallbackUrl } from './services/auth.service';
import { AppNavigator } from './navigation/AppNavigator';
import { LoginScreen } from './screens/auth/LoginScreen';
import { initializeLanguage } from './i18n';
import { supabase } from './lib/supabase';
import { useAppStore } from './store';
import { colors } from './theme';
import './i18n';
import './global.css';

// On web, frame the app in a phone-shaped column so mobile screens don't stretch across the browser.
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#0f172a' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          backgroundColor: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 0 24px rgba(0,0,0,0.25)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { session, setSession } = useAppStore();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    if (!incomingUrl || session || !isAuthCallbackUrl(incomingUrl)) return;
    void handleAuthRedirectUrl(incomingUrl).then(({ error }) => {
      if (error) console.error('Deep link auth error:', error.message);
    });
  }, [incomingUrl, session]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initializeLanguage();
        const { data } = await supabase.auth.getSession();
        if (mounted) setSession(data.session);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        if (mounted) setIsReady(true);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <WebFrame>
          <View className="flex-1 justify-center items-center bg-white">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </WebFrame>
      </SafeAreaProvider>
    );
  }

  // Show login outside NavigationContainer so it doesn't conflict with the tab navigator
  if (!session) {
    return (
      <SafeAreaProvider>
        <WebFrame>
          <LoginScreen />
        </WebFrame>
        <Toast />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <WebFrame>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </WebFrame>
      <Toast />
    </SafeAreaProvider>
  );
}
