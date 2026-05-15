import React, { useCallback } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface ButtonConfig {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface Props {
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  onIncrementLongPress: () => void;
  onIncrementPressOut: () => void;
  isResetting: boolean;
  value: number;
}

function ActionButton({
  label,
  onPress,
  onLongPress,
  onPressOut,
  variant,
  disabled,
}: ButtonConfig): React.JSX.Element {
  const handlePressOut = useCallback(
    (_e: GestureResponderEvent) => {
      onPressOut?.();
    },
    [onPressOut],
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={handlePressOut}
      disabled={disabled}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            styles[`${variant}Label` as keyof typeof styles],
            pressed && styles.pressedLabel,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function CounterButtons({
  onIncrement,
  onDecrement,
  onReset,
  onIncrementLongPress,
  onIncrementPressOut,
  isResetting,
  value,
}: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ActionButton
          label="−"
          onPress={onDecrement}
          variant="secondary"
          disabled={isResetting || value <= 0}
        />
        <ActionButton
          label="+"
          onPress={onIncrement}
          onLongPress={onIncrementLongPress}
          onPressOut={onIncrementPressOut}
          variant="primary"
          disabled={isResetting}
        />
      </View>
      <ActionButton
        label="Reset"
        onPress={onReset}
        variant="danger"
        disabled={isResetting || value === 0}
      />
      <Text style={styles.hint}>Hold + for rapid increment</Text>
    </View>
  );
}

const BASE_BUTTON: object = {
  paddingVertical: 18,
  paddingHorizontal: 32,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 100,
  elevation: 3,
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 24,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  button: {
    ...(BASE_BUTTON as object),
    flex: 1,
  },
  // Variant backgrounds
  primary: { backgroundColor: '#16213e' },
  secondary: { backgroundColor: '#0f3460' },
  danger: { backgroundColor: '#e94560' },
  // Variant labels
  label: { fontSize: 24, fontWeight: '700' },
  primaryLabel: { color: '#fff' },
  secondaryLabel: { color: '#fff' },
  dangerLabel: { color: '#fff', fontSize: 18 },
  // States
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  pressedLabel: {},
  disabled: { opacity: 0.35 },
  hint: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 },
});

export default React.memo(CounterButtons);
