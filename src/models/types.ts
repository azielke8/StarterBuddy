export type StorageMode = 'counter' | 'fridge';
export type EventType = 'FEED' | 'BAKE' | 'DISCARD' | 'NOTE';

export interface Starter {
  id: string;
  name: string;
  photo_uri: string | null;
  flour_type: string;
  hydration_target: number;
  storage_mode: StorageMode;
  preferred_ratio_a: number;
  preferred_ratio_b: number;
  preferred_ratio_c: number;
  default_feed_interval_hours: number;
  baseline_peak_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface StarterEvent {
  id: string;
  starter_id: string;
  type: EventType;
  timestamp: string;
  starter_g: number | null;
  flour_g: number | null;
  water_g: number | null;
  ratio_string: string | null;
  ambient_temp: number | null;
  peak_confirmed_hours: number | null;
  notes: string | null;
}

export interface FeedCalculation {
  starter_g: number;
  flour_g: number;
  water_g: number;
  ratio_string: string;
  estimated_peak_hours: number;
}

export interface ExportData {
  version: number;
  exported_at: string;
  starters: Starter[];
  events: StarterEvent[];
}
