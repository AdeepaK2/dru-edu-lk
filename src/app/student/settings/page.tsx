'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, KeyRound, Camera, Star, Sparkles } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import Input from '@/components/ui/form/Input';
import Button from '@/components/ui/Button';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';

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

// Mickey Mouse themed avatars
const mickeyAvatars = [
  {
    id: 'mickey-classic',
    name: 'Classic Mickey',
    emoji: '🐭',
    description: 'The original Mickey Mouse!',
    colors: 'from-black to-gray-800'
  },
  {
    id: 'mickey-magician',
    name: 'Magician Mickey',
    emoji: '🎩',
    description: 'Mickey the Magician!',
    colors: 'from-purple-500 to-pink-500'
  },
  {
    id: 'mickey-adventurer',
    name: 'Adventurer Mickey',
    emoji: '🗺️',
    description: 'Mickey the Explorer!',
    colors: 'from-green-500 to-blue-500'
  },
  {
    id: 'mickey-sports',
    name: 'Sports Mickey',
    emoji: '⚽',
    description: 'Mickey loves sports!',
    colors: 'from-orange-500 to-red-500'
  },
  {
    id: 'mickey-music',
    name: 'Music Mickey',
    emoji: '🎵',
    description: 'Mickey the Musician!',
    colors: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'mickey-space',
    name: 'Space Mickey',
    emoji: '🚀',
    description: 'Mickey in Space!',
    colors: 'from-indigo-500 to-purple-500'
  },
  {
    id: 'minnie-classic',
    name: 'Classic Minnie',
    emoji: '🐰',
    description: 'Mickey\'s best friend!',
    colors: 'from-pink-500 to-red-500'
  },
  {
    id: 'donald-duck',
    name: 'Donald Duck',
    emoji: '🦆',
    description: 'Mickey\'s funny friend!',
    colors: 'from-blue-600 to-blue-800'
  },
  {
    id: 'goofy',
    name: 'Goofy',
    emoji: '🐶',
    description: 'Mickey\'s goofy pal!',
    colors: 'from-orange-400 to-yellow-400'
  },
  {
    id: 'pluto',
    name: 'Pluto',
    emoji: '🐕',
    description: 'Mickey\'s loyal dog!',
    colors: 'from-yellow-600 to-orange-600'
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
    avatar: 'mickey-classic' // Default avatar
  });

  // Avatar selection state
  const [selectedAvatar, setSelectedAvatar] = useState<string>('mickey-classic');
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
        avatar: student.avatar || 'mickey-magician'
      });
      setSelectedAvatar(student.avatar || 'mickey-magician');
    }
  }, [student]);

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    setProfileData(prev => ({
      ...prev,
      avatar: avatarId
    }));
    setShowAvatarSelector(false);
  };

  const getSelectedAvatarData = () => {
    return mickeyAvatars.find(avatar => avatar.id === selectedAvatar) || mickeyAvatars[0];
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
      setMessage({ type: 'success', text: 'Your magical profile has been updated! 🎉' });
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
      
      setMessage({ type: 'success', text: 'Your magical password has been changed! 🔐✨' });
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
      <div className="min-h-screen bg-gradient-to-br from-red-400 to-blue-400 flex items-center justify-center">
        <div className="text-center bg-white border-4 border-black rounded-2xl p-8 shadow-2xl">
          {/* Mickey Mouse loading animation */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center relative mx-auto animate-bounce">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-pulse delay-300"></div>
                </div>
                <div className="absolute bottom-4 w-1 h-1 bg-red-500 rounded-full animate-ping"></div>
              </div>
              {/* Mickey ears */}
              <div className="absolute -top-3 -left-3 w-6 h-6 bg-black rounded-full animate-pulse"></div>
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-black rounded-full animate-pulse delay-500"></div>
            </div>
            <div className="text-center mt-4">
              <span className="text-black font-bold text-lg">Mickey</span>
            </div>
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-yellow-400 mx-auto mb-4"></div>
          <p className="text-black font-bold text-lg">Loading Mickey's Settings... 🎩✨</p>
          <p className="text-gray-600 font-medium mt-2">Get ready to customize your magical profile! 🎨</p>
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
      {/* Page Header - Mickey Mouse Theme */}
      <div className="bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 rounded-2xl text-white p-8 relative overflow-hidden">
        {/* Mickey Mouse themed background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300 rounded-full -translate-y-16 translate-x-16 animate-bounce opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-400 rounded-full translate-y-12 -translate-x-12 animate-pulse opacity-20"></div>
        {/* Mickey Mouse ears */}
        <div className="absolute top-4 right-4 flex space-x-2">
          <div className="w-8 h-8 bg-black rounded-full animate-pulse"></div>
          <div className="w-8 h-8 bg-black rounded-full animate-pulse delay-300"></div>
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              <div className="text-6xl">🎭</div>
              <div>
                <h1 className="text-3xl font-bold">
                  Mickey's Magic Settings! 🎩✨
                </h1>
                <p className="text-black text-lg font-semibold mt-2">
                  Customize your magical learning profile!
                </p>
              </div>
            </div>
            <p className="text-black mb-4 text-base">
              Choose your favorite Disney character and make learning more fun! 🌟
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

      {/* Success/Error Messages - Mickey Mouse Theme */}
      {message && (
        <div className={`rounded-xl border-4 border-black p-4 shadow-lg ${
          message.type === 'success' 
            ? 'bg-gradient-to-r from-green-300 to-emerald-300' 
            : 'bg-gradient-to-r from-red-300 to-pink-300'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {message.type === 'success' ? '🎉' : '😅'}
            </div>
            <div>
              <p className="font-bold text-black text-lg">
                {message.type === 'success' ? 'Mickey Says: Magic Success!' : 'Oops! Mickey Says: Try Again!'}
              </p>
              <p className="text-black font-medium">{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings - Mickey Mouse Theme */}
      <div className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 rounded-xl shadow-lg border-4 border-black p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🎨</div>
          <h2 className="text-2xl font-black text-black">Mickey's Profile Studio</h2>
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
                    Choose Your Character! 🎭
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold transform hover:scale-105 transition-all"
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
                      Pick Your Favorite Character! 🌟
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {mickeyAvatars.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.id)}
                          className={`p-4 rounded-xl border-4 transition-all transform hover:scale-105 ${
                            selectedAvatar === avatar.id
                              ? 'border-yellow-400 bg-yellow-50 shadow-lg'
                              : 'border-black bg-white hover:border-red-400'
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
                  Your Magical Name! ✨
                </label>
                <Input
                  type="text"
                  value={profileData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProfileInputChange('name', e.target.value)}
                  placeholder="Enter your magical name"
                  disabled={loading.profile}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              {/* Email */}
              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Address (Magically Protected) 🔒
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
                  Phone Number 📞
                </label>
                <div className="flex space-x-2">
                  <select
                    value={profileData.countryCode}
                    onChange={(e) => handleProfileInputChange('countryCode', e.target.value)}
                    disabled={loading.profile}
                    className="border-2 border-black rounded-lg px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                  Your Magical Stats! 📊
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                    <span className="text-black font-bold">🏷️ Status:</span>
                    <span className={`font-black px-3 py-1 rounded-full border-2 border-black ${
                      student.status === 'Active'
                        ? 'bg-green-300 text-black'
                        : 'bg-red-300 text-black'
                    }`}>
                      {student.status} ✨
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                    <span className="text-black font-bold">📅 Enrolled Since:</span>
                    <span className="text-black font-bold bg-blue-300 px-2 py-1 rounded border border-black">
                      {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 border-2 border-purple-300 rounded-lg">
                    <span className="text-black font-bold">🎓 Student ID:</span>
                    <span className="text-black font-bold bg-purple-300 px-2 py-1 rounded border border-black">
                      {student.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fun Fact */}
              <div className="bg-gradient-to-r from-pink-300 to-purple-300 border-4 border-black rounded-xl p-6 shadow-lg">
                <h4 className="text-lg font-bold text-black mb-3 flex items-center">
                  <span className="text-2xl mr-2">🎪</span>
                  Did You Know?
                </h4>
                <p className="text-black font-medium text-sm leading-relaxed">
                  Mickey Mouse made his first appearance in 1928 in the cartoon "Steamboat Willie"!
                  Your avatar choice makes you part of Disney's magical legacy! 🌟
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading.profile}
              className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black disabled:opacity-50 animate-pulse"
            >
              {loading.profile ? 'Saving Magic...' : 'Save Your Magical Profile! ✨'}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Settings - Mickey Mouse Theme */}
      <div className="bg-gradient-to-r from-blue-300 via-purple-300 to-indigo-300 rounded-xl shadow-lg border-4 border-black p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="text-3xl">🔐</div>
          <h2 className="text-2xl font-black text-black">Mickey's Secret Password Chamber</h2>
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
                  placeholder="Enter your current magical password"
                  disabled={loading.password}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  ✨ New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('newPassword', e.target.value)}
                  placeholder="Create a super magical password"
                  disabled={loading.password}
                  required
                  className="border-2 border-black rounded-lg"
                />
              </div>

              <div className="bg-white border-4 border-black rounded-xl p-4">
                <label className="text-sm font-bold text-black mb-2 flex items-center">
                  🔄 Confirm New Password *
                </label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your magical password"
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
                Magical Password Rules!
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.minLength ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.minLength ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 8 magical characters 🪄</span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasUppercase ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasUppercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 uppercase letter 🔤</span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasLowercase ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasLowercase ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 lowercase letter 🔡</span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasNumber ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasNumber ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 number 🔢</span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.hasSpecialChar ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.hasSpecialChar ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">At least 1 special character ✨</span>
                </li>
                <li className="flex items-center text-sm">
                  <span className={`w-6 h-6 mr-3 flex items-center justify-center rounded-full border-2 border-black ${
                    passwordValidation.match ? 'bg-green-300 text-black' : 'bg-white text-gray-400'
                  }`}>
                    {passwordValidation.match ? '✓' : '·'}
                  </span>
                  <span className="text-black font-medium">Passwords match perfectly 🎯</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading.password || !Object.values(passwordValidation).every(v => v)}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-full font-black text-lg transform hover:scale-105 transition-all shadow-lg border-4 border-black disabled:opacity-50 animate-pulse"
            >
              {loading.password ? 'Casting Magic...' : 'Change Password Magic! 🔮'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
