import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  fetchAuthMe,
  getApiBaseUrl,
  getDefaultLoginEmail,
  loginPosUser,
} from '../services/erpApi';

const LoginScreen = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState(getDefaultLoginEmail());
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const baseUrl = useMemo(() => getApiBaseUrl(), []);

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
      const loginResponse = await loginPosUser(email.trim(), password);
      const me = await fetchAuthMe();
      onLoginSuccess?.(me || loginResponse?.user || null);
    } catch (error) {
      setErrorMessage(error?.message || 'Login gagal, periksa kredensial backend.');
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
            <Text style={styles.title}>Masuk ke Kasir POS</Text>
            <Text style={styles.subTitle}>Gunakan akun backend agar bisa mengakses halaman POS.</Text>

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
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Masukkan password"
              placeholderTextColor="#7b7b7b"
              style={styles.input}
            />

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

            <Text style={styles.metaText}>API: {baseUrl}</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#103c8a',
  },
  subTitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: '#363636',
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
  metaText: {
    marginTop: 10,
    color: '#4a4a4a',
    fontSize: 10,
  },
});

export default LoginScreen;
