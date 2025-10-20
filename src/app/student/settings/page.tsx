'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, KeyRound, Camera, Star, Sparkles, Palette } from 'lucide-react';
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
    emoji: '�',
    description: 'Pyronite from Pyros - Master of fire!',
    colors: 'from-red-500 to-orange-500'
  },
  {
    id: 'wildmutt',
    name: 'Wildmutt',
    emoji: '🐺',
    description: 'Vulpimancer from Vulpin - The beast within!',
    colors: 'from-gray-600 to-gray-800'
  },
  {
    id: 'diamondhead',
    name: 'Diamondhead',
    emoji: '�',
    description: 'Petrosapien from Petropia - Crystal warrior!',
    colors: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'xrl8',
    name: 'XLR8',
    emoji: '🏃‍♂️',
    description: 'Kineceleran from Kinet - Speed demon!',
    colors: 'from-blue-500 to-purple-500'
  },
  {
    id: 'upgrade',
    name: 'Upgrade',
    emoji: '🤖',
    description: 'Galvanic Mechamorph from Galvan Prime - Tech master!',
    colors: 'from-green-400 to-teal-500'
  },
  {
    id: 'ghostfreak',
    name: 'Ghostfreak',
    emoji: '�',
    description: 'Ectonurite from Anur Phaetos - Spirit walker!',
    colors: 'from-purple-600 to-indigo-700'
  },
  {
    id: 'ripjaws',
    name: 'Ripjaws',
    emoji: '🦈',
    description: 'Piscciss Volann from Piscciss - Sea predator!',
    colors: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'stinkfly',
    name: 'Stinkfly',
    emoji: '�',
    description: 'Lepidopterran from Lepidopterra - Winged warrior!',
    colors: 'from-green-600 to-lime-600'
  },
  {
    id: 'benwolf',
    name: 'Benwolf',
    emoji: '�',
    description: 'Anur Transyl\'s werewolf form - Lunar hunter!',
    colors: 'from-yellow-600 to-orange-600'
  },
  {
    id: 'omnitrix',
    name: 'Omnitrix',
    emoji: 'Ω',
    description: 'The Omnitrix itself - Ultimate power!',
    colors: 'from-green-500 to-black'
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
      setProfileData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        countryCode: '+61', // Default to Australia
        avatar: student.avatar || 'omnitrix'
      });
      setSelectedAvatar(student.avatar || 'omnitrix');
    }
  }, [student]);

  // Initialize theme state
  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    setProfileData(prev => ({
      ...prev,
      avatar: avatarId
    }));
    setShowAvatarSelector(false);
  };

  const getSelectedAvatarData = () => {
    return ben10Avatars.find(avatar => avatar.id === selectedAvatar) || ben10Avatars[0];
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
      setMessage({ type: 'success', text: 'Your heroic profile has been updated! 🎉' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Oops! Failed to update your profile. Please try again. 😅' });
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
      
      setMessage({ type: 'success', text: 'Your hero password has been changed! 🔐⚡' });
    } catch (error) {
      console.error('Error updating password:', error);
      
      // Handle specific errors
      if ((error as any).code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Oops! Your current password is incorrect. Please try again. 🔑' });
      } else {
        setMessage({ type: 'error', text: 'Oops! Failed to update your password. Please try again. 😅' });
      }
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-black flex items-center justify-center">
        <div className="text-center bg-white border-4 border-black rounded-2xl p-8 shadow-2xl">
          {/* Ben 10 Omnitrix loading animation */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-green-400 rounded-full flex items-center justify-center relative mx-auto animate-bounce border-4 border-black">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-300"></div>
                </div>
                <div className="absolute bottom-4 w-1 h-1 bg-green-500 rounded-full animate-ping"></div>
              </div>
            
            </div>
            
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-green-400 mx-auto mb-4"></div>
          <p className="text-black font-bold text-lg">Loading Settings...</p>
          <p className="text-gray-600 font-medium mt-2">Get ready to customize your heroic profile! </p>
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
    <div className="space-y-8">
      {/* Page Header - Theme Aware */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-600 via-green-700 to-black' : theme === 'tinkerbell' ? 'from-green-500 via-yellow-500 to-green-600' : 'from-blue-600 via-indigo-700 to-indigo-900'} rounded-2xl text-white p-8 relative overflow-hidden`}>
        {/* Ben 10 themed background elements */}
        
   
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              
              <div>
                <h1 className="text-3xl font-bold">
               Setting Page 
                </h1>
                <p className="text-green-100 text-lg font-semibold mt-2">
                  Customize your heroic learning profile!
                </p>
              </div>
            </div>
            <p className="text-black mb-4 text-base">
              Choose your favorite Disney character and make learning more fun! 
            </p>
          </div>
          <div className="hidden md:block">
            {/* Current Avatar Display */}
            <div className="relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 border-black bg-gradient-to-br ${getSelectedAvatarData().colors}`}>
                <span className="text-4xl">{getSelectedAvatarData().emoji}</span>
              </div>
              <div className="text-center mt-2">
                <span className="text-black font-bold text-sm">{getSelectedAvatarData().name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages - Theme Aware */}
      {message && (
        <div className={`rounded-xl border-4 border-black p-4 shadow-lg ${
          message.type === 'success' 
            ? `${theme === 'ben10' ? 'bg-gradient-to-r from-green-300 to-emerald-300' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-300 to-green-300' : 'bg-gradient-to-r from-blue-300 to-indigo-300'}` 
            : 'bg-gradient-to-r from-red-300 to-pink-300'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {message.type === 'success' ? '🎉' : '😅'}
            </div>
            <div>
              <p className="font-bold text-black text-lg">
                {message.type === 'success' ? 'Ben 10 Says: Hero Success!' : 'Oops! Ben 10 Says: Try Again!'}
              </p>
              <p className="text-black font-medium">{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Theme Selector Section */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-purple-300 via-pink-300 to-purple-500' : theme === 'tinkerbell' ? 'from-yellow-200 via-green-200 to-yellow-300' : 'from-blue-200 via-indigo-200 to-purple-300'} rounded-xl shadow-lg border-4 border-black p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🎨</div>
          <h2 className="text-2xl font-black text-black">Choose Your Learning Theme! ✨</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Ben10 Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('ben10')}
            className={`p-6 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'ben10'
                ? 'border-green-600 bg-green-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-green-400'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              
            </div>
            <h3 className="text-2xl font-bold text-black mb-2">Ben 10 Hero</h3>
            <p className="text-black font-semibold mb-3">Green & Black Theme</p>
            <p className="text-sm text-gray-700 mb-4">
              Transform with the Omnitrix power! Green and black colors inspired by Ben 10's heroic transformations.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 bg-green-400 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-green-600 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-black rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-lime-400 rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'ben10' && (
              <div className="mt-4 flex items-center justify-center">
                <span className="text-lg font-bold text-green-600">✓ Selected</span>
              </div>
            )}
          </button>

          {/* Tinkerbell Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('tinkerbell')}
            className={`p-6 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'tinkerbell'
                ? 'border-yellow-600 bg-yellow-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-yellow-400'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
            
            </div>
            <h3 className="text-2xl font-bold text-black mb-2">Tinkerbell Magic</h3>
            <p className="text-black font-semibold mb-3">Green & Gold Theme</p>
            <p className="text-sm text-gray-700 mb-4">
              Sprinkle some fairy dust magic! Green and gold colors inspired by Tinkerbell's enchanted world.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 bg-green-400 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-yellow-500 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-yellow-600 rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'tinkerbell' && (
              <div className="mt-4 flex items-center justify-center">
                <span className="text-lg font-bold text-yellow-600">✓ Selected</span>
              </div>
            )}
          </button>

          {/* Professional/Normal Theme Card */}
          <button
            type="button"
            onClick={() => handleThemeChange('normal')}
            className={`p-6 rounded-xl border-4 transition-all transform hover:scale-105 ${
              selectedTheme === 'normal'
                ? 'border-blue-600 bg-blue-100 shadow-lg scale-105'
                : 'border-black bg-white hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
             
            </div>
            <h3 className="text-2xl font-bold text-black mb-2">Professional</h3>
            <p className="text-black font-semibold mb-3">Blue & Clean Theme</p>
            <p className="text-sm text-gray-700 mb-4">
              Focus on your studies with a clean, professional interface. Blue and white colors for a classic learning experience.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 bg-blue-400 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-indigo-600 rounded-full border-2 border-black"></div>
              <div className="w-8 h-8 bg-white rounded-full border-2 border-black"></div>
            </div>
            {selectedTheme === 'normal' && (
              <div className="mt-4 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">✓ Selected</span>
              </div>
            )}
          </button>
        </div>

        <div className="mt-6 p-4 bg-white border-2 border-black rounded-lg">
          <p className="text-sm text-black">
            <strong>💡 Tip:</strong> Your chosen theme will be applied instantly across the learning dashboard and study pages. 
            The theme selection is saved automatically!
          </p>
        </div>
      </div>

      {/* Profile Settings - Theme Aware */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-300 via-green-400 to-black' : theme === 'tinkerbell' ? 'from-yellow-300 via-green-400 to-yellow-500' : 'from-blue-300 via-indigo-400 to-indigo-600'} rounded-xl shadow-lg border-4 border-black p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🎨</div>
          <h2 className="text-2xl font-black text-black">Profile Studio</h2>
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
                    className={`${theme === 'ben10' ? 'bg-green-500 hover:bg-green-600' : theme === 'tinkerbell' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all`}
                  >
                    {showAvatarSelector ? 'Hide' : 'Change'} Avatar
                  </button>
                </div>

                {/* Current Avatar Display */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-black bg-gradient-to-br ${getSelectedAvatarData().colors}`}>
                    <span className="text-3xl">{getSelectedAvatarData().emoji}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">{getSelectedAvatarData().name}</h3>
                    <p className="text-gray-600 text-sm">{getSelectedAvatarData().description}</p>
                  </div>
                </div>

                {/* Avatar Selector */}
                {showAvatarSelector && (
                  <div className="border-t-4 border-black pt-4">
                    <h4 className="text-lg font-bold text-black mb-4 flex items-center">
                      <Star className="w-5 h-5 mr-2 text-yellow-500" />
                      Choose Your Ben 10 Hero Avatar! ⚡
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {ben10Avatars.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.id)}
                          className={`p-4 rounded-xl border-4 transition-all transform hover:scale-105 ${
                            selectedAvatar === avatar.id
                              ? 'border-green-400 bg-green-50 shadow-lg'
                              : 'border-black bg-white hover:border-green-400'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 bg-gradient-to-br ${avatar.colors}`}>
                            <span className="text-2xl">{avatar.emoji}</span>
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
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                  Your Hero Stats! 📊
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-green-50 border-2 border-green-300 rounded-lg">
                    <span className="text-black font-bold">🏷️ Status:</span>
                    <span className={`font-black px-3 py-1 rounded-full border-2 border-black ${
                      student.status === 'Active'
                        ? 'bg-green-300 text-black'
                        : 'bg-red-300 text-black'
                    }`}>
                      {student.status} 
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 ${theme === 'ben10' ? 'bg-green-50 border-green-300' : theme === 'tinkerbell' ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-300'} border-2 rounded-lg`}>
                    <span className="text-black font-bold">📅 Enrolled Since:</span>
                    <span className={`text-black font-bold ${theme === 'ben10' ? 'bg-green-300' : theme === 'tinkerbell' ? 'bg-yellow-300' : 'bg-blue-300'} px-2 py-1 rounded border border-black`}>
                      {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 bg-black border-2 ${theme === 'ben10' ? 'border-green-400' : theme === 'tinkerbell' ? 'border-yellow-400' : 'border-blue-400'} rounded-lg`}>
                    <span className="text-white font-bold">🎓 Student ID:</span>
                    <span className={`text-black font-bold ${theme === 'ben10' ? 'bg-green-300' : theme === 'tinkerbell' ? 'bg-yellow-300' : 'bg-blue-300'} px-2 py-1 rounded border border-black`}>
                      {student.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fun Fact */}
              <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-300 to-black' : theme === 'tinkerbell' ? 'from-yellow-300 to-green-500' : 'from-blue-300 to-indigo-600'} border-4 border-black rounded-xl p-6 shadow-lg`}>
                <h4 className="text-lg font-bold text-white mb-3 flex items-center">
                 
                  Did You Know?
                </h4>
                <p className="text-white font-medium text-sm leading-relaxed">
                  Ben 10 first appeared in 2005 and has transformed into over 70 different alien heroes!
                  Your avatar choice makes you part of the ultimate hero legacy! 
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading.profile}
              className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-black hover:from-green-600 hover:to-gray-800' : theme === 'tinkerbell' ? 'from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700' : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'} text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black disabled:opacity-50 animate-pulse`}
            >
              {loading.profile ? 'Saving Hero...' : 'Save Your Hero Profile! '}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Settings - Theme Aware */}
      <div className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-400 via-green-500 to-black' : 'from-green-400 via-yellow-500 to-green-600'} rounded-xl shadow-lg border-4 border-black p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🔐</div>
          <h2 className="text-2xl font-black text-black">Ben 10's Hero Password Chamber</h2>
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
                    passwordValidation.minLength ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.minLength ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 8 heroic characters </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasUppercase ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasUppercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 uppercase letter </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasLowercase ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasLowercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 lowercase letter </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasNumber ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasNumber ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 number </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasSpecialChar ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasSpecialChar ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 special character </span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.match ? `${theme === 'ben10' ? 'bg-green-300' : 'bg-yellow-300'} text-black` : 'bg-white text-gray-400'
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
              className={`bg-gradient-to-r ${theme === 'ben10' ? 'from-green-500 to-black hover:from-green-600 hover:to-gray-800' : 'from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700'} text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black disabled:opacity-50 animate-pulse`}
            >
              {loading.password ? 'Transforming Hero...' : 'Change Password Power!'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
