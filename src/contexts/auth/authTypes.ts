export type UserRole = 'buyer' | 'seller' | 'admin';

interface BaseUser {
  id: number;
  email: string;
  is_verified: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BuyerProfile extends BaseUser {
  fullName: string;
  phone: string;
  whatsappNumber: string;
  mobilePayment: string;
  city?: string;
  location?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  refunds?: number;
  hasEmail?: boolean;
}

export interface SellerProfile extends BaseUser {
  fullName: string;
  shopName: string;
  phone: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  hasPhysicalShop?: boolean;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  avatarUrl?: string;
  bio?: string;
  theme?: string;
  balance?: number;
  totalSales?: number;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
}

export interface AdminProfile extends BaseUser {}

export type UserProfile = BuyerProfile | SellerProfile | AdminProfile;

export interface GlobalUser {
  role: UserRole;
  profile: UserProfile;
  isAuthenticated: boolean;
}

export interface BuyerRegistrationData {
  fullName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
  termsAccepted: boolean;
}

export interface SellerRegistrationData {
  fullName: string;
  shopName: string;
  email: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city?: string;
  location?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  referralCode?: string;
  termsAccepted: boolean;
}

export type RegistrationData = BuyerRegistrationData | SellerRegistrationData;

export interface GlobalAuthContextType {
  user: GlobalUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  loginWithToken: (token: string, role: UserRole) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  register: (data: RegistrationData, role: UserRole) => Promise<{ status: string; message?: string } | void>;
  logout: () => void;
  refreshRole: (newRole: UserRole) => Promise<void>;
  forgotPassword: (email: string, role: UserRole) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string, email: string, role: UserRole) => Promise<void>;
  getProfile: (role: UserRole) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>, role: UserRole) => Promise<void>;
}
