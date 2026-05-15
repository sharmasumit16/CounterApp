import React from 'react';
import { StatusBar } from 'react-native';
import CounterScreen from './src/screens/CounterScreen';

function App(): React.JSX.Element {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fafafa" />
      <CounterScreen />
    </>
  );
}

export default App;
