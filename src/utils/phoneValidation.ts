// Phone validation utility functions
export const phoneRegex = /^[\+]?[\d\s\-\(\)]{9,17}$/;

/**
 * Validates phone number format
 * Accepts international formats like +61412345678, 61412345678, 0412345678
 */
export const validatePhoneNumber = (phone: string, defaultCountryCode: string = '+61'): { isValid: boolean; message?: string } => {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, message: 'Phone number is required' };
  }

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
  
  if (cleanPhone.length < 9) {
    return { isValid: false, message: 'Phone number must be at least 9 digits' };
  }

  if (cleanPhone.length > 17) {
    return { isValid: false, message: 'Phone number must be no more than 17 characters' };
  }

  if (!phoneRegex.test(cleanPhone)) {
    return { isValid: false, message: `Invalid phone number format. Use format: ${defaultCountryCode}412345678` };
  }

  return { isValid: true };
};

/**
 * Formats phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Australian format
  if (cleanPhone.startsWith('+61')) {
    const number = cleanPhone.substring(3);
    if (number.length === 9) {
      return `+61 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }
  }
  
  // US/Canada format
  if (cleanPhone.startsWith('+1')) {
    const number = cleanPhone.substring(2);
    if (number.length === 10) {
      return `+1 (${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
    }
  }
  
  // Default: just add spaces every 3 digits after country code
  if (cleanPhone.startsWith('+')) {
    const parts = cleanPhone.match(/^(\+\d{1,3})(\d+)$/);
    if (parts) {
      const countryCode = parts[1];
      const number = parts[2];
      const formattedNumber = number.replace(/(\d{3})/g, '$1 ').trim();
      return `${countryCode} ${formattedNumber}`;
    }
  }
  
  // If no country code, assume local format
  return cleanPhone.replace(/(\d{3})/g, '$1 ').trim();
};

/**
 * Normalizes phone number for storage (removes formatting)
 */
export const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-\(\)]/g, '');
};

/**
 * Converts local phone number to international format
 */
export const toInternationalFormat = (phone: string, defaultCountryCode: string = '+61'): string => {
  const cleanPhone = normalizePhoneNumber(phone);
  
  // Already has country code
  if (cleanPhone.startsWith('+')) {
    return cleanPhone;
  }
  
  // Remove leading zero for Australian numbers
  if (defaultCountryCode === '+61' && cleanPhone.startsWith('0')) {
    return `${defaultCountryCode}${cleanPhone.substring(1)}`;
  }
  
  // Add default country code
  return `${defaultCountryCode}${cleanPhone}`;
};
