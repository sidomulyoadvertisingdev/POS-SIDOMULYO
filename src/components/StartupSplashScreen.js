import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';

const AnimatedView = Animated.createAnimatedComponent(View);

export default function StartupSplashScreen({ version, onFinish }) {
  const { width } = useWindowDimensions();
  const [logoSource, setLogoSource] = useState(null);

  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.2)).current;
  const floatOffset = useRef(new Animated.Value(0)).current;
  const fadeOutOpacity = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  const logoSize = Math.max(180, Math.min(width < 900 ? width * 0.22 : width * 0.14, 230));

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/iconsm.svg'));
        if (!asset.localUri && !asset.uri) {
          await asset.downloadAsync();
        }

        const uri = asset.localUri || asset.uri;
        if (isMounted && uri) {
          setLogoSource({ uri });
        }
      } catch (_error) {
        if (isMounted) {
          setLogoSource(null);
        }
      }
    };

    loadLogo();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatOffset, {
          toValue: -10,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatOffset, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const finishTimeout = setTimeout(() => {
      Animated.timing(fadeOutOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        floatLoop.stop();
        pulseLoop.stop();
        onFinish?.();
      });
    }, 2800);

    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(introScale, {
        toValue: 1,
        damping: 11,
        mass: 0.9,
        stiffness: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      pulseLoop.start();
      floatLoop.start();
    });

    return () => {
      clearTimeout(finishTimeout);
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [fadeOutOpacity, floatOffset, glowPulse, introOpacity, introScale, onFinish]);

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.28],
  });

  return (
    <AnimatedView style={[styles.overlay, { opacity: fadeOutOpacity }]}>
      <View style={styles.backgroundBase} />
      <AnimatedView
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: logoSize * 1.7,
            height: logoSize * 1.7,
            borderRadius: logoSize,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.centerWrap}>
          <AnimatedView
            style={[
              styles.logoWrap,
              {
                width: logoSize,
                height: logoSize,
                opacity: introOpacity,
                transform: [{ scale: introScale }, { translateY: floatOffset }],
              },
            ]}
          >
            {logoSource ? (
              <Image source={logoSource} resizeMode="contain" style={styles.logoImage} />
            ) : (
              <View style={[styles.logoFallback, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]} />
            )}
          </AnimatedView>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Version {version || '-'}</Text>
          <Text style={styles.footerText}>©sidomulyoproject</Text>
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: '#eef4ff',
    overflow: 'hidden',
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eef4ff',
  },
  glow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -120,
    marginTop: -160,
    backgroundColor: 'rgba(47,100,239,0.18)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingTop: 54,
    paddingBottom: 38,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    backgroundColor: '#0a1072',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(15,69,175,0.08)',
    gap: 4,
  },
  versionText: {
    color: '#103c8a',
    fontSize: 13,
    fontWeight: '700',
  },
  footerText: {
    color: '#52627f',
    fontSize: 12,
  },
});
