import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  fetchAuthMe,
  getDefaultLoginEmail,
  hasDefaultLoginPassword,
  loginPosUser,
  useDefaultLoginCredentials,
} from '../services/erpApi';
import { appEnv } from '../config/appEnv';

const LOGIN_REMEMBER_KEY = 'pos_login_remember_v1';

const canUseStorage = () => typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';

const loadRememberedLogin = () => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = globalThis.localStorage.getItem(LOGIN_REMEMBER_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      email: String(parsed?.email || '').trim(),
      password: String(parsed?.password || ''),
      remember: Boolean(parsed?.remember),
    };
  } catch (_error) {
    return null;
  }
};

const saveRememberedLogin = ({ email, password, remember }) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (!remember) {
      globalThis.localStorage.removeItem(LOGIN_REMEMBER_KEY);
      return;
    }

    globalThis.localStorage.setItem(
      LOGIN_REMEMBER_KEY,
      JSON.stringify({
        email: String(email || '').trim(),
        password: String(password || ''),
        remember: true,
      }),
    );
  } catch (_error) {
    // Ignore storage failures in desktop/web runtime.
  }
};

const PasswordEyeIcon = ({ visible }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12C4.7 7.7 8 5.5 12 5.5C16 5.5 19.3 7.7 22 12C19.3 16.3 16 18.5 12 18.5C8 18.5 4.7 16.3 2 12Z"
      stroke="#4565a8"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={12} r={3.2} stroke="#4565a8" strokeWidth={1.7} />
    {!visible ? (
      <Path
        d="M4 20L20 4"
        stroke="#4565a8"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    ) : null}
  </Svg>
);

const LoginScreen = ({ onLoginSuccess }) => {
  const rememberedLogin = useMemo(() => loadRememberedLogin(), []);
  const [email, setEmail] = useState(rememberedLogin?.email || getDefaultLoginEmail());
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(Boolean(rememberedLogin?.remember));

  const canUseQuickLogin = useMemo(() => hasDefaultLoginPassword(), []);

  useEffect(() => {
    if (rememberedLogin?.password) {
      setPassword(rememberedLogin.password);
    }
  }, [rememberedLogin]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Email dan password wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const trimmedEmail = email.trim();
      const loginResponse = await loginPosUser(trimmedEmail, password);
      const me = await fetchAuthMe();
      saveRememberedLogin({
        email: trimmedEmail,
        password,
        remember: rememberPassword,
      });
      onLoginSuccess?.(me || loginResponse?.user || null);
    } catch (error) {
      setErrorMessage(error?.message || 'Login gagal, periksa kredensial backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const loginResponse = await useDefaultLoginCredentials();
      const me = await fetchAuthMe();
      saveRememberedLogin({
        email,
        password,
        remember: rememberPassword,
      });
      onLoginSuccess?.(me || loginResponse?.user || null);
    } catch (error) {
      setErrorMessage(error?.message || 'Login cepat gagal, periksa konfigurasi .env backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBlueLine} />
      <View style={styles.content}>
        <View style={styles.frame}>
          <View style={styles.greenBar}>
            <Text style={styles.greenBarText}>Login POS</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.brandWrap}>
              <Image source={require('../../assets/logo-sidomulyo.png')} resizeMode="contain" style={styles.brandLogo} />
            </View>

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="email@contoh.com"
              placeholderTextColor="#7b7b7b"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder="Masukkan password"
                placeholderTextColor="#7b7b7b"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}
              >
                <PasswordEyeIcon visible={showPassword} />
              </Pressable>
            </View>

            <Pressable
              style={styles.rememberRow}
              onPress={() => setRememberPassword((prev) => !prev)}
            >
              <View style={[styles.checkbox, rememberPassword ? styles.checkboxActive : null]}>
                {rememberPassword ? <View style={styles.checkboxInner} /> : null}
              </View>
              <Text style={styles.rememberText}>Simpan sandi di aplikasi ini</Text>
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={[styles.button, isSubmitting ? styles.buttonDisabled : null]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Masuk</Text>
              )}
            </Pressable>

            {canUseQuickLogin ? (
              <Pressable
                style={[styles.secondaryButton, isSubmitting ? styles.buttonDisabled : null]}
                onPress={handleQuickLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Masuk Cepat dari .env</Text>
              </Pressable>
            ) : null}

            <View style={styles.metaWrap}>
              <Text style={styles.metaText}>©sidomulyoproject</Text>
              <Text style={styles.metaText}>Version {appEnv.appVersion || '-'}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#d9dadc',
  },
  topBlueLine: {
    height: 6,
    backgroundColor: '#0f45af',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
  },
  frame: {
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    padding: 10,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  greenBar: {
    borderWidth: 1,
    borderColor: '#1f4cc5',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  greenBarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#b3b3b3',
    backgroundColor: 'rgba(255,255,255,0.65)',
    padding: 12,
  },
  brandWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingVertical: 8,
  },
  brandLogo: {
    width: 250,
    height: 80,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b2b2b',
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999999',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1f1f1f',
    marginBottom: 4,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 42,
  },
  passwordToggle: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  rememberRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#7f95c7',
    backgroundColor: '#ffffff',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#2f64ef',
    backgroundColor: '#eef4ff',
  },
  checkboxInner: {
    width: 8,
    height: 8,
    backgroundColor: '#2f64ef',
  },
  rememberText: {
    color: '#3e4860',
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: '#a11616',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#2f64ef',
    borderWidth: 1,
    borderColor: '#2250c9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#2f64ef',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#2f64ef',
    fontSize: 13,
    fontWeight: '800',
  },
  metaWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  metaText: {
    color: '#4a4a4a',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default LoginScreen;
