import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Label, Caption } from '../../components/Typography';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { TextInput } from '../../components/TextInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { getStarter, createStarter, updateStarter } from '../../db';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Starter, StorageMode } from '../../models/types';
import { HomeStackParamList } from '../../navigation/types';
import { ensureActiveStarterId } from '../../utils/activeStarter';
import { normalizeHexColor } from '../../utils/colors';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditStarter'>;

const PRESET_COLORS = [
  '#E57373',
  '#F06292',
  '#BA68C8',
  '#7986CB',
  '#64B5F6',
  '#4DB6AC',
  '#81C784',
  '#FFD54F',
  '#FFB74D',
  '#A1887F',
  '#90A4AE',
  '#D4AF37',
];

export function EditStarterScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const { mode, starterId } = route.params;
  const isEdit = mode === 'edit' && starterId;

  const [name, setName] = useState('');
  const [flourType, setFlourType] = useState('All-purpose');
  const [hydration, setHydration] = useState('100');
  const [storageIndex, setStorageIndex] = useState(0);
  const [ratioA, setRatioA] = useState('1');
  const [ratioB, setRatioB] = useState('3');
  const [ratioC, setRatioC] = useState('3');
  const [interval, setInterval] = useState('12');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('');
  const [colorError, setColorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [starterCount, setStarterCount] = useState(0);

  function ratioValue(value: number | null | undefined, fallback: string): string {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return String(value);
  }

  function normalizeColorInput(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return normalizeHexColor(withHash);
  }

  useEffect(() => {
    async function loadActiveStarter() {
      const { activeStarterId: activeId, starterCount: count } = await ensureActiveStarterId(isPro);
      setStarterCount(count);
      setActiveStarterIdState(activeId);
    }
    void loadActiveStarter();

    if (isEdit && starterId) {
      getStarter(starterId).then((s) => {
        if (s) {
          setName(s.name);
          setFlourType(s.flour_type);
          setHydration(String(s.hydration_target));
          setStorageIndex(s.storage_mode === 'fridge' ? 1 : 0);
          setRatioA(ratioValue(s.preferred_ratio_a, '1'));
          setRatioB(ratioValue(s.preferred_ratio_b, '3'));
          setRatioC(ratioValue(s.preferred_ratio_c, '3'));
          setInterval(String(s.default_feed_interval_hours));
          const normalized = normalizeHexColor(s.color ?? null);
          setSelectedColor(normalized);
          setCustomColor(normalized ?? '');
          setColorError(null);
        }
      });
    }
  }, [isEdit, isPro, starterId]);

  async function handleSave() {
    if (isLocked) return;
    const normalizedCustom = normalizeColorInput(customColor);
    const finalColor = customColor.trim().length > 0 ? normalizedCustom : selectedColor;
    if (customColor.trim().length > 0 && !normalizedCustom) {
      setColorError('Enter a valid hex color like #FFAA00');
      return;
    }
    setSaving(true);
    const storageMode: StorageMode = storageIndex === 0 ? 'counter' : 'fridge';
    try {
      if (isEdit && starterId) {
        await updateStarter(starterId, {
          name,
          color: finalColor ?? null,
          flour_type: flourType,
          hydration_target: parseInt(hydration, 10) || 100,
          storage_mode: storageMode,
          preferred_ratio_a: parseInt(ratioA, 10) || 1,
          preferred_ratio_b: parseInt(ratioB, 10) || 3,
          preferred_ratio_c: parseInt(ratioC, 10) || 3,
          default_feed_interval_hours: parseInt(interval, 10) || 12,
        });
      } else {
        await createStarter({
          name,
          color: finalColor ?? null,
          flour_type: flourType,
          hydration_target: parseInt(hydration, 10) || 100,
          storage_mode: storageMode,
          preferred_ratio_a: parseInt(ratioA, 10) || 1,
          preferred_ratio_b: parseInt(ratioB, 10) || 3,
          preferred_ratio_c: parseInt(ratioC, 10) || 3,
          default_feed_interval_hours: parseInt(interval, 10) || 12,
        });
      }
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save starter:', e);
    } finally {
      setSaving(false);
    }
  }
  const isLocked =
    !isPro &&
    starterCount > 1 &&
    !!isEdit &&
    !!starterId &&
    !!activeStarterId &&
    activeStarterId !== starterId;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {isLocked && (
          <Banner
            message={"Multiple cultures are a Pro feature.\nUpgrade to unlock unlimited cultures."}
            variant="info"
            actionLabel="Upgrade"
            onAction={() => navigation.getParent()?.navigate('ProPaywall' as never)}
          />
        )}
        <Heading style={{ marginBottom: 24 }}>
          {isEdit ? 'Edit Culture' : 'New Culture'}
        </Heading>

        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Culture name"
        />
        <TextInput
          label="Flour type"
          value={flourType}
          onChangeText={setFlourType}
          placeholder="All-purpose"
        />
        <TextInput
          label="Target hydration"
          suffix="%"
          value={hydration}
          onChangeText={setHydration}
          keyboardType="number-pad"
        />

        <Label style={{ marginBottom: 8 }}>Storage</Label>
        <SegmentedControl
          options={['Counter', 'Fridge']}
          selectedIndex={storageIndex}
          onSelect={setStorageIndex}
        />

        <View style={{ marginTop: 20 }}>
          <Label style={{ marginBottom: 8 }}>Preferred ratio</Label>
          <View style={styles.ratioRow}>
            <View style={styles.ratioInputWrap}>
              <TextInput
                value={ratioA ?? '1'}
                onChangeText={setRatioA}
                keyboardType="number-pad"
                editable
                style={{ textAlign: 'center' }}
              />
            </View>
            <View style={styles.ratioInputWrap}>
              <TextInput
                value={ratioB ?? '3'}
                onChangeText={setRatioB}
                keyboardType="number-pad"
                editable
                style={{ textAlign: 'center' }}
              />
            </View>
            <View style={styles.ratioInputWrap}>
              <TextInput
                value={ratioC ?? '3'}
                onChangeText={setRatioC}
                keyboardType="number-pad"
                editable
                style={{ textAlign: 'center' }}
              />
            </View>
          </View>
        </View>

        <View style={styles.colorSection}>
          <Label style={{ marginBottom: 8 }}>Color</Label>
          <View style={styles.colorPreviewRow}>
            <View
              style={[
                styles.colorPreview,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: (customColor.trim().length > 0
                    ? normalizeColorInput(customColor)
                    : selectedColor) ?? 'transparent',
                },
              ]}
            />
            <Caption style={{ color: theme.colors.textSecondary }}>
              {(customColor.trim().length > 0 ? normalizeColorInput(customColor) : selectedColor) ??
                'No color selected'}
            </Caption>
          </View>
          <View style={styles.paletteRow}>
            {PRESET_COLORS.map((color) => {
              const isSelected = selectedColor === color && customColor.trim().length === 0;
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedColor(color);
                    setCustomColor('');
                    setColorError(null);
                  }}
                />
              );
            })}
            <TouchableOpacity
              style={[styles.clearColorButton, { borderColor: theme.colors.border }]}
              onPress={() => {
                setSelectedColor(null);
                setCustomColor('');
                setColorError(null);
              }}
            >
              <Caption style={{ color: theme.colors.textSecondary }}>Clear</Caption>
            </TouchableOpacity>
          </View>
          <TextInput
            label="Custom"
            value={customColor}
            onChangeText={(text) => {
              setCustomColor(text);
              const normalized = normalizeColorInput(text);
              if (text.trim().length === 0) {
                setColorError(null);
                return;
              }
              if (!normalized) {
                setColorError('Enter a valid hex color like #FFAA00');
                return;
              }
              setColorError(null);
              setSelectedColor(normalized);
            }}
            placeholder="#FFAA00"
            autoCapitalize="characters"
            autoCorrect={false}
            error={colorError ?? undefined}
          />
        </View>

        <TextInput
          label="Feed interval"
          suffix="hours"
          value={interval}
          onChangeText={setInterval}
          keyboardType="number-pad"
        />

        <Button
          title={isEdit ? 'Save Changes' : 'Create Culture'}
          onPress={handleSave}
          loading={saving}
          disabled={name.trim().length === 0 || isLocked || (customColor.trim().length > 0 && !!colorError)}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratioInputWrap: {
    flex: 1,
  },
  colorSection: {
    marginTop: 4,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  clearColorButton: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
