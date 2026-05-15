import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Props {
  value: number;
  isResetting: boolean;
}

// Pulses the digit briefly whenever the value changes.
function CounterDisplay({ value, isResetting }: Props): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.25,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [value, scaleAnim]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Counter</Text>
      <Animated.Text
        style={[
          styles.value,
          { transform: [{ scale: scaleAnim }] },
          isResetting && styles.valueResetting,
        ]}>
        {value}
      </Animated.Text>
      {isResetting && <Text style={styles.hint}>Resetting…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#888',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  value: {
    fontSize: 96,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 110,
    fontVariant: ['tabular-nums'],
  },
  valueResetting: {
    color: '#e94560',
  },
  hint: {
    marginTop: 4,
    fontSize: 13,
    color: '#e94560',
    fontStyle: 'italic',
  },
});

export default React.memo(CounterDisplay);
