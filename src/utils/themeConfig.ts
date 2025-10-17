export type ThemeType = 'ben10' | 'tinkerbell';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  description: string;
  icon: string;
  emoji: string;
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    bgLight: string;
    bgDark: string;
  };
  characterName: string;
  characterDescription: string;
}

export const THEMES: Record<ThemeType, ThemeConfig> = {
  ben10: {
    id: 'ben10',
    name: 'Ben 10 Hero',
    description: 'Green and black theme inspired by Ben 10\'s Omnitrix',
    icon: '⚡',
    emoji: '🟢',
    colors: {
      primary: '#22c55e',
      primaryLight: '#4ade80',
      primaryDark: '#16a34a',
      secondary: '#000000',
      accent: '#84cc16',
      bgLight: '#f0fdf4',
      bgDark: '#1b4332',
    },
    characterName: 'Ben 10 - Hero Mode',
    characterDescription: 'Transform and learn with the power of the Omnitrix! ⚡',
  },
  tinkerbell: {
    id: 'tinkerbell',
    name: 'Tinkerbell Magic',
    description: 'Pink and purple theme inspired by Tinkerbell fairy magic',
    icon: '✨',
    emoji: '🩷',
    colors: {
      primary: '#ec4899',
      primaryLight: '#f472b6',
      primaryDark: '#be185d',
      secondary: '#7c3aed',
      accent: '#a855f7',
      bgLight: '#fef2f8',
      bgDark: '#500724',
    },
    characterName: 'Tinkerbell - Fairy',
    characterDescription: 'Sprinkle some magic into your learning! ✨',
  },
};

export const THEME_GRADIENT_MAP: Record<ThemeType, string> = {
  ben10: 'from-green-400 to-black',
  tinkerbell: 'from-pink-400 to-purple-600',
};

export const THEME_HEADER_MAP: Record<ThemeType, string> = {
  ben10: 'from-green-600 via-green-700 to-black',
  tinkerbell: 'from-pink-500 via-pink-600 to-purple-700',
};

export const THEME_BORDER_MAP: Record<ThemeType, string> = {
  ben10: 'border-green-400',
  tinkerbell: 'border-pink-400',
};

export const THEME_BG_MAP: Record<ThemeType, string> = {
  ben10: 'from-green-300 via-green-400 to-black',
  tinkerbell: 'from-pink-300 via-pink-400 to-purple-600',
};

export const THEME_BUTTON_MAP: Record<ThemeType, string> = {
  ben10: 'bg-green-500 hover:bg-green-600',
  tinkerbell: 'bg-pink-500 hover:bg-pink-600',
};

export const THEME_SUCCESS_MAP: Record<ThemeType, string> = {
  ben10: 'from-green-300 to-emerald-300',
  tinkerbell: 'from-pink-300 to-purple-300',
};
