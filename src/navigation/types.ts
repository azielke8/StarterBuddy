import { StorageMode } from '../models/types';

export type OnboardingStackParamList = {
  Welcome: undefined;
  NameStarter: undefined;
  SetHome: { name: string };
  Hydration: { name: string; storageMode: StorageMode };
  FeedingRhythm: { name: string; storageMode: StorageMode; hydration: number };
  Completion: {
    name: string;
    storageMode: StorageMode;
    hydration: number;
    feedIntervalHours: number;
  };
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  StarterDetail: { starterId: string };
  FeedWizard: { starterId: string; goal?: string };
  ConfirmPeak: { starterId: string; starterName: string };
  EditStarter: { mode: 'create' | 'edit'; starterId?: string };
};

export type TimelineStackParamList = {
  TimelineMain: undefined;
};

export type PlannerStackParamList = {
  PlannerMain: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ExportImport: undefined;
  NotificationsSettings: undefined;
  Appearance: undefined;
  Subscription: undefined;
  About: undefined;
};

export type MainTabsParamList = {
  HomeTab: undefined;
  TimelineTab: undefined;
  PlannerTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  ProPaywall: undefined;
};
