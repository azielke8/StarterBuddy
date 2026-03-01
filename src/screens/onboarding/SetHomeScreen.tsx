import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading } from '../../components/Typography';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { OnboardingStackParamList } from '../../navigation/types';
import { StorageMode } from '../../models/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetHome'>;

const STORAGE_OPTIONS = ['Counter', 'Fridge'];

export function SetHomeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { name } = route.params;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const storageMode: StorageMode = selectedIndex === 0 ? 'counter' : 'fridge';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Heading style={{ marginBottom: 8 }}>Where does it live?</Heading>
        <Subheading style={{ marginBottom: 32 }}>
          This determines how often it needs refreshment.
        </Subheading>
        <SegmentedControl
          options={STORAGE_OPTIONS}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </View>
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={() => navigation.navigate('Hydration', { name, storageMode })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
});
