'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, KeyRound, Camera, Star, Sparkles, Palette } from 'lucide-react';
import Image from 'next/image';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';
import { useTheme, type ThemeType } from '@/contexts/ThemeContext';
import { THEMES } from '@/utils/themeConfig';

interface StudentProfileData {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  avatar: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  match: boolean;
}

interface LoadingState {
  profile: boolean;
  password: boolean;
}

// Ben 10 Hero themed avatars - Omnitrix Animals
const ben10Avatars = [
  {
    id: 'heatblast',
    name: 'Heatblast',
    image: '/heatblast.png',
    description: 'Pyronite from Pyros - Master of fire!',
    colors: 'from-red-500 to-orange-500'
  },
  {
    id: 'wildmutt',
    name: 'Wildmutt',
    image: '/Wildmutt.png',
    description: 'Vulpimancer from Vulpin - The beast within!',
    colors: 'from-gray-600 to-gray-800'
  },
  {
    id: 'diamondhead',
    name: 'Diamondhead',
    image: '/Diamondhead.png',
    description: 'Petrosapien from Petropia - Crystal warrior!',
    colors: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'ghostfreak',
    name: 'Ghostfreak',
    image: '/ghostfreak.png',
    description: 'Ectonurite from Anur Phaetos - Spirit walker!',
    colors: 'from-purple-600 to-indigo-700'
  },
  {
    id: 'benwolf',
    name: 'Benwolf',
    image: '/benwolf.png',
    description: 'Anur Transyl\'s werewolf form - Lunar hunter!',
    colors: 'from-yellow-600 to-orange-600'
  }
];

// Tinkerbell themed avatars
const tinkerbellAvatars = [
  {
    id: 'silvermist',
    name: 'Silvermist',
    image: '/silvermist.png',
    description: 'Water fairy — calm and graceful',
    colors: 'from-blue-300 to-cyan-300'
  },
  {
    id: 'fawn',
    name: 'Fawn',
    image: '/Fawn.png',
    description: 'Animal fairy — playful and brave',
    colors: 'from-amber-300 to-orange-400'
  },
  {
    id: 'iridessa',
    name: 'Iridessa',
    image: '/Iridessa .png',
    description: 'Light fairy — bright and clever',
    colors: 'from-yellow-300 to-amber-400'
  },
  {
    id: 'rosetta',
    name: 'Rosetta',
    image: '/Rosetta.png',
    description: 'Garden fairy — warm and nurturing',
    colors: 'from-rose-300 to-pink-400'
  },
  {
    id: 'tinkerbell',
    name: 'Tinkerbell',
    image: '/tinkerbell.png',
    description: 'The pixie herself — curious and loyal',
    colors: 'from-green-300 to-yellow-300'
  }
];

