# StarterBuddy

A sourdough starter tracking app for iOS. Built with Expo React Native (TypeScript).

## Setup

```bash
npm install
```

## Running

```bash
npx expo start
```

Press `i` to open in the iOS Simulator.

## Configuration

### AdMob

In `app.json`, replace the `iosAppId` under `react-native-google-mobile-ads` with your AdMob iOS app ID:

```json
["react-native-google-mobile-ads", {
  "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
}]
```

The ad banner unit ID should be set in the `HomeScreen` component where the ad loads.

### RevenueCat

In `src/contexts/SubscriptionContext.tsx`, replace `YOUR_REVENUECAT_IOS_API_KEY` with your RevenueCat public API key. Configure the `bakers_table` entitlement in the RevenueCat dashboard.

## Architecture

```
src/
  components/     Shared UI: Card, Button, Typography, Banner, SegmentedControl, TextInput
  contexts/       SubscriptionContext (RevenueCat state)
  db/             SQLite database, migrations, starter + event repositories
  models/         TypeScript interfaces (Starter, StarterEvent, FeedCalculation)
  navigation/     React Navigation: Root, Onboarding, Home, Timeline, Planner, Settings stacks
  screens/        All screen components grouped by navigation area
  services/       Notification scheduling
  theme/          Semantic design tokens, ThemeProvider, light + dark themes
  utils/          Feed calculations, ratio suggestions, peak modeling
  __tests__/      Unit tests
```

## Product Tiers

**Starter Kit (Free):** 1 starter, feed wizard, notifications, basic peak modeling, banner ad on dashboard, light mode only.

**Baker's Table (Pro):** Unlimited starters, ad-free, dark mode, levain planner, export/import.

## Tests

```bash
npx jest
```

Covers feed calculations, ratio suggestion mapping, rolling average peak updates, duration formatting, and peak status detection.

## Data

All data is stored locally in SQLite (`starterbuddy.db`). Export/import uses JSON files via the iOS share sheet.
