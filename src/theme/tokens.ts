export interface ThemeColors {
  background: string;
  card: string;
  primary: string;
  accent: string;
  success: string;
  danger: string;
  text: string;
  textSecondary: string;
  textInverse: string;
  border: string;
  shadow: string;
  tabBarBackground: string;
  tabBarInactive: string;
  inputBackground: string;
  bannerBackground: string;
  overlay: string;
}

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Theme {
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  shadows: {
    card: ThemeShadow;
    button: ThemeShadow;
  };
  typography: {
    headingFamily: string;
    bodyFamily: string;
    sizes: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
    weights: {
      regular: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
    };
  };
  button: {
    height: number;
  };
}

export const lightTheme: Theme = {
  colors: {
    background: '#F4EFE6',
    card: '#FFFFFF',
    primary: '#7A4E2D',
    accent: '#C9972B',
    success: '#6F7D45',
    danger: '#B35C44',
    text: '#3E2A1F',
    textSecondary: '#8A7568',
    textInverse: '#FAF6F1',
    border: '#E5DDD2',
    shadow: '#3E2A1F',
    tabBarBackground: '#FFFFFF',
    tabBarInactive: '#B0A59A',
    inputBackground: '#FAF8F5',
    bannerBackground: '#FDF9F3',
    overlay: 'rgba(62, 42, 31, 0.4)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    sm: 8,
    md: 14,
    lg: 18,
    xl: 20,
    full: 999,
  },
  shadows: {
    card: {
      shadowColor: '#3E2A1F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    button: {
      shadowColor: '#3E2A1F',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  typography: {
    headingFamily: 'Georgia',
    bodyFamily: 'System',
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  button: {
    height: 50,
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: '#1C1612',
    card: '#2A2220',
    primary: '#C9972B',
    accent: '#D4A843',
    text: '#F0E8DF',
    textSecondary: '#9A8E82',
    textInverse: '#1C1612',
    border: '#3A302A',
    tabBarBackground: '#2A2220',
    tabBarInactive: '#6A5E55',
    inputBackground: '#2A2220',
    bannerBackground: '#2A2220',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 3,
    },
    button: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
    },
  },
};