// BounceWorld themed avatars - Basketball Champions
const bounceworldAvatars = [
  {
    id: 'lebron',
    name: 'LeBron James',
    image: '/bounceworld/LeBron James.webp',
    description: 'King James — unstoppable force on the court!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'steph',
    name: 'Stephen Curry',
    image: '/bounceworld/Stephen Curry.webp',
    description: 'Chef Curry — master of the three-point shot!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'kd',
    name: 'Kevin Durant',
    image: '/bounceworld/Kevin Durant.webp',
    description: 'The Slim Reaper — smooth scorer and defender!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'jayson',
    name: 'Jayson Tatum',
    image: '/bounceworld/Jayson Tatum.webp',
    description: 'Jaylen Brown\'s partner — clutch performer!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'joel',
    name: 'Joel Embiid',
    image: '/bounceworld/Joel Embiid.webp',
    description: 'The Process — dominant center and scorer!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'anthony',
    name: 'Anthony Davis',
    image: '/bounceworld/Anthony Davis.webp',
    description: 'The Brow — versatile big man extraordinaire!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'devin',
    name: 'Devin Booker',
    image: '/bounceworld/Devin Booker.webp',
    description: 'Book — high-flying scorer and playmaker!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'jrue',
    name: 'Jrue Holiday',
    image: '/bounceworld/Jrue Holiday.webp',
    description: 'Jrue — lockdown defender and facilitator!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'derrick',
    name: 'Derrick White',
    image: '/bounceworld/Derrick White.webp',
    description: 'The Secretary of Defense — elite perimeter defender!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'tyrese',
    name: 'Tyrese Haliburton',
    image: '/bounceworld/Tyrese Haliburton.webp',
    description: 'The Halo Effect — sharpshooting point god!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'ant',
    name: 'Anthony Edwards',
    image: '/bounceworld/Anthony Edwards.webp',
    description: 'Ant-Man — explosive scorer and athlete!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  },
  {
    id: 'bam',
    name: 'Bam Adebayo',
    image: '/bounceworld/Bam Adebayowebp.webp',
    description: 'Bam — versatile forward and rebounding machine!',
    colors: 'from-[#1D428A] to-[#C8102E]'
  }
];

// Avengers themed avatars - Super Heroes
const avengersAvatars = [
  {
    id: 'ironman',
    name: 'Iron Man',
    image: '/avengers/Iron Man.png',
    description: 'Tony Stark — genius billionaire playboy philanthropist!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'captainamerica',
    name: 'Captain America',
    image: '/avengers/captain-america.png',
    description: 'Steve Rogers — the first Avenger, symbol of hope!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'thor',
    name: 'Thor',
    image: '/avengers/thor.png',
    description: 'God of Thunder — wielder of Mjolnir!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'hulk',
    name: 'Hulk',
    image: '/avengers/hulk.png',
    description: 'Bruce Banner — you won\'t like him when he\'s angry!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'spiderman',
    name: 'Spider-Man',
    image: '/avengers/spiderman.png',
    description: 'Peter Parker — your friendly neighborhood superhero!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'batman',
    name: 'Batman',
    image: '/avengers/batman.png',
    description: 'Bruce Wayne — the Dark Knight of Gotham!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'superman',
    name: 'Superman',
    image: '/avengers/supermanpng.png',
    description: 'Clark Kent — Man of Steel, faster than a speeding bullet!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  },
  {
    id: 'wonderwoman',
    name: 'Wonder Woman',
    image: '/avengers/wonder-women.png',
    description: 'Diana Prince — Amazon warrior princess!',
    colors: 'from-[#2C1267] to-[#604AC7]'
  }
];

// CricketVerse themed avatars - Cricket Champions
const cricketverseAvatars = [
  {
    id: 'adam-zampa',
    name: 'Adam Zampa',
    image: '/cricketverse/Adam Zampa.webp',
    description: 'The Spin Wizard — leg-spinner extraordinaire!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'alex-carey',
    name: 'Alex Carey',
    image: '/cricketverse/Alex Carey.webp',
    description: 'The Wicketkeeper — agile and explosive batsman!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'cameron-green',
    name: 'Cameron Green',
    image: '/cricketverse/Cameron Green.webp',
    description: 'The All-rounder — powerful batsman and bowler!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'glenn-maxwell',
    name: 'Glenn Maxwell',
    image: '/cricketverse/Glenn Maxwell.webp',
    description: 'The Big Show — finisher and six-hitter!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'josh-hazlewood',
    name: 'Josh Hazlewood',
    image: '/cricketverse/Josh Hazlewood.webp',
    description: 'The Pacer — relentless fast bowler!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'josh-inglis',
    name: 'Josh Inglis',
    image: '/cricketverse/Josh Inglis.webp',
    description: 'The Opener — aggressive top-order batsman!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'lance-morris',
    name: 'Lance Morris',
    image: '/cricketverse/Lance Morris.webp',
    description: 'The Speedster — rising pace sensation!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'matthew-short',
    name: 'Matthew Short',
    image: '/cricketverse/Matthew Short.webp',
    description: 'The Batsman — solid middle-order player!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'mitchell-starc',
    name: 'Mitchell Starc',
    image: '/cricketverse/Mitchell Starc.webp',
    description: 'The Left-armer — swing king and yorker master!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'nathan-ellis',
    name: 'Nathan Ellis',
    image: '/cricketverse/Nathan Ellis.webp',
    description: 'The Fast Bowler — pace and bounce specialist!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'travis-head',
    name: 'Travis Head',
    image: '/cricketverse/Travis Head.webp',
    description: 'The Opener — dynamic and destructive batsman!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'usman-khawaja',
    name: 'Usman Khawaja',
    image: '/cricketverse/Usman Khawaja.webp',
    description: 'The Test Specialist — technically sound batsman!',
    colors: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'xavier-bartlett',
    name: 'Xavier Bartlett',
    image: '/cricketverse/Xavier Bartlett.webp',
    description: 'The Newcomer — promising pace bowler!',
    colors: 'from-blue-500 to-indigo-600'
  }
];

// Ponyville themed avatars - Magical Unicorns
const ponyvilleAvatars = [
  {
    id: 'applejack',
    name: 'Applejack',
    image: '/ponyville/applejack.png',
    description: 'The Honest Farmer — hardworking and dependable earth pony!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  },
  {
    id: 'pinkie',
    name: 'Pinkie Pie',
    image: '/ponyville/pinky pie.png',
    description: 'The Party Pony — brings joy and laughter everywhere!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  },
  {
    id: 'luna',
    name: 'Princess Luna',
    image: '/ponyville/princesluna.png',
    description: 'The Princess of the Night — guardian of dreams and magic!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  },
  {
    id: 'rainbow',
    name: 'Rainbow Dash',
    image: '/ponyville/rainbow-dash.png',
    description: 'The Fastest Flyer — loyal and adventurous pegasus!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  },
  {
    id: 'rarity',
    name: 'Rarity',
    image: '/ponyville/rarity.png',
    description: 'The Fashionista — elegant and generous unicorn!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  },
  {
    id: 'sweetie',
    name: 'Sweetie Belle',
    image: '/ponyville/sweetybelle.png',
    description: 'The Young Unicorn — aspiring fashion designer and friend!',
    colors: 'from-[#f1aed5] to-[#e13690]'
  }
];

export default function StudentSettingsPage() {
  const { student, loading: authLoading, refreshStudent } = useStudentAuth();

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    profile: false,
    password: false
  });

  // Profile form state
  const [profileData, setProfileData] = useState<StudentProfileData>({
    name: '',
    email: '',
    phone: '',
    countryCode: '+61',
    avatar: 'heatblast' // Default avatar
  });

  // Avatar selection state
  const [selectedAvatar, setSelectedAvatar] = useState<string>('heatblast');
  const [showAvatarSelector, setShowAvatarSelector] = useState<boolean>(false);

  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    match: false
  });

  // Message state for success/error notifications
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Theme state
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>(theme);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Initialize profile data when student data is available
  useEffect(() => {
    if (student) {
      // Determine sensible default avatar based on current theme
      let defaultAvatar = '';
      if (selectedTheme === 'tinkerbell' || theme === 'tinkerbell') {
        defaultAvatar = student.avatar || 'silvermist';
      } else if (selectedTheme === 'ben10' || theme === 'ben10') {
        defaultAvatar = student.avatar || 'heatblast';
      } else if (selectedTheme === 'bounceworld' || theme === 'bounceworld') {
        defaultAvatar = student.avatar || 'lebron';
      } else if (selectedTheme === 'avengers' || theme === 'avengers') {
        defaultAvatar = student.avatar || 'ironman'; // Default to Iron Man for Avengers theme
      } else if (selectedTheme === 'cricketverse' || theme === 'cricketverse') {
        defaultAvatar = student.avatar || 'virat'; // Default to Virat Kohli for CricketVerse theme
      } else if (selectedTheme === 'ponyville' || theme === 'ponyville') {
        defaultAvatar = student.avatar || 'twilight'; // Default to Twilight Sparkle for Ponyville theme
      } else {
        // default theme: avatars disabled
        defaultAvatar = '';
      }

      setProfileData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        countryCode: '+61', // Default to Australia
        avatar: defaultAvatar
      });
      setSelectedAvatar(defaultAvatar);
    }
  }, [student, selectedTheme, theme]);

  // Initialize theme state
  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleAvatarSelect = async (avatarId: string) => {
    setSelectedAvatar(avatarId);
    setProfileData(prev => ({
      ...prev,
      avatar: avatarId
    }));
    setShowAvatarSelector(false);

    // Persist avatar change immediately so DB stays in sync
    if (!student || !student.id) return;

    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const studentRef = doc(firestore, 'students', student.id);
      await updateDoc(studentRef, { avatar: avatarId });
      await refreshStudent();
      setMessage({ type: 'success', text: 'Avatar updated successfully!' });
    } catch (err) {
      console.error('Failed to update avatar:', err);
      setMessage({ type: 'error', text: 'Failed to save avatar. Please try again.' });
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const getAvailableAvatars = () => {
    if (selectedTheme === 'tinkerbell' || theme === 'tinkerbell') return tinkerbellAvatars;
    if (selectedTheme === 'ben10' || theme === 'ben10') return ben10Avatars;
    if (selectedTheme === 'bounceworld' || theme === 'bounceworld') return bounceworldAvatars;
    if (selectedTheme === 'avengers' || theme === 'avengers') return avengersAvatars;
    if (selectedTheme === 'cricketverse' || theme === 'cricketverse') return cricketverseAvatars;
    if (selectedTheme === 'ponyville' || theme === 'ponyville') return ponyvilleAvatars;
    return [];
  };

  const getSelectedAvatarData = () => {
    const list = getAvailableAvatars();
    return list.find(avatar => avatar.id === selectedAvatar) || { id: '', name: '', image: '/images/1.png', description: '' };
  };

  const handleThemeChange = (newTheme: ThemeType) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
    setMessage({ type: 'success', text: `Theme changed to ${THEMES[newTheme].name}! 🎨` });
  };

  const handleProfileInputChange = (field: keyof StudentProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordInputChange = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate password in real-time
    if (field === 'newPassword' || field === 'confirmPassword') {
      const newPassword = field === 'newPassword' ? value : passwordData.newPassword;
      const confirmPassword = field === 'confirmPassword' ? value : passwordData.confirmPassword;
      
      setPasswordValidation({
        minLength: newPassword.length >= 8,
        hasUppercase: /[A-Z]/.test(newPassword),
        hasLowercase: /[a-z]/.test(newPassword),
        hasNumber: /\d/.test(newPassword),
        hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
        match: newPassword === confirmPassword && newPassword.length > 0
      });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setLoading(prev => ({ ...prev, profile: true }));

    try {
      // Update student profile in Firestore (excluding email)
      const studentRef = doc(firestore, 'students', student.id);
      await updateDoc(studentRef, {
        name: profileData.name,
        phone: `${profileData.countryCode}${profileData.phone}`,
        avatar: profileData.avatar
      });
      
      alert('Profile updated successfully!');
      // Refresh student data
      await refreshStudent();
      setMessage({ type: 'success', text: theme === 'bounceworld' ? 'Your slam dunk profile has been updated! 🏀' : theme === 'avengers' ? 'Your heroic profile has been updated! 🦸‍♂️' : theme === 'ponyville' ? 'Your magical profile has been transformed! 🦄' : 'Your heroic profile has been updated! 🎉' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: theme === 'bounceworld' ? 'Oops! Failed to update your profile. Try again! 🏀' : theme === 'avengers' ? 'Oops! Failed to update your profile. Assemble again! 🦸‍♂️' : theme === 'ponyville' ? 'Oops! Failed to transform your profile. Try again with magic! 🦄' : 'Oops! Failed to update your profile. Please try again. 😅' });
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(prev => ({ ...prev, password: true }));

    try {
      // Re-authenticate the user before changing password
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);
      
      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setMessage({ type: 'success', text: theme === 'bounceworld' ? 'Your slam dunk password has been changed! 🔐🏀' : theme === 'avengers' ? 'Your heroic password has been changed! 🔐🦸‍♂️' : theme === 'ponyville' ? 'Your magical password has been transformed! 🔐🦄' : 'Your hero password has been changed! 🔐⚡' });
    } catch (error) {
      console.error('Error updating password:', error);
      
      // Handle specific errors
      if ((error as any).code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: theme === 'bounceworld' ? 'Oops! Your current password is incorrect. Try again! 🔑' : theme === 'avengers' ? 'Oops! Your current password is incorrect. Assemble again! 🔑🦸‍♂️' : theme === 'ponyville' ? 'Oops! Your current password is incorrect. Try again with magic! 🔑🦄' : 'Oops! Your current password is incorrect. Please try again. 🔑' });
      } else {
        setMessage({ type: 'error', text: theme === 'bounceworld' ? 'Oops! Failed to update your password. Try again! 🏀' : theme === 'avengers' ? 'Oops! Failed to update your password. Assemble again! 🦸‍♂️' : theme === 'ponyville' ? 'Oops! Failed to transform your password. Try again with magic! 🦄' : 'Oops! Failed to update your password. Please try again. 😅' });
      }
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'bg-gradient-to-br from-white via-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-br from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'bg-gradient-to-br from-gray-100 to-gray-200'} flex items-center justify-center`}>
        <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-2xl">
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}

            {/* BounceWorld Loading Animation */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <img
                  src="/bounceworld.gif"
                  alt="BounceWorld Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}

            {/* Avengers Loading Animation */}
            {theme === 'avengers' && (
              <div className="flex flex-col items-center">
                <img
                  src="/avenger.gif"
                  alt="Avengers Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling</span>
              </div>
            )}

            {/* CricketVerse Loading GIF */}
            {theme === 'cricketverse' && (
              <div className="flex flex-col items-center">
                <img
                  src="/batsman.gif"
                  alt="CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-blue-600 mt-4">Loading</span>
              </div>
            )}

            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Loading</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && theme !== 'ponyville' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-black mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">{theme === 'avengers' ? 'Assembling Settings...' : theme === 'ponyville' ? 'Transforming Settings...' : 'Loading Settings...'}</h2>
            <p className="text-gray-600 font-medium">{theme === 'bounceworld' ? 'Get ready to slam dunk your settings! 🏀' : theme === 'avengers' ? 'Get ready to assemble your settings! 🦸‍♂️' : theme === 'ponyville' ? 'Get ready to transform your settings with magic! 🦄' : 'Get ready to transform your learning!'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400">
          You need to be logged in to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br p-6 ${theme === 'ben10' ? '' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-400' : theme === 'bounceworld' ? 'from-white via-[#1D428A]/10 to-[#C8102E]/10' : theme === 'avengers' ? 'from-[#2C1267]/10 via-[#604AC7]/10 to-[#0F0826]/10' : theme === 'ponyville' ? 'from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : theme === 'cricketverse' ? 'from-blue-400 to-indigo-600' : 'from-gray-100 to-gray-200'}`} style={theme === 'ben10' ? { background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))' } : undefined}>
      <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header - Theme Aware */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]' : theme === 'tinkerbell' ? 'from-green-500 via-yellow-500 to-green-600' : theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690]' : theme === 'cricketverse' ? 'from-blue-400 to-indigo-600' : 'from-gray-100 to-gray-200'} rounded-2xl text-white p-8 border-2 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#ff2e9f]' : theme === 'cricketverse' ? 'border-blue-600' : 'border-black'} relative overflow-hidden`}>

        
   
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              
              <div>
                <h1 className={`text-3xl font-bold ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : 'text-black'}`}>
                  {theme === 'avengers' ? '🦸 Avengers Command Center' : theme === 'ponyville' ? '🦄 Ponyville Funland Settings' : 'Setting Page'}
                </h1>
                <p className={`${theme === 'ben10' ? 'text-black' : theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : 'text-black'} text-lg font-semibold mt-2`}>
                  {theme === 'avengers' ? 'Assemble your perfect learning experience!' : theme === 'ponyville' ? 'Transform your learning with magical settings!' : 'Customize your learning profile!'}
                </p>
              </div>
            </div>
            <p className="text-black mb-4 text-base">
              {theme === 'avengers' ? 'Choose your favorite superhero theme and assemble your learning powers!' : theme === 'ponyville' ? 'Choose your favorite magical pony and transform your learning experience!' : 'Choose your favorite theme and character to make learning more fun!'}
            </p>
          </div>
          <div className="hidden md:block">
            {/* Current Avatar Display (only for themes that support avatars) */}
            {getAvailableAvatars().length > 0 && (
              <div className="relative">
                <div className={`relative w-24 h-24 rounded-full overflow-hidden border-4 border-white bg-white flex items-center justify-center`}>
                  <Image src={getSelectedAvatarData().image || '/images/1.png'} alt={getSelectedAvatarData().name} fill className="object-contain object-center" />
                </div>
                <div className="text-center mt-5">
                  <span className="text-white font-bold text-sm">{getSelectedAvatarData().name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error Messages - Theme Aware */}
      {message && (
        <div className={`rounded-xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : 'border-black'} p-4 shadow-lg ${
          message.type === 'success' 
            ? `${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-green-300' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#604AC7] to-[#2C1267]' : 'bg-gradient-to-r from-gray-100 to-gray-200'}` 
            : 'bg-gradient-to-r from-red-300 to-pink-300'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {message.type === 'success' ? '🎉' : '😅'}
            </div>
            <div>
              <p className={`font-bold ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : 'text-black'} text-lg`}>
                {message.type === 'success' ? (
                  theme === 'bounceworld' ? '🏀 Slam Dunk Success!' :
                  theme === 'avengers' ? '🦸 Avengers Assemble Success!' :
                  theme === 'ben10' ? '⚡ Ben 10 Says: Hero Success!' :
                  theme === 'tinkerbell' ? '✨ Tinkerbell Says: Magic Success!' :
                  theme === 'cricketverse' ? '🏏 CricketVerse Says: Century Success!' :
                  theme === 'ponyville' ? '🦄 Ponyville Says: Magical Success!' :
                  '🎉 Success!'
                ) : (
                  theme === 'bounceworld' ? '🏀 Oops! Airball!' :
                  theme === 'avengers' ? '🦸 Avengers Assemble Error!' :
                  theme === 'ben10' ? '⚡ Ben 10 Says: Try Again!' :
                  theme === 'tinkerbell' ? '✨ Tinkerbell Says: Magic Mishap!' :
                  theme === 'cricketverse' ? '🏏 CricketVerse Says: Play On!' :
                  theme === 'ponyville' ? '🦄 Ponyville Says: Try Again!' :
                  '😅 Oops! Try Again!'
                )}
              </p>
              <p className={`${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : 'text-black'} font-medium`}>{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Theme Selector Section */}
      <div className={`bg-gradient-to-r ${
        theme === 'ben10' ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]' :
        theme === 'tinkerbell' ? 'from-yellow-200 via-green-200 to-yellow-300' :
        theme === 'cricketverse' ? 'from-blue-200 via-indigo-200 to-purple-300' :
        theme === 'bounceworld' ? 'from-white via-[#1D428A]/30 to-[#C8102E]/30' :
        theme === 'avengers' ? 'from-[#604AC7]/20 via-[#2C1267]/20 to-[#0F0826]/20' :
        theme === 'ponyville' ? 'from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]' : 'from-gray-100 via-gray-200 to-gray-300'
      } rounded-xl shadow-lg border-4 ${
        theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : 'border-black'
      } p-6`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h2 className={`text-2xl font-black ${
              theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-[#e13690]' : 'text-black'
            }`}>Choose Your Learning Theme! </h2>
          </div>
          <button
            type="button"
            onClick={() => handleThemeChange('default')}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm ${
              selectedTheme === 'default'
                ? 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 border border-primary-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 focus:ring-gray-500'
            }`}
            title="Reset to default theme"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Default
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {/* Ben10 Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('ben10')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'ben10'
                ? 'border-green-950 bg-[#b2e05b]/10 shadow-lg scale-105'
                : 'border-black bg-white hover:border-[#64cc4f]'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black bg-white p-1">
              <Image
                src="/ben10.jpg"
                alt="Ben 10 Theme"
                fill
                className="object-cover object-fit"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">Ben 10 Hero</h3>
            <p className="text-sm text-black font-semibold mb-1">Green & Black Theme</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-[#64cc4f] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#b2e05b] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#222222] rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'ben10' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-black">✓ Selected</span>
              </div>
            )}
          </button>

          {/* Tinkerbell Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('tinkerbell')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'tinkerbell'
                ? 'border-yellow-600 bg-yellow-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-yellow-400'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black">
              <Image
                src="/tinkerbell.avif"
                alt="Tinkerbell Theme"
                fill
                className="object-cover object-top"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">Tinkerbell Magic</h3>
            <p className="text-sm text-black font-semibold mb-1">Green & Gold Theme</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-green-400 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-yellow-500 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-yellow-600 rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'tinkerbell' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-yellow-600">✓ Selected</span>
              </div>
            )}
          </button>

          {/* CricketVerse Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('cricketverse')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'cricketverse'
                ? 'border-blue-600 bg-blue-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-blue-400'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black bg-white">
              <Image
                src="/CricketVerse.webp"
                alt="CricketVerse Theme"
                fill
                className="object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">CricketVerse</h3>
            <p className="text-sm text-black font-semibold mb-1">Cricket Blue Theme</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-blue-400 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-indigo-600 rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-white rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'cricketverse' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-black">✓ Selected</span>
              </div>
            )}
          </button>

          {/* BounceWorld Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('bounceworld')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'bounceworld'
                ? 'border-[#1D428A] bg-blue-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-[#1D428A]'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black bg-white">
              <Image
                src="/BounceWorld.jpg"
                alt="BounceWorld Theme"
                fill
                className="object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">BounceWorld</h3>
            <p className="text-sm text-black font-semibold mb-1">Bounce Blue & Red</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-[#1D428A] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#C8102E] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-white rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'bounceworld' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-[#1D428A]">✓ Selected</span>
              </div>
            )}
          </button>

          {/* Avengers Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('avengers')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'avengers'
                ? 'border-[#2C1267] bg-purple-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-[#2C1267]'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black bg-white">
              <Image
                src="/avengers.webp"
                alt="Avengers Theme"
                fill
                className="object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">Avengers</h3>
            <p className="text-sm text-black font-semibold mb-1">Hero Midnight Theme</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-[#2C1267] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#604AC7] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#C88DA5] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#4F2C8D] rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'avengers' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-[#2C1267]">✓ Selected</span>
              </div>
            )}
          </button>

          {/* Ponyville Funland Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('ponyville')}
            className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'ponyville'
                ? 'border-[#e13690] bg-pink-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-[#e13690]'
            }`}
          >
            <div className="relative w-full h-24 mb-2 rounded-lg overflow-hidden border-2 border-black bg-white">
              <Image
                src="/Ponyville Funland.jpg"
                alt="Ponyville Funland Theme"
                fill
                className="object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">Ponyville Funland</h3>
            <p className="text-sm text-black font-semibold mb-1">Cotton-candy Pink Theme</p>
            <div className="flex items-center justify-center space-x-1 mb-2">
              <div className="w-5 h-5 bg-[#f1aed5] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#e13690] rounded-full border-2 border-black"></div>
              <div className="w-5 h-5 bg-[#ff2e9f] rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'ponyville' && (
              <div className="mt-2 flex items-center justify-center">
                <span className="text-xs font-bold text-[#e13690]">✓ Selected</span>
              </div>
            )}
          </button>
        </div>

        <div className="mt-4 p-3 bg-white border-2 border-black rounded-lg">
          <p className="text-xs text-black">
            <strong>💡 Tip:</strong> Your chosen theme will be applied instantly across the learning dashboard and study pages. 
            The theme selection is saved automatically!
          </p>
        </div>
      </div>

      {/* Profile Settings - Theme Aware */}
      <div className={`bg-gradient-to-r ${
        theme === 'ben10'
          ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]'
          : theme === 'tinkerbell'
          ? 'from-yellow-300 via-green-400 to-yellow-500'
          : theme === 'bounceworld'
          ? 'from-white via-[#1D428A] to-[#C8102E]'
          : theme === 'avengers'
          ? 'from-[#604AC7] via-[#2C1267] to-[#0F0826]'
          : theme === 'ponyville'
          ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
          : 'from-gray-100 via-gray-200 to-gray-300'
      } rounded-xl shadow-lg border-4 ${
        theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#f1aed5]' : 'border-black'
      } p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <h2 className={`text-2xl font-black ${
            theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : 'text-black'
          }`}>Profile Studio</h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Avatar Selection */}
              <div className="bg-white border-4 border-black rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-lg font-bold text-black flex items-center">
                    <Camera className="w-5 h-5 mr-2" />
                    Choose Your Avatar! 
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                    disabled={getAvailableAvatars().length === 0}
                    className={`${theme === 'ben10' ? 'bg-[#64cc4f] hover:bg-[#b2e05b]' : theme === 'tinkerbell' ? 'bg-yellow-500 hover:bg-yellow-600' : theme === 'bounceworld' ? 'bg-[#1D428A] hover:bg-[#3B82F6]' : theme === 'avengers' ? 'bg-[#2C1267] hover:bg-[#604AC7]' : theme === 'ponyville' ? 'bg-[#f1aed5] hover:bg-[#e13690]' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all disabled:opacity-50`}
                  >
                    {getAvailableAvatars().length === 0 ? 'Avatars Disabled' : (showAvatarSelector ? 'Hide' : 'Change') + ' Avatar'}
                  </button>
                </div>

                {/* Current Avatar Display */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className={`relative w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-white flex-shrink-0 flex items-center justify-center`}>
                    <Image src={getSelectedAvatarData().image || '/images/1.png'} alt={getSelectedAvatarData().name} fill className="object-contain object-center" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">{getSelectedAvatarData().name}</h3>
                    <p className="text-gray-600 text-sm">{getSelectedAvatarData().description}</p>
                  </div>
                </div>

                {/* Avatar Selector */}
                {/* Avatar Selector */}
                {showAvatarSelector && getAvailableAvatars().length > 0 && (
                  <div className="border-t-4 border-black pt-4">
                    <h4 className="text-lg font-bold text-black mb-4 flex items-center">
                      <Star className="w-5 h-5 mr-2 text-yellow-500" />
                      {selectedTheme === 'tinkerbell' || theme === 'tinkerbell' ? 'Choose Your Tinkerbell Avatar!' : selectedTheme === 'ben10' || theme === 'ben10' ? 'Choose Your Ben 10 Hero Avatar!' : selectedTheme === 'bounceworld' || theme === 'bounceworld' ? 'Choose Your Basketball Legend!' : selectedTheme === 'avengers' || theme === 'avengers' ? 'Choose Your Super Hero!' : 'Choose Your Avatar!'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {getAvailableAvatars().map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.id)}
                          className={`p-3 rounded-xl border-4 transition-all transform hover:scale-105 ${
                            selectedAvatar === avatar.id
                              ? (selectedTheme === 'tinkerbell' ? 'border-yellow-400 bg-yellow-50 shadow-lg' : selectedTheme === 'bounceworld' ? 'border-[#1D428A] bg-blue-50 shadow-lg' : selectedTheme === 'avengers' ? 'border-[#604AC7] bg-purple-50 shadow-lg' : selectedTheme === 'ponyville' ? 'border-[#f1aed5] bg-[#f1aed5]/10 shadow-lg' : 'border-[#64cc4f] bg-[#b2e05b]/10 shadow-lg')
                              : 'border-black bg-white hover:border-green-400'
                          }`}>
                          <div className={`relative w-12 h-12 rounded-full overflow-hidden mx-auto mb-2 bg-white border-2 border-black flex items-center justify-center`}>
                            <Image src={avatar.image || '/images/1.png'} alt={avatar.name} fill className="object-contain object-center" />
                          </div>
                          <h5 className="text-sm font-bold text-black text-center">{avatar.name}</h5>
                          <p className="text-xs text-gray-600 text-center mt-1">{avatar.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Your Hero Name!
                </label>
                <Input
                  type="text"
                  value={profileData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('name', e.target.value)}
                  placeholder="Enter your hero name"
                  disabled={loading.profile}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              {/* Email */}
              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Address (Heroically Protected) 🔒
                </label>
                <Input
                  type="email"
                  value={profileData.email}
                  placeholder="Email cannot be changed"
                  disabled={true}
                  readOnly={true}
                  className="bg-gray-100 border-2 border-gray-300 rounded-lg cursor-not-allowed"
                />
              </div>

              {/* Phone */}
              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  Phone Number 
                </label>
                <div className="flex space-x-2">
                  <select
                    value={profileData.countryCode}
                    onChange={(e) => handleProfileInputChange('countryCode', e.target.value)}
                    disabled={loading.profile}
                    className="border-2 border-black rounded-lg px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+86">🇨🇳 +86</option>
                  </select>
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                    disabled={loading.profile}
                    className="flex-1 border-2 border-black rounded-lg"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Account Info Display */}
              <div className="bg-white border-4 border-black rounded-xl p-6 shadow-lg">
                <h4 className="text-lg font-bold text-black mb-4 flex items-center">
                
                   📊 Your Stats!
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-[#64cc4f]/10 border-2 border-[#64cc4f] rounded-lg">
                    <span className="text-black font-bold">🏷️ Status:</span>
                    <span className={`font-black px-3 py-1 rounded-full border-2 border-black ${
                      student.status === 'Active'
                        ? 'bg-[#64cc4f] text-black'
                        : 'bg-red-300 text-black'
                    }`}>
                      {student.status} 
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 ${
                    theme === 'ben10'
                      ? 'bg-[#64cc4f]/10 border-[#64cc4f]'
                      : theme === 'tinkerbell'
                      ? 'bg-yellow-50 border-yellow-300'
                      : theme === 'bounceworld'
                      ? 'bg-[#1D428A]/10 border-[#1D428A]'
                      : theme === 'avengers'
                      ? 'bg-[#604AC7]/10 border-[#604AC7]'
                      : theme === 'ponyville'
                      ? 'bg-[#f1aed5]/10 border-[#f1aed5]'
                      : 'bg-blue-50 border-blue-300'
                  } border-2 rounded-lg`}>
                    <span className="text-black font-bold">📅 Enrolled Since:</span>
                    <span className={`text-black font-bold ${
                      theme === 'ben10'
                        ? 'bg-[#64cc4f]'
                        : theme === 'tinkerbell'
                        ? 'bg-yellow-300'
                        : theme === 'bounceworld'
                        ? 'bg-[#1D428A]'
                        : theme === 'avengers'
                        ? 'bg-[#604AC7]'
                        : theme === 'ponyville'
                        ? 'bg-[#f1aed5]'
                        : 'bg-blue-300'
                    } px-2 py-1 rounded border border-black`}>
                      {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 bg-black border-2 ${
                    theme === 'ben10'
                      ? 'border-[#64cc4f]'
                      : theme === 'tinkerbell'
                      ? 'border-yellow-400'
                      : theme === 'bounceworld'
                      ? 'border-[#1D428A]'
                      : theme === 'avengers'
                      ? 'border-[#604AC7]'
                      : theme === 'ponyville'
                      ? 'border-[#f1aed5]'
                      : 'border-blue-400'
                  } rounded-lg`}>
                    <span className="text-white font-bold">🎓 Student ID:</span>
                    <span className={`text-black font-bold ${
                      theme === 'ben10'
                        ? 'bg-[#64cc4f]'
                        : theme === 'tinkerbell'
                        ? 'bg-yellow-300'
                        : theme === 'bounceworld'
                        ? 'bg-[#1D428A]'
                        : theme === 'avengers'
                        ? 'bg-[#604AC7]'
                        : theme === 'ponyville'
                        ? 'bg-[#f1aed5]'
                        : 'bg-blue-300'
                    } px-2 py-1 rounded border border-black`}>
                      {student.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fun Fact */}
              <div className={`bg-gradient-to-r ${
                selectedTheme === 'ben10'
                  ? 'from-[#64cc4f] to-[#222222]'
                  : selectedTheme === 'tinkerbell'
                  ? 'from-yellow-300 to-green-500'
                  : selectedTheme === 'bounceworld'
                  ? 'from-[#1D428A] to-[#C8102E]'
                  : selectedTheme === 'avengers'
                  ? 'from-[#604AC7] to-[#2C1267]'
                  : selectedTheme === 'ponyville'
                  ? 'from-[#f1aed5] to-[#e13690]'
                  : 'from-gray-100 to-gray-200'
              } border-4 border-black rounded-xl p-6 shadow-lg`}>
                <h4 className={`text-lg font-bold ${selectedTheme === 'bounceworld' ? 'text-white' : 'text-black'} mb-3 flex items-center`}>
                  {selectedTheme === 'ben10' ? '💡 Did You Know?' : selectedTheme === 'tinkerbell' ? '💡 Did You Know?' : selectedTheme === 'bounceworld' ? '🏀 Slam Dunk Fact!' : selectedTheme === 'avengers' ? '🦸 Avengers Assembly Fact!' : selectedTheme === 'ponyville' ? '🦄 Magical Pony Fact!' : '💡 Did You Know?'}
                </h4>
                <p className={`${selectedTheme === 'bounceworld' ? 'text-white' : 'text-black'} font-medium text-sm leading-relaxed`}>
                  {selectedTheme === 'ben10'
                    ? 'Ben 10 first appeared in 2005 and has transformed into over 70 different alien heroes. Choosing a Ben 10 avatar links you to the Omnitrix legacy — wear it proudly!'
                    : selectedTheme === 'tinkerbell'
                    ? "Tinker Bell first appeared in J.M. Barrie's Peter Pan stories and is celebrated for curiosity, creativity, and loyalty. Choosing a Tinkerbell avatar celebrates wonder and kindness!"
                    : selectedTheme === 'bounceworld'
                    ? "The NBA was founded in 1946 and features the world's most talented basketball players. Choosing a basketball legend avatar connects you to the spirit of champions — play hard and dream big!"
                    : selectedTheme === 'avengers'
                    ? 'The Avengers: Earth\'s Mightiest Heroes! Assembled in 2012, they represent the pinnacle of heroism and teamwork. Choosing Avengers theme connects you to the spirit of heroic learning and achieving greatness together! 🦸‍♂️'
                    : selectedTheme === 'ponyville'
                    ? 'Ponyville is a magical town in Equestria where friendship and harmony reign supreme! 🦄✨ Choosing a pony avatar connects you to the magic of friendship, creativity, and the power of believing in yourself. Let your inner pony shine!'
                    : 'Small, consistent study sessions build mastery. Tip: use spaced repetition and active recall to remember more with less time.'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading.profile}
              className={`bg-gradient-to-r ${
                theme === 'ben10' ? 'from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]' : 
                theme === 'tinkerbell' ? 'from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700' : 
                theme === 'bounceworld' ? 'from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A] border-[#1D428A]' : 
                theme === 'avengers' ? 'from-[#2C1267] to-[#604AC7] hover:from-[#604AC7] hover:to-[#2C1267] border-[#2C1267]' :
                theme === 'ponyville' ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f] border-[#f1aed5]' :
                'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
              } text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${
                theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#f1aed5]' : 'border-black'
              } disabled:opacity-50 animate-pulse`}
            >
              {loading.profile ? 'Saving Hero...' : 'Save Your Hero Profile! '}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Settings - Theme Aware */}
      <div className={`bg-gradient-to-r ${
        theme === 'ben10'
          ? 'from-[#64cc4f] via-[#b2e05b] to-[#222222]'
          : theme === 'tinkerbell'
          ? 'from-green-400 via-yellow-500 to-green-600'
          : theme === 'bounceworld'
          ? 'from-[#1D428A] via-white to-[#C8102E]'
          : theme === 'avengers'
          ? 'from-[#604AC7] via-[#2C1267] to-[#0F0826]'
          : theme === 'ponyville'
          ? 'from-[#f1aed5] via-[#e13690] to-[#ff2e9f]'
          : 'from-gray-100 via-gray-200 to-gray-300'
      } rounded-xl shadow-lg border-4 ${
        theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#f1aed5]' : 'border-black'
      } p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🔐</div>
          <h2 className="text-2xl font-black text-black">
            {theme === 'ben10'
              ? "Ben 10's Hero Password Chamber"
              : theme === 'tinkerbell'
              ? "Tinkerbell's Magical Password Realm"
              : theme === 'bounceworld'
              ? "BounceWorld's Slam Dunk Password Court"
              : theme === 'avengers'
              ? "Avengers' Secure Command Center"
              : theme === 'ponyville'
              ? "Ponyville's Enchanted Password Castle"
              : "Secure Password Center"
            }
          </h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Password Fields */}
            <div className="space-y-6">
              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  🔑 Current Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('currentPassword', e.target.value)}
                  placeholder="Enter your current hero password"
                  disabled={loading.password}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                   New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('newPassword', e.target.value)}
                  placeholder="Create a super hero password"
                  disabled={loading.password}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                   Confirm New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your hero password"
                  disabled={loading.password}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>
            </div>

            {/* Right Column - Password Requirements */}
            <div className="bg-white border-4 border-black rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-black mb-4 flex items-center">
                <span className="text-2xl mr-2">🛡️</span>
                Hero Password Rules!
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.minLength ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.minLength ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 8 heroic characters </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasUppercase ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasUppercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 uppercase letter </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasLowercase ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasLowercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 lowercase letter </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasNumber ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasNumber ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 number </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasSpecialChar ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasSpecialChar ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 special character </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.match ? `${
                      theme === 'ben10' ? 'bg-[#64cc4f] text-black' :
                      theme === 'tinkerbell' ? 'bg-yellow-300 text-black' :
                      theme === 'bounceworld' ? 'bg-[#1D428A] text-white' :
                      theme === 'avengers' ? 'bg-[#604AC7] text-white' :
                      theme === 'ponyville' ? 'bg-[#f1aed5] text-black' :
                      'bg-yellow-300 text-black'
                    }` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.match ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">Passwords match perfectly </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading.password || !Object.values(passwordValidation).every(v => v)}
              className={`bg-gradient-to-r ${
                theme === 'ben10'
                  ? 'from-[#64cc4f] to-[#222222] hover:from-[#b2e05b] hover:to-[#222222]'
                  : theme === 'tinkerbell'
                  ? 'from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700'
                  : theme === 'bounceworld'
                  ? 'from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A]'
                  : theme === 'avengers'
                  ? 'from-[#2C1267] to-[#604AC7] hover:from-[#604AC7] hover:to-[#2C1267]'
                  : theme === 'ponyville'
                  ? 'from-[#f1aed5] to-[#e13690] hover:from-[#e13690] hover:to-[#ff2e9f]'
                  : 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
              } text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 ${
                theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#f1aed5]' : 'border-black'
              } disabled:opacity-50 animate-pulse`}
            >
              {loading.password ? 'Transforming Hero...' : 'Change Password Power!'}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
