export type ThemeType = 'default' | 'ben10' | 'tinkerbell' | 'cricketverse' | 'cricketverse-australian' | 'bounceworld' | 'avengers' | 'ponyville';

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
  default: {
    id: 'default',
    name: 'Default',
    description: 'Clean black and white professional theme',
    icon: '⚪',
    emoji: '⚫',
    colors: {
      primary: '#0284c7',      // Primary blue (teacher-style)
      primaryLight: '#60a5fa', // Light blue
      primaryDark: '#0369a1',  // Dark blue
      secondary: '#475569',    // Gray
      accent: '#0ea5e9',       // Accent blue
      bgLight: '#ffffff',      // White background
      bgDark: '#1e293b',       // Dark slate background
    },
    characterName: 'Default Mode',
    characterDescription: 'Clean, professional black and white design',
  },
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
  cricketverse: {
    id: 'cricketverse',
    name: 'CricketVerse',
    description: 'Cricket-inspired blue theme for sports enthusiasts',
    icon: '🏏',
    emoji: '🏏',
    colors: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      primaryDark: '#1e40af',
      secondary: '#ffffff',
      accent: '#6366f1',
      bgLight: '#f8fafc',
      bgDark: '#1e293b',
    },
    characterName: 'CricketVerse Champion',
    characterDescription: 'Hit a six in your learning journey! 🏏',
  },
  'cricketverse-australian': {
    id: 'cricketverse-australian',
    name: 'CricketVerse Australian',
    description: 'Australian cricket-inspired gold and yellow theme',
    icon: '🏏',
    emoji: '🇦🇺',
    colors: {
      primary: '#b38f00',
      primaryLight: '#ffd700',
      primaryDark: '#8b6914',
      secondary: '#ffe000',
      accent: '#daa520',
      bgLight: '#fff8dc',
      bgDark: '#b38f00',
    },
    characterName: 'CricketVerse Australian Champion',
    characterDescription: 'Hit a six down under! 🇦🇺🏏',
  },
  bounceworld: {
    id: 'bounceworld',
    name: 'BounceWorld',
    description: 'Energetic theme with blue and red bounce-inspired colors',
    icon: '🏀',
    emoji: '🏀',
    colors: {
      primary: '#1D428A',
      primaryLight: '#3B82F6',
      primaryDark: '#1e3a8a',
      secondary: '#C8102E',
      accent: '#ef4444',
      bgLight: '#ffffff',
      bgDark: '#1D428A',
    },
    characterName: 'BounceWorld Explorer',
    characterDescription: 'Bounce your way to knowledge! 🏀',
  },
  avengers: {
    id: 'avengers',
    name: 'Avengers',
    description: 'Heroic theme with midnight blue and mystical colors',
    icon: '🦸‍♂️',
    emoji: '⚡',
    colors: {
      primary: '#2C1267',
      primaryLight: '#604AC7',
      primaryDark: '#0F0826',
      secondary: '#C88DA5',
      accent: '#4F2C8D',
      bgLight: '#f8fafc',
      bgDark: '#0F0826',
    },
    characterName: 'Avengers Hero',
    characterDescription: 'Assemble your knowledge like a true hero! 🦸‍♂️',
  },
  ponyville: {
    id: 'ponyville',
    name: 'Ponyville Funland',
    description: 'Playful pink theme inspired by Ponyville — bright, fun and cheerful',
    icon: '🦄',
    emoji: '🩷',
    colors: {
      primary: '#e13690',      // main vibrant pink
      primaryLight: '#ff2e9f', // bright pink
      primaryDark: '#f1aed5',  // soft pastel pink
      secondary: '#ffffff',    // white for accents
      accent: '#ff2e9f',       // bright accent
      bgLight: '#fff5fb',      // very light pink background
      bgDark: '#5a0033',       // deep complementary dark (used rarely)
    },
    characterName: 'Ponyville Funland',
    characterDescription: 'Gallop into learning with cotton-candy colors and smiles! 🦄',
  },
};

