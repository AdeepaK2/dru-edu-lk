export type ThemeType = 'ben10' | 'tinkerbell' | 'normal';

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
    description: 'Omnitrix-inspired theme with bright greens and dark accents',
    icon: '⚡',
    emoji: '🟢',
    colors: {
      primary: '#64cc4f',      // Bright green from Omnitrix
      primaryLight: '#b2e05b', // Light lime green
      primaryDark: '#222222',  // Dark gray/near black
      secondary: '#222222',    // Dark gray for text/accents
      accent: '#b2e05b',       // Light lime green for highlights
      bgLight: '#f0fdf4',      // Very light green background
      bgDark: '#222222',       // Dark gray/near black background
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
  normal: {
    id: 'normal',
    name: 'Professional',
    description: 'Clean and professional blue theme without characters',
    icon: '🎓',
    emoji: '💼',
    colors: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      primaryDark: '#1e40af',
      secondary: '#ffffff',
      accent: '#6366f1',
      bgLight: '#f8fafc',
      bgDark: '#1e293b',
    },
    characterName: 'Professional Mode',
    characterDescription: 'Focus on learning with a clean, professional interface! 🎓',
  },
};

export const THEME_GRADIENT_MAP: Record<ThemeType, string> = {
  ben10: 'from-[#64cc4f] to-[#222222]',
  tinkerbell: 'from-pink-400 to-purple-600',
  normal: 'from-blue-400 to-indigo-600',
};

export const THEME_HEADER_MAP: Record<ThemeType, string> = {
  ben10: 'from-[#64cc4f] via-[#b2e05b] to-[#222222]',
  tinkerbell: 'from-pink-500 via-pink-600 to-purple-700',
  normal: 'from-blue-500 to-indigo-600',
};

export const THEME_BORDER_MAP: Record<ThemeType, string> = {
  ben10: 'border-[#64cc4f]',
  tinkerbell: 'border-pink-400',
  normal: 'border-blue-400',
};

export const THEME_BG_MAP: Record<ThemeType, string> = {
  ben10: 'from-[#b2e05b] via-[#64cc4f] to-[#222222]',
  tinkerbell: 'from-pink-300 via-pink-400 to-purple-600',
  normal: 'from-blue-300 via-indigo-400 to-indigo-600',
};

export const THEME_BUTTON_MAP: Record<ThemeType, string> = {
  ben10: 'bg-[#64cc4f] hover:bg-[#b2e05b]',
  tinkerbell: 'bg-pink-500 hover:bg-pink-600',
  normal: 'bg-blue-500 hover:bg-blue-600',
};

export const THEME_SUCCESS_MAP: Record<ThemeType, string> = {
  ben10: 'from-[#64cc4f] to-[#b2e05b]',
  tinkerbell: 'from-pink-300 to-purple-300',
  normal: 'from-blue-300 to-indigo-300',
};
