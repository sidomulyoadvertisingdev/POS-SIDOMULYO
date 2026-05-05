import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts, Poppins_400Regular } from '@expo-google-fonts/poppins';
import LoginScreen from './src/screens/LoginScreen';
import SalesScreen from './src/screens/SalesScreen';
import StartupSplashScreen from './src/components/StartupSplashScreen';
import { appEnv } from './src/config/appEnv';
import { logoutPosUser } from './src/services/erpApi';

export default function App() {
  const [authState, setAuthState] = useState('unauthenticated');
  const [currentUser, setCurrentUser] = useState(null);
  const [isStartupSplashVisible, setIsStartupSplashVisible] = useState(true);
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
      {!fontsLoaded ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0f45af" />
        </View>
      ) : authState === 'authenticated' ? (
        <SalesScreen currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {isStartupSplashVisible ? (
        <StartupSplashScreen
          version={appEnv.appVersion}
          onFinish={() => {
            setIsStartupSplashVisible(false);
          }}
        />
      ) : null}
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
