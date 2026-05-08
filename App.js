import { Component, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts, Poppins_400Regular } from '@expo-google-fonts/poppins';
import LoginScreen from './src/screens/LoginScreen';
import SalesScreen from './src/screens/SalesScreen';
import StartupSplashScreen from './src/components/StartupSplashScreen';
import { appEnv } from './src/config/appEnv';
import { logoutPosUser } from './src/services/erpApi';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }

  componentDidCatch(error) {
    console.error('POS runtime error:', error);
  }

  handleReset = async () => {
    try {
      await this.props.onReset?.();
    } finally {
      this.setState({ error: null });
    }
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>POS mengalami error runtime</Text>
          <Text style={styles.errorMessage}>
            {String(this.state.error?.message || 'Terjadi error yang belum tertangani.')}
          </Text>
          <Pressable style={styles.errorButton} onPress={this.handleReset}>
            <Text style={styles.errorButtonText}>Kembali ke Login</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [authState, setAuthState] = useState('unauthenticated');
  const [currentUser, setCurrentUser] = useState(null);
  const [isStartupSplashVisible, setIsStartupSplashVisible] = useState(true);
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
  });
  const isAppFontReady = fontsLoaded || fontLoadTimedOut;

  useEffect(() => {
    if (fontsLoaded) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (!isAppFontReady) {
      return;
    }

    if (!fontsLoaded) {
      return;
    }

    Text.defaultProps = Text.defaultProps || {};
    TextInput.defaultProps = TextInput.defaultProps || {};
    Text.defaultProps.style = [{ fontFamily: 'Poppins_400Regular' }, Text.defaultProps.style];
    TextInput.defaultProps.style = [{ fontFamily: 'Poppins_400Regular' }, TextInput.defaultProps.style];
  }, [fontsLoaded, isAppFontReady]);

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
      {!isAppFontReady ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0f45af" />
        </View>
      ) : authState === 'authenticated' ? (
        <AppErrorBoundary onReset={handleLogout}>
          <SalesScreen currentUser={currentUser} onLogout={handleLogout} />
        </AppErrorBoundary>
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
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#475467',
    textAlign: 'center',
    maxWidth: 520,
  },
  errorButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0f45af',
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