export const THEME_GRADIENT_MAP: Record<ThemeType, string> = {
  default: 'from-blue-600 to-indigo-600',
  ben10: 'from-[#64cc4f] to-[#222222]',
  tinkerbell: 'from-pink-400 to-purple-600',
  cricketverse: 'from-blue-400 to-indigo-600',
  'cricketverse-australian': 'from-[#b38f00] to-[#ffe000]',
  bounceworld: 'from-[#1D428A] to-[#C8102E]',
  avengers: 'from-[#2C1267] to-[#4F2C8D]',
  ponyville: 'from-[#f1aed5] to-[#ff2e9f]',
};

export const THEME_HEADER_MAP: Record<ThemeType, string> = {
  default: 'from-blue-600 via-indigo-700 to-indigo-900',
  ben10: 'from-[#64cc4f] via-[#b2e05b] to-[#222222]',
  tinkerbell: 'from-pink-500 via-pink-600 to-purple-700',
  cricketverse: 'from-blue-500 to-indigo-600',
  'cricketverse-australian': 'from-[#b38f00] via-[#ffd700] to-[#8b6914]',
  bounceworld: 'from-[#1D428A] via-white to-[#C8102E]',
  avengers: 'from-[#2C1267] via-[#604AC7] to-[#0F0826]',
  ponyville: 'from-[#f1aed5] via-[#ff2e9f] to-[#e13690]',
};

export const THEME_BORDER_MAP: Record<ThemeType, string> = {
  default: 'border-gray-200',
  ben10: 'border-[#64cc4f]',
  tinkerbell: 'border-pink-400',
  cricketverse: 'border-blue-400',
  'cricketverse-australian': 'border-[#b38f00]',
  bounceworld: 'border-[#1D428A]',
  avengers: 'border-[#2C1267]',
  ponyville: 'border-black',
};

export const THEME_BG_MAP: Record<ThemeType, string> = {
  default: 'from-blue-400 to-indigo-600',
  ben10: 'from-[#b2e05b] via-[#64cc4f] to-[#222222]',
  tinkerbell: 'from-pink-300 via-pink-400 to-purple-600',
  cricketverse: 'from-blue-300 via-indigo-400 to-indigo-600',
  'cricketverse-australian': 'from-[#ffe000] via-[#ffd700] to-[#b38f00]',
  bounceworld: 'from-white via-[#1D428A] to-[#C8102E]',
  avengers: 'from-[#604AC7] via-[#2C1267] to-[#0F0826]',
  ponyville: 'from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]',
};

export const THEME_BUTTON_MAP: Record<ThemeType, string> = {
  default: 'bg-primary-600 hover:bg-primary-700',
  ben10: 'bg-[#64cc4f] hover:bg-[#b2e05b]',
  tinkerbell: 'bg-pink-500 hover:bg-pink-600',
  cricketverse: 'bg-blue-500 hover:bg-blue-600',
  'cricketverse-australian': 'bg-[#b38f00] hover:bg-[#daa520]',
  bounceworld: 'bg-[#1D428A] hover:bg-[#C8102E]',
  avengers: 'bg-[#2C1267] hover:bg-[#604AC7]',
  ponyville: 'bg-[#e13690] hover:bg-[#ff2e9f]',
};

export const THEME_SUCCESS_MAP: Record<ThemeType, string> = {
  default: 'from-blue-300 to-indigo-300',
  ben10: 'from-[#64cc4f] to-[#b2e05b]',
  tinkerbell: 'from-pink-300 to-purple-300',
  cricketverse: 'from-blue-300 to-indigo-300',
  'cricketverse-australian': 'from-[#b38f00] to-[#ffd700]',
  bounceworld: 'from-[#1D428A] to-white',
  avengers: 'from-[#604AC7] to-[#C88DA5]',
  ponyville: 'from-[#ff2e9f] to-[#f1aed5]',
};
