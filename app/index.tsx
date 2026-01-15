import { StyleSheet, Text, View, TouchableOpacity, Animated, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExternalLink, Users, X } from "lucide-react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useRef, useCallback, useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const COMMUNITY_URL = "https://bornofambition.circle.so/";
const STORAGE_KEY = "webview_session_data";

const EXTRACT_SESSION_SCRIPT = `
(function() {
  function extractAndSend() {
    try {
      const sessionData = {
        cookies: document.cookie,
        localStorage: {},
        timestamp: Date.now()
      };
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          sessionData.localStorage[key] = localStorage.getItem(key);
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SESSION_DATA',
        data: sessionData
      }));
    } catch (e) {
      console.log('Extract error:', e);
    }
  }
  
  // Extract on page load and periodically
  extractAndSend();
  setInterval(extractAndSend, 5000);
  
  // Also extract on any storage change
  window.addEventListener('storage', extractAndSend);
})();
true;
`;

const createInjectSessionScript = (sessionData: { cookies: string; localStorage: Record<string, string> } | null) => {
  if (!sessionData) return '';
  
  const localStorageEntries = Object.entries(sessionData.localStorage || {})
    .map(([key, value]) => `localStorage.setItem('${key.replace(/'/g, "\\'")}',' ${String(value).replace(/'/g, "\\'")}');`)
    .join('\n');
  
  const cookieStatements = (sessionData.cookies || '').split(';')
    .filter(c => c.trim())
    .map(cookie => `document.cookie = '${cookie.trim().replace(/'/g, "\\'")}; path=/; SameSite=Lax';`)
    .join('\n');
  
  return `
(function() {
  try {
    ${localStorageEntries}
    ${cookieStatements}
    console.log('Session data restored');
  } catch (e) {
    console.log('Restore error:', e);
  }
})();
true;
`;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [browserVisible, setBrowserVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [storedSession, setStoredSession] = useState<{ cookies: string; localStorage: Record<string, string> } | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Loaded stored session data');
        setStoredSession(parsed);
      }
    } catch (e) {
      console.log('Error loading session:', e);
    }
  };

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'SESSION_DATA') {
        const sessionData = message.data;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          cookies: sessionData.cookies,
          localStorage: sessionData.localStorage
        }));
        console.log('Session data saved to storage');
      }
    } catch (e) {
      console.log('Error handling message:', e);
    }
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const openCommunity = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log("Opening community URL:", COMMUNITY_URL);
    setBrowserVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [slideAnim]);

  const closeBrowser = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setBrowserVisible(false);
    });
  }, [slideAnim]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Users size={48} color={Colors.primary} strokeWidth={1.5} />
        </View>
        
        <Text style={styles.title}>Born of Ambition</Text>
        <Text style={styles.subtitle}>Community</Text>
        
        <Text style={styles.description}>
          Join the community and connect with like-minded individuals.
        </Text>

        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={openCommunity}
          testID="open-community-button"
        >
          <Animated.View 
            style={[
              styles.button,
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            <Text style={styles.buttonText}>Open Community</Text>
            <ExternalLink size={20} color={Colors.text} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        Powered by Circle
      </Text>

      <Modal
        visible={browserVisible}
        animationType="none"
        transparent
        onRequestClose={closeBrowser}
      >
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [800, 0],
                }),
              }],
            },
          ]}
        >
          <View style={[styles.browserHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={closeBrowser}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.browserTitle}>Community</Text>
            <View style={styles.closeButton} />
          </View>
          
          {Platform.OS === 'web' ? (
            <View style={styles.webFallback}>
              <Text style={styles.webFallbackText}>Opening in new tab...</Text>
              {browserVisible && (
                <Text 
                  style={styles.webLink}
                  onPress={() => {
                    window.open(COMMUNITY_URL, '_blank');
                    closeBrowser();
                  }}
                >
                  Click here if not redirected
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.webviewContainer, { paddingBottom: insets.bottom }]}>
              <WebView
                ref={webViewRef}
                source={{ uri: COMMUNITY_URL }}
                style={styles.webview}
                startInLoadingState
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                injectedJavaScriptBeforeContentLoaded={createInjectSessionScript(storedSession)}
                injectedJavaScript={EXTRACT_SESSION_SCRIPT}
                onMessage={handleWebViewMessage}
              />
            </View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500" as const,
    color: Colors.primary,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  footer: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  browserHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  browserTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  webFallbackText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  webLink: {
    fontSize: 16,
    color: Colors.primary,
    marginTop: 12,
  },
});
