import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts, Poppins_400Regular } from '@expo-google-fonts/poppins';
import LoginScreen from './src/screens/LoginScreen';
import SalesScreen from './src/screens/SalesScreen';
import { fetchAuthMe, hasActiveSession, logoutPosUser } from './src/services/erpApi';

export default function App() {
  const [authState, setAuthState] = useState('checking');
  const [currentUser, setCurrentUser] = useState(null);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
  });

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    Text.defaultProps = Text.defaultProps || {};
    TextInput.defaultProps = TextInput.defaultProps || {};
    Text.defaultProps.style = [{ fontFamily: 'Poppins_400Regular' }, Text.defaultProps.style];
    TextInput.defaultProps.style = [{ fontFamily: 'Poppins_400Regular' }, TextInput.defaultProps.style];
  }, [fontsLoaded]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      if (!hasActiveSession()) {
        setAuthState('unauthenticated');
        return;
      }

      try {
        const me = await fetchAuthMe();
        setCurrentUser(me || null);
        setAuthState('authenticated');
      } catch (error) {
        setAuthState('unauthenticated');
      }
    };

    bootstrapAuth();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user || null);
    setAuthState('authenticated');
  };

  const handleLogout = async () => {
    await logoutPosUser();
    setCurrentUser(null);
    setAuthState('unauthenticated');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {!fontsLoaded || authState === 'checking' ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0f45af" />
        </View>
      ) : authState === 'authenticated' ? (
        <SalesScreen currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8edf4',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
