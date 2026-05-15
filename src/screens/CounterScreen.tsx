import React, { useCallback, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CounterButtons from '../components/CounterButtons';
import CounterDisplay from '../components/CounterDisplay';
import HistoryList from '../components/HistoryList';
import { useCounter } from '../hooks/useCounter';
import { useNativeCounter } from '../hooks/useNativeCounter';

type Mode = 'js' | 'native';

function CounterScreen(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('js');

  const js = useCounter();
  const native = useNativeCounter();

  // Choose the active implementation.
  const counter = mode === 'js' ? js : native;

  const handleIncrement = useCallback(() => {
    counter.increment();
  }, [counter]);

  const handleDecrement = useCallback(() => {
    counter.decrement();
  }, [counter]);

  const handleReset = useCallback(() => {
    counter.reset();
  }, [counter]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Counter App</Text>
          <Text style={styles.subtitle}>React Native + TurboModule</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'js' && styles.toggleActive]}
            onPress={() => setMode('js')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleLabel,
                mode === 'js' && styles.toggleLabelActive,
              ]}>
              JS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              mode === 'native' && styles.toggleActive,
            ]}
            onPress={() => setMode('native')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleLabel,
                mode === 'native' && styles.toggleLabelActive,
              ]}>
              Native (TurboModule)
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'native' && !native.isAvailable && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ TurboModule not available on{' '}
              {Platform.OS === 'ios' ? 'this build' : 'Android'}.
              {'\n'}Run on a physical/simulator iOS build with TurboModule
              compiled in.
            </Text>
          </View>
        )}

        {/* Display */}
        <CounterDisplay
          value={counter.value}
          isResetting={counter.isResetting}
        />

        {/* Buttons */}
        <CounterButtons
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onReset={handleReset}
          onIncrementLongPress={counter.startLongPressIncrement}
          onIncrementPressOut={counter.stopLongPress}
          isResetting={counter.isResetting}
          value={counter.value}
        />

        {/* History */}
        <HistoryList history={counter.history} />

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Behaviors</Text>
          <Text style={styles.legendItem}>
            {'→ '}Every 5th increment adds +5
          </Text>
          <Text style={styles.legendItem}>
            {'→ '}Decrement stops at 0
          </Text>
          <Text style={styles.legendItem}>
            {'→ '}Auto-decrement after 3 s idle
          </Text>
          <Text style={styles.legendItem}>
            {'→ '}Reset steps down gradually
          </Text>
          <Text style={styles.legendItem}>
            {'→ '}Hold + for rapid increment
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  scroll: {
    paddingBottom: 40,
    gap: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#eee',
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#16213e',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  toggleLabelActive: {
    color: '#fff',
  },
  warningBox: {
    marginHorizontal: 24,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f0ad4e',
  },
  warningText: {
    fontSize: 12,
    color: '#7d5a00',
    lineHeight: 18,
  },
  legend: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  legendItem: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
});

export default CounterScreen;
