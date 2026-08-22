export interface SellerRegistrationFormData {
  firstName: string;
  lastName: string;
  shopName: string;
  email: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
  physicalAddress: string;
  latitude: number | undefined;
  longitude: number | undefined;
}

// Location data with Kenyan cities and their areas
export const locationData: Record<string, string[]> = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka']
};

// Password strength checker function
export const checkPasswordStrength = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
  };
};
