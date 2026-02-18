import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading } from '../../components/Typography';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NameStarter'>;

export function NameStarterScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Heading style={{ marginBottom: 8 }}>Name your culture</Heading>
        <Subheading style={{ marginBottom: 32 }}>
          Give it something meaningful.
        </Subheading>
        <TextInput
          placeholder="e.g., Marvin, The Elder"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="next"
        />
      </View>
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={() => navigation.navigate('SetHome', { name })}
          disabled={name.trim().length === 0}
        />
      </View>
    </KeyboardAvoidingView>
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
