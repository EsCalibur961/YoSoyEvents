import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "./ThemeContext";

type FeedbackType = "success" | "error" | "warning" | "info";

type ToastOptions = {
  title: string;
  message?: string;
  type?: FeedbackType;
  duration?: number;
};

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

type FeedbackContextValue = {
  showFeedback: (options: ToastOptions) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (options: ConfirmOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showFeedback = useCallback(
    (options: ToastOptions) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({
        type: "success",
        duration: 3200,
        ...options,
      });

      translateY.setValue(-120);
      opacity.setValue(0);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            damping: 17,
            stiffness: 180,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      });

      timerRef.current = setTimeout(
        hideToast,
        options.duration ?? 3200,
      );
    },
    [hideToast, opacity, translateY],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showFeedback,
      success: (title, message) =>
        showFeedback({ title, message, type: "success" }),
      error: (title, message) =>
        showFeedback({ title, message, type: "error", duration: 4200 }),
      warning: (title, message) =>
        showFeedback({ title, message, type: "warning", duration: 4000 }),
      info: (title, message) =>
        showFeedback({ title, message, type: "info" }),
      confirm: (options) => setConfirmState(options),
    }),
    [showFeedback],
  );

  const type = toast?.type || "success";
  const accent =
    type === "success"
      ? colors.success
      : type === "error"
        ? colors.danger
        : type === "warning"
          ? colors.warning
          : colors.primary;

  const icon =
    type === "success"
      ? "checkmark-circle"
      : type === "error"
        ? "close-circle"
        : type === "warning"
          ? "warning"
          : "information-circle";

  const runConfirm = async () => {
    const current = confirmState;
    setConfirmState(null);
    if (!current) return;
    await current.onConfirm();
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {toast ? (
        <View pointerEvents="box-none" style={styles.toastLayer}>
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: colors.card,
                borderColor: `${accent}55`,
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View
              style={[
                styles.toastIcon,
                { backgroundColor: `${accent}16` },
              ]}
            >
              <Ionicons name={icon as any} size={23} color={accent} />
            </View>

            <View style={styles.toastContent}>
              <Text style={[styles.toastTitle, { color: colors.text }]}>
                {toast.title}
              </Text>

              {toast.message ? (
                <Text
                  style={[styles.toastMessage, { color: colors.secondary }]}
                >
                  {toast.message}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={hideToast}
            >
              <Ionicons name="close" size={18} color={colors.secondary} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(confirmState)}
        onRequestClose={() => setConfirmState(null)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setConfirmState(null)}
        >
          <Pressable
            style={[
              styles.confirmCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.confirmIcon,
                {
                  backgroundColor: confirmState?.destructive
                    ? `${colors.danger}14`
                    : `${colors.primary}14`,
                },
              ]}
            >
              <Ionicons
                name={
                  confirmState?.destructive
                    ? "trash-outline"
                    : "help-circle-outline"
                }
                size={28}
                color={
                  confirmState?.destructive
                    ? colors.danger
                    : colors.primary
                }
              />
            </View>

            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {confirmState?.title}
            </Text>

            {confirmState?.message ? (
              <Text
                style={[
                  styles.confirmMessage,
                  { color: colors.secondary },
                ]}
              >
                {confirmState.message}
              </Text>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setConfirmState(null)}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: colors.secondary },
                  ]}
                >
                  {confirmState?.cancelText || "Annulla"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: confirmState?.destructive
                      ? colors.danger
                      : colors.primary,
                  },
                ]}
                onPress={runConfirm}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    { color: colors.onPrimary },
                  ]}
                >
                  {confirmState?.confirmText || "Conferma"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback deve essere usato dentro FeedbackProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  toastLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 14,
    paddingTop: 54,
  },

  toast: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  toastIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  toastContent: {
    flex: 1,
    paddingRight: 6,
  },

  toastTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  toastMessage: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 3,
  },

  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.64)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },

  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  confirmMessage: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
  },

  confirmActions: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 20,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },

  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
