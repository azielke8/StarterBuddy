import React from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { useTheme } from '../theme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  suffix?: string;
  error?: string;
}

export function TextInput({ label, suffix, error, style, ...rest }: TextInputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.colors.inputBackground,
            borderRadius: theme.radii.sm,
            borderColor: error ? theme.colors.danger : theme.colors.border,
          },
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            { color: theme.colors.text },
            style,
          ]}
          placeholderTextColor={theme.colors.textSecondary}
          {...rest}
        />
        {suffix && (
          <Text style={[styles.suffix, { color: theme.colors.textSecondary }]}>{suffix}</Text>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  suffix: {
    fontSize: 14,
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
