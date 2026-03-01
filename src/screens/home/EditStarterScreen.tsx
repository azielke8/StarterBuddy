import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Label } from '../../components/Typography';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { TextInput } from '../../components/TextInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { getStarter, createStarter, updateStarter } from '../../db';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Starter, StorageMode } from '../../models/types';
import { HomeStackParamList } from '../../navigation/types';
import { ensureActiveStarterId } from '../../utils/activeStarter';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditStarter'>;

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
  const [saving, setSaving] = useState(false);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [starterCount, setStarterCount] = useState(0);

  function ratioValue(value: number | null | undefined, fallback: string): string {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return String(value);
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
        }
      });
    }
  }, [isEdit, isPro, starterId]);

  async function handleSave() {
    if (isLocked) return;
    setSaving(true);
    const storageMode: StorageMode = storageIndex === 0 ? 'counter' : 'fridge';
    try {
      if (isEdit && starterId) {
        await updateStarter(starterId, {
          name,
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
          disabled={name.trim().length === 0 || isLocked}
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
});
