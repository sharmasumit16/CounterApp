import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

interface Props {
  history: number[];
}

function HistoryItem({
  item,
  index,
}: {
  item: number;
  index: number;
}): React.JSX.Element {
  return (
    <View style={[styles.item, index === 0 && styles.itemLatest]}>
      <Text style={[styles.itemText, index === 0 && styles.itemTextLatest]}>
        {item}
      </Text>
    </View>
  );
}

const MemoHistoryItem = React.memo(HistoryItem);

function HistoryList({ history }: Props): React.JSX.Element | null {
  if (history.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Recent values</Text>
      <FlatList
        data={history}
        horizontal
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <MemoHistoryItem item={item} index={index} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  list: {
    gap: 8,
    paddingBottom: 4,
  },
  item: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemLatest: {
    backgroundColor: '#16213e',
    borderColor: '#16213e',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    fontVariant: ['tabular-nums'],
  },
  itemTextLatest: {
    color: '#fff',
  },
});

export default React.memo(HistoryList);
