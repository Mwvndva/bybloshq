import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import {
  ArrowLeft,
  BarChart3,
  Edit,
  Link as LinkIcon,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Clock,
  Wallet,
  Download,
  X,
  Loader2,
  Info,
  Gift
} from 'lucide-react';
import { sellerApi, checkShopNameAvailability, type Theme } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';
import { useSellerAuth } from '@/contexts/GlobalAuthContext';
import { BannerUpload } from './BannerUpload';
import { BusinessPhotoUpload } from './BusinessPhotoUpload';
import { ThemeSelector } from './ThemeSelector';
import { exportWithdrawalsToCSV } from '@/utils/exportUtils';
import { UnifiedAnalyticsHub } from './UnifiedAnalyticsHub';
import SellerOrdersSection from './SellerOrdersSection';
import ShopLocationPicker from './ShopLocationPicker';
import { ProductsList } from './ProductsList';
import { AddProductForm } from './AddProductForm';
import ReferralPanel from './ReferralPanel';
import { useAsyncLock } from '@/hooks/useAsyncLock';



const getSellerInitials = (name?: string, fallback?: string) => {
  const source = (name || fallback || 'Shop').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

const pendingOverviewStatuses = new Set(['SERVICE_PENDING', 'COLLECTION_PENDING', 'DELIVERY_PENDING']);

const formatOrderStatusLabel = (status: string) => {
  return status
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

const getPendingStatusStyles = (status: string) => {
  switch (status) {
    case 'SERVICE_PENDING':
      return 'border-purple-200 bg-purple-50 text-purple-900';
    case 'COLLECTION_PENDING':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'DELIVERY_PENDING':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
};

interface WithdrawalRequest {
  id: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'processing' | 'completed' | 'failed' | 'compensation_required';
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  processedBy?: string;
  providerReference?: string;
  mpesaReceipt?: string;
  failureReason?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  createdAt: string;
  updatedAt?: string;
  sold?: number;
  status?: 'available' | 'sold';
  isSold?: boolean;
}

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

interface AnalyticsData {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalPayout: number;
  balance: number;  // Made required since it's now always provided by the backend
  clientCount: number;
  wishlistCount: number;
  clickCount: number;
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: RecentOrder[];
}

interface SellerDashboardProps {
  children?: (props: {
    fetchData: () => Promise<AnalyticsData>
  }) => React.ReactNode;
}

const normalizeSellerAnalytics = (productsData: Product[], analyticsData: any): AnalyticsData => {
  if (!analyticsData) {
    return {
      totalProducts: productsData.length || 0,
      totalSales: 0,
      totalRevenue: 0,
      totalPayout: 0,
      balance: 0,
      clientCount: 0,
      wishlistCount: 0,
      clickCount: 0,
      monthlySales: [],
      recentOrders: []
    };
  }

  const salesTotal = (analyticsData.monthlySales || []).reduce(
    (sum: number, monthData: { sales?: number }) => sum + (monthData.sales || 0),
    0
  );
  const totalRevenue = analyticsData.totalRevenue || salesTotal || 0;

  return {
    totalProducts: analyticsData.totalProducts,
    totalSales: analyticsData.totalSales || 0,
    totalRevenue,
    totalPayout: totalRevenue,
    balance: analyticsData.balance || 0,
    clientCount: analyticsData.clientCount || analyticsData.client_count || 0,
    wishlistCount: analyticsData.wishlistCount || analyticsData.wishlist_count || 0,
    clickCount: analyticsData.clickCount || analyticsData.click_count || analyticsData.knockCount || analyticsData.knock_count || 0,
    monthlySales: analyticsData.monthlySales || [],
    recentOrders: analyticsData.recentOrders || []
  };
};

const loadSellerDashboardData = async () => {
  const [productsData, analyticsData] = await Promise.all([
    sellerApi.getProducts(),
    sellerApi.getAnalytics()
  ]);

  const products = Array.isArray(productsData) ? productsData : [];
  return {
    products,
    analytics: normalizeSellerAnalytics(products, analyticsData)
  };
};



export default function SellerDashboard({ children }: SellerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Use seller auth context - same pattern as BuyerDashboard
  const { seller: sellerProfile, isLoading: isAuthLoading, updateSellerProfile, logout } = useSellerAuth();
  const sellerFirstName = useMemo(
    () => sellerProfile?.fullName?.trim().split(/\s+/)[0] || sellerProfile?.shopName?.trim().split(/\s+/)[0] || 'Seller',
    [sellerProfile?.fullName, sellerProfile?.shopName]
  );

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);
  const dashboardQuery = useQuery({
    queryKey: ['seller-dashboard', 'summary'],
    queryFn: loadSellerDashboardData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const initialPhysicalAddress = sellerProfile?.physicalAddress === 'Nairobi, Kenya' ? '' : (sellerProfile?.physicalAddress || '');
  const initialLat = sellerProfile?.latitude;
  const initialLng = sellerProfile?.longitude;
  const isDefaultCoord = initialLat && initialLng &&
    Math.abs(Number(initialLat) - (-1.2921)) < 0.0001 &&
    Math.abs(Number(initialLng) - (36.8219)) < 0.0001;

  const [formData, setFormData] = useState<{
    fullName: string;
    shopName: string;
    city: string;
    location: string;
    physicalAddress: string;
    latitude: number | null;
    longitude: number | null;
    instagramLink: string;
    tiktokLink: string;
    facebookLink: string;
    whatsappNumber: string;
    bio: string;
  }>({
    fullName: sellerProfile?.fullName || '',
    shopName: sellerProfile?.shopName || '',
    city: sellerProfile?.city || '',
    location: sellerProfile?.location || '',
    physicalAddress: initialPhysicalAddress,
    latitude: isDefaultCoord ? null : (initialLat || null),
    longitude: isDefaultCoord ? null : (initialLng || null),
    instagramLink: sellerProfile?.instagramLink || '',
    tiktokLink: sellerProfile?.tiktokLink || '',
    facebookLink: sellerProfile?.facebookLink || '',
    whatsappNumber: sellerProfile?.whatsappNumber || '',
    bio: sellerProfile?.bio || ''
  });

  const [shopNameAvailable, setShopNameAvailable] = useState<boolean | null>(null);
  const [isCheckingShopName, setIsCheckingShopName] = useState(false);

  // Check shop name availability
  useEffect(() => {
    const checkShopName = async () => {
      const trimmedShopName = formData.shopName.trim();

      // Don't check if empty or same as current
      if (!trimmedShopName || trimmedShopName === sellerProfile?.shopName) {
        setShopNameAvailable(null);
        return;
      }

      if (trimmedShopName.length < 3) {
        setShopNameAvailable(null);
        return;
      }

      setIsCheckingShopName(true);
      try {
        const result = await checkShopNameAvailability(trimmedShopName);
        setShopNameAvailable(result.available);
      } catch (error) {
        console.error('Error checking shop name:', error);
        setShopNameAvailable(false);
      } finally {
        setIsCheckingShopName(false);
      }
    };

    const timer = setTimeout(checkShopName, 500);
    return () => clearTimeout(timer);
  }, [formData.shopName, sellerProfile?.shopName]);

  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (dashboardQuery.data) {
      setProducts(dashboardQuery.data.products);
      setAnalytics(dashboardQuery.data.analytics);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (dashboardQuery.isLoading) {
      setIsLoading(true);
      return;
    }

    if (dashboardQuery.error) {
      setError('Failed to load data. Please try again later.');
      setIsLoading(false);
    }
  }, [dashboardQuery.data, dashboardQuery.error, dashboardQuery.isLoading]);

  // Order notification state
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('seller_last_viewed_orders')
  );

  // Withdrawal request form state
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    mpesaNumber: '',
    mpesaName: ''
  });
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  // FIX (Task 15): Prevent duplicate withdrawal requests via synchronous lock
  const { runWithLock, isLocked: isRequestingWithdrawal } = useAsyncLock();
  const withdrawalIdempotencyKeyRef = useRef<string | null>(null);

  // Date filter state for withdrawals
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter withdrawals based on date range
  const filteredWithdrawals = useMemo(() => {
    if (!startDate && !endDate) return withdrawalRequests;

    return withdrawalRequests.filter(withdrawal => {
      const withdrawalDate = new Date(withdrawal.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        return withdrawalDate >= start && withdrawalDate <= end;
      } else if (start) {
        return withdrawalDate >= start;
      } else if (end) {
        return withdrawalDate <= end;
      }
      return true;
    });
  }, [withdrawalRequests, startDate, endDate]);

  const pendingOverviewOrders = useMemo(() => {
    return (analytics?.recentOrders || [])
      .filter(order => pendingOverviewStatuses.has(order.status))
      .slice(0, 8);
  }, [analytics?.recentOrders]);

  // Define cities and their locations
  const cities = {
    'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka'],
    'Mombasa': ['Mombasa Island', 'Nyali', 'Bamburi', 'Kisauni', 'Changamwe', 'Likoni', 'Mtongwe', 'Tudor', 'Shanzu', 'Diani'],
    'Kisumu': ['Kisumu Central', 'Milimani', 'Mamboleo', 'Dunga', 'Kondele', 'Manyatta', 'Nyalenda'],
    'Nakuru': ['Nakuru Town', 'Lanet', 'Kaptembwa', 'Shabab', 'Free Area', 'Section 58', 'Milimani', 'Kiamunyi'],
    'Eldoret': ['Eldoret Town', 'Kapsoya', 'Langas', 'Huruma', 'Kipkaren', 'Kimumu', 'Maili Nne']
  };

  // Get locations for the selected city
  const getLocations = useCallback(() => {
    return formData.city && cities[formData.city as keyof typeof cities]
      ? cities[formData.city as keyof typeof cities]
      : [];
  }, [formData.city]);

  // Handle city selection
  const handleCityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setFormData(prev => ({
      ...prev,
      city,
      location: '' // Reset location when city changes
    }));
  }, []);

  // Handle location selection
  const handleLocationChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      location: e.target.value
    }));
  }, []);

  const handleShopLocationChange = useCallback((address: string, coordinates: { lat: number; lng: number } | null) => {
    setFormData(prev => ({
      ...prev,
      physicalAddress: address,
      latitude: coordinates?.lat || null,
      longitude: coordinates?.lng || null
    }));
  }, []);

  const fetchWithdrawalRequests = useCallback(async () => {
    try {
      const requests = await sellerApi.getWithdrawalRequests();
      setWithdrawalRequests(requests);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load withdrawal requests. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await sellerApi.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch data function
  const fetchData = useCallback(async (): Promise<AnalyticsData> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['seller-dashboard', 'summary'],
        queryFn: loadSellerDashboardData,
        staleTime: 60_000
      });

      setProducts(data.products);
      setAnalytics(data.analytics);
      return data.analytics;

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');

      // If unauthorized, clear token and redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('sellerToken');
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue',
          variant: 'destructive',
        });
        navigate('/seller/login', { state: { from: location.pathname } });
      } else {
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to load dashboard data',
          variant: 'destructive',
        });
      }

      // Return default values in case of error
      return {
        totalProducts: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalPayout: 0,
        balance: 0,
        clientCount: 0,
        wishlistCount: 0,
        clickCount: 0,
        monthlySales: [],
        recentOrders: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, queryClient, location.pathname]);

  const toggleEdit = useCallback(() => {
    setIsEditing(prev => {
      // When entering edit mode, populate form with current values
      if (!prev) {
        const currentLat = sellerProfile?.latitude;
        const currentLng = sellerProfile?.longitude;
        const isDefault = currentLat && currentLng &&
          Math.abs(Number(currentLat) - (-1.2921)) < 0.0001 &&
          Math.abs(Number(currentLng) - (36.8219)) < 0.0001;

        setFormData({
          fullName: sellerProfile?.fullName || '',
          shopName: sellerProfile?.shopName || '',
          city: sellerProfile?.city || '',
          location: sellerProfile?.location || '',
          physicalAddress: sellerProfile?.physicalAddress === 'Nairobi, Kenya' ? '' : (sellerProfile?.physicalAddress || ''),
          latitude: isDefault ? null : (currentLat || null),
          longitude: isDefault ? null : (currentLng || null),
          instagramLink: sellerProfile?.instagramLink || '',
          tiktokLink: sellerProfile?.tiktokLink || '',
          facebookLink: sellerProfile?.facebookLink || '',
          whatsappNumber: sellerProfile?.whatsappNumber || sellerProfile?.phone || '',
          bio: sellerProfile?.bio || ''
        });
        setShopNameAvailable(null);
      }
      return !prev;
    });
  }, [sellerProfile]);

  const handleSaveProfile = useCallback(async () => {
    if (!formData.city || !formData.location || !formData.shopName) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Check if shop name is valid (only if changed)
    if (formData.shopName !== sellerProfile?.shopName && shopNameAvailable === false) {
      toast({
        title: 'Error',
        description: 'Shop name is not available. Please choose another.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.bio.trim().length > 500) {
      toast({
        title: 'Error',
        description: 'Bio must be at most 500 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload: any = {
        fullName: formData.fullName,
        shopName: formData.shopName,
        city: formData.city,
        location: formData.location,
        physicalAddress: formData.physicalAddress,
        instagramLink: formData.instagramLink,
        tiktokLink: formData.tiktokLink,
        facebookLink: formData.facebookLink,
        whatsappNumber: formData.whatsappNumber,
        bio: formData.bio.trim()
      };

      payload.latitude = formData.latitude;
      payload.longitude = formData.longitude;

      if (updateSellerProfile) {
        await updateSellerProfile(payload);
      } else {
        await sellerApi.updateProfile(payload);
      }

      // Profile will be automatically updated by SellerAuthContext
      setIsEditing(false);

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, shopNameAvailable, sellerProfile?.shopName, toast]);

  // fetchProfile removed - profile data now comes from useSellerAuth context


  const handleDeleteProduct = async (id: string) => {
    await sellerApi.deleteProduct(id);
  };

  const handleStatusUpdate = async (productId: string, newStatus: 'available' | 'sold') => {
    try {
      setUpdatingId(productId);
      const isSold = newStatus === 'sold';
      const soldAt = isSold ? new Date().toISOString() : null;

      // Update the backend using the existing updateProduct method
      await sellerApi.updateProduct(productId, {
        status: newStatus,
        soldAt: soldAt
      });

      // Refresh only the products list (lighter than fetchData which also fetches analytics)
      await fetchProducts();

      toast({
        title: 'Success',
        description: `Product marked as ${newStatus}`,
      });
    } catch (error) {
      console.error('Failed to update product status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Fix 8: Clear state on unmount to prevent leaks
  useEffect(() => {
    return () => {
      setUpdatingId(null);
    };
  }, []);

  const handleWithdrawalRequest = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawalForm.amount || !withdrawalForm.mpesaNumber || !withdrawalForm.mpesaName) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(withdrawalForm.amount);
    if (amount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    if (amount > (analytics?.balance || 0)) {
      toast({
        title: 'Error',
        description: 'Withdrawal amount cannot exceed available balance',
        variant: 'destructive',
      });
      return;
    }

    // FIX (Task 15): Prevents duplicate payout requests and invalid amounts
    await runWithLock(async () => {
      try {
        if (!withdrawalIdempotencyKeyRef.current) {
          withdrawalIdempotencyKeyRef.current = globalThis.crypto?.randomUUID
            ? `withdrawal-${globalThis.crypto.randomUUID()}`
            : `withdrawal-${Date.now()}`;
        }

        await sellerApi.requestWithdrawal({
          amount,
          mpesaNumber: withdrawalForm.mpesaNumber,
          mpesaName: withdrawalForm.mpesaName,
          idempotencyKey: withdrawalIdempotencyKeyRef.current
        });

        toast({
          title: 'Withdrawal Initiated',
          description: 'Your withdrawal has been successfully initiated. Funds should reflect shortly.',
          className: 'bg-green-50 border-green-200 text-green-900',
        });

        // Reset form and hide it
        setWithdrawalForm({
          amount: '',
          mpesaNumber: '',
          mpesaName: ''
        });
        setShowWithdrawalForm(false);
        withdrawalIdempotencyKeyRef.current = null;

        // Refresh withdrawal requests
        await fetchWithdrawalRequests();
      } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        const errorMessage = error.response?.data?.message || 'Failed to submit withdrawal request. Please try again.';

        toast({
          title: 'Withdrawal Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    });
  }, [withdrawalForm, analytics?.balance, toast, fetchWithdrawalRequests]);

  // Token expiration check removed - auth is now handled by SellerAuthContext with HttpOnly cookies

  useEffect(() => {

    const fetchTabData = async () => {
      // This effect no longer fetches on tab switches for overview/products
      try {
        if (activeTab === 'withdrawals') {
          await fetchWithdrawalRequests();
        }
        if (activeTab === 'orders') {
          // Orders data is fetched by SellerOrdersSection
        }
      } catch (err) {
        console.error('Error during tab change handling:', err);
      }
    };

    fetchTabData();
  }, [activeTab, fetchWithdrawalRequests]);

  // Check for new orders
  useEffect(() => {
    const checkForNewOrders = async () => {
      try {
        const orders = await sellerApi.getOrders();
        if (orders.length > 0) {
          const latestOrderTime = new Date(orders[0].createdAt).getTime();
          const lastViewed = lastViewedOrdersTime
            ? new Date(lastViewedOrdersTime).getTime()
            : 0;

          setHasUnreadOrders(latestOrderTime > lastViewed);
        } else {
          setHasUnreadOrders(false);
        }
      } catch (error) {
        console.error('Error checking for new orders:', error);
      }
    };

    // Check when analytics data is available
    if (analytics) {
      checkForNewOrders();
    }
  }, [analytics, lastViewedOrdersTime]);

  // Removed: Profile data is already available from SellerAuthContext
  // No need to fetch separately when settings tab is active

  // If children are provided, render them with the fetchData function
  if (children) {
    return (
      <div className="space-y-6">
        {children({ fetchData })}
      </div>
    );
  }

  // Loading state - show skeleton while auth is loading OR data is being fetched
  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex justify-center mb-8">
            <Skeleton className="h-32 w-96" />
          </div>

          <div className="flex space-x-2 mb-12 bg-white/90 backdrop-blur-[12px] p-2 rounded-2xl shadow-lg border border-slate-200 w-fit mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-24 rounded-xl" />
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!analytics || error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <RefreshCw className="h-12 w-12 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-950 mb-3">Unable to load dashboard</h3>
          <p className="text-slate-700 text-lg font-medium max-w-md mx-auto mb-6">
            {error || 'Something went wrong while loading your dashboard data. Please try again.'}
          </p>
          <Button
            onClick={fetchData}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }



  return (
    <>
      <header className="sticky top-0 z-50 bg-black border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 min-h-14 sm:min-h-16">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="justify-self-start text-white hover:text-black hover:bg-yellow-400 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Home</span>
            </Button>

            <h1 className="min-w-0 text-center text-sm sm:text-lg font-medium text-white tracking-tight truncate">
              Welcome, {sellerFirstName}
            </h1>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="justify-self-end text-white hover:text-black hover:bg-yellow-400 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Header */}
      <div className="hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="py-2 md:py-0">
            {/* Mobile: 2-row layout to prevent overlap */}
            <div className="md:hidden">
              <div className="flex items-center justify-between h-12">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="text-gray-300 hover:text-white hover:bg-gray-800 transition-all duration-200 rounded-xl px-2 py-1.5 text-xs h-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to Home</span>
                </Button>

                <div className="flex items-center gap-2">
                  {sellerProfile?.shopName && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl"
                      onClick={async () => {
                        const shopUrl = `${window.location.origin}/shop/${encodeURIComponent(sellerProfile.shopName)}`;
                        try {
                          await navigator.clipboard.writeText(shopUrl);

                          toast({
                            title: 'Link copied!',
                            description: 'Your shop link has been copied to clipboard.',
                          });
                        } catch (err) {
                          toast({
                            title: 'Error',
                            description: 'Failed to copy link. Please try again.',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <LinkIcon className="h-4 w-4" />
                      <span className="sr-only">Copy Shop Link</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={fetchData}
                    className="h-8 w-8 p-0 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl"
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="sr-only">Refresh</span>
                  </Button>
                </div>
              </div>

              <div className="min-w-0 text-center pb-1">
                <h1 className="text-sm font-black text-white tracking-tight truncate">
                  Welcome, {sellerFirstName}
                </h1>
              </div>
            </div>

            {/* Desktop/tablet: single-row pinned layout */}
            <div className="hidden md:grid grid-cols-[auto,1fr,auto] items-center h-14 lg:h-16 gap-2">
              <div className="flex items-center justify-start">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="text-gray-300 hover:text-white hover:bg-gray-800 transition-all duration-200 rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>

              <div className="min-w-0 text-center px-1 sm:px-2">
                <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight truncate">
                  Welcome, {sellerFirstName}
                </h1>
              </div>

              <div className="flex items-center justify-end gap-2 sm:gap-3">
                {sellerProfile?.shopName && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3"
                    onClick={async () => {
                      const shopUrl = `${window.location.origin}/shop/${encodeURIComponent(sellerProfile.shopName)}`;
                      try {
                        await navigator.clipboard.writeText(shopUrl);

                        toast({
                          title: 'Link copied!',
                          description: 'Your shop link has been copied to clipboard.',
                        });
                      } catch (err) {
                        toast({
                          title: 'Error',
                          description: 'Failed to copy link. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <LinkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden md:inline">Copy Shop Link</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={fetchData}
                  className="flex items-center gap-1 sm:gap-2 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl h-8 px-2 sm:px-3 py-1.5"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline text-sm">Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-[18px] py-4 sm:py-5 md:py-6">
        {/* Stats Overview */}
        {/* Stats Overview */}
        <div className="mb-6 sm:mb-7 md:mb-8">
          <UnifiedAnalyticsHub
            analytics={analytics}
          />
        </div>

        {/* Navigation Tabs - Mobile Responsive */}
        <div className="mb-6 sm:mb-8 bg-white/10 backdrop-blur-[12px] rounded-2xl p-1.5 shadow-lg border border-white/15 w-full max-w-4xl mx-auto overflow-x-auto">
          <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-5 min-w-max">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'products', label: 'Products', icon: Package },
              { id: 'orders', label: 'Orders', icon: ShoppingBag },
              { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id);
                  // Mark orders as viewed when Orders tab is clicked
                  if (id === 'orders') {
                    const now = new Date().toISOString();
                    setLastViewedOrdersTime(now);
                    localStorage.setItem('seller_last_viewed_orders', now);
                    setHasUnreadOrders(false);
                  }
                }}
                className={`relative flex items-center justify-center flex-shrink-0 space-x-1.5 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 border ${activeTab === id
                  ? 'text-black border-yellow-300 bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]'
                  : 'text-white border-transparent hover:text-black hover:bg-yellow-300'
                  } ${activeTab === id ? 'seller-tab-selected' : ''}`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                <span>{label}</span>

                {/* Notification Badge - Red Dot */}
                {id === 'orders' && hasUnreadOrders && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        {activeTab === 'orders' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Order Management</h2>
              <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">View and manage customer orders</p>
            </div>
            <SellerOrdersSection />
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Withdrawal Management</h2>
              <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">Request and track your withdrawal requests</p>
            </div>

            {/* Available Balance Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-950">Available Balance</h3>
                  <p className="text-slate-700 text-[10px] sm:text-xs font-medium mt-0.5">Current balance for withdrawal</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-4">
                  <p className="text-lg sm:text-xl md:text-2xl font-black text-green-800">
                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(analytics?.balance ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Minimum Withdrawal Notification */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 sm:gap-3">
              <div className="bg-blue-100 border border-blue-200 rounded-full p-0.5 sm:p-1 mt-0.5 flex-shrink-0">
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-950 text-[10px] sm:text-xs">Minimum: KSh 50</h4>
                <p className="text-slate-700 text-[9px] sm:text-[10px] mt-0.5 leading-tight">
                  Ensure sufficient balance before requesting withdrawal.
                </p>
              </div>
            </div>

            <div>
              {!showWithdrawalForm ? (
                <Button
                  onClick={() => setShowWithdrawalForm(true)}
                  className="gap-1.5 sm:gap-2 bg-yellow-400 text-black hover:bg-yellow-500 shadow-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-bold text-xs sm:text-sm w-full sm:w-auto h-7 sm:h-auto"
                  disabled={(analytics?.balance || 0) <= 0}
                >
                  <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Request Withdrawal
                </Button>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm">
                  <h4 className="text-lg sm:text-xl font-bold text-slate-950 mb-4">Request Withdrawal</h4>
                  <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount" className="text-xs font-semibold text-slate-700 mb-2 block">
                          Amount (KSh)
                        </Label>

                        <Input
                          id="amount"
                          type="number"
                          value={withdrawalForm.amount}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="Enter amount"
                          min="1"
                          max={analytics?.balance || 0}
                          className="h-7 sm:h-8 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                          required
                        />
                        <p className="text-xs text-slate-700 mt-1">
                          Max: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(analytics?.balance ?? 0)}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="mpesaNumber" className="text-xs font-semibold text-slate-700 mb-2 block">
                          M-Pesa Number
                        </Label>

                        <Input
                          id="mpesaNumber"
                          type="tel"
                          value={withdrawalForm.mpesaNumber}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                          placeholder="0712345678"
                          className="h-7 sm:h-8 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="mpesaName" className="text-xs font-semibold text-slate-700 mb-2 block">
                        Name on M-Pesa Number
                      </Label>

                      <Input
                        id="mpesaName"
                        type="text"
                        value={withdrawalForm.mpesaName}
                        onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                        placeholder="Enter name as registered on M-Pesa"
                        className="h-7 sm:h-8 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-500 focus:border-yellow-400 focus:ring-yellow-400"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={isRequestingWithdrawal}
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-4 py-1.5 h-6 text-xs rounded-lg font-semibold"
                        size="sm"
                      >
                        {isRequestingWithdrawal ? (
                          <>
                            <Loader2 className="h-2.5 w-2.5 mr-1.5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Wallet className="h-2.5 w-2.5 mr-1.5" />
                            Submit Request
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowWithdrawalForm(false);
                          setWithdrawalForm({
                            amount: '',
                            mpesaNumber: '',
                            mpesaName: ''
                          });
                        }}
                        className="px-4 py-1.5 h-6 text-xs rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Withdrawal Requests History */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-950">Withdrawal Requests</h3>
                  <p className="text-slate-700 text-xs sm:text-sm font-medium mt-1">Track your withdrawal request history</p>
                </div>
              </div>

              {/* Date Filter and Export Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                {/* Date Range Filter */}
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border-slate-200 text-slate-950 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      placeholder="Start date"
                    />
                  </div>
                  <span className="hidden sm:flex items-center text-slate-700 text-sm">to</span>
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border-slate-200 text-slate-950 focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      placeholder="End date"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      variant="outline"
                      size="icon"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Export Button */}
                <Button
                  onClick={() => exportWithdrawalsToCSV(withdrawalRequests)}
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                  disabled={withdrawalRequests.length === 0}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>

              {filteredWithdrawals.length > 0 ? (
                <div className="space-y-4">
                  {filteredWithdrawals.map((request) => (
                    <Card key={request.id} className="group hover:shadow-xl transition-all duration-300 bg-white border border-slate-200">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <p className="text-base sm:text-xl font-black text-slate-950">
                                {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(request.amount)}
                              </p>
                              <Badge
                                variant="outline"
                                className={`${request.status === 'processing'
                                  ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
                                  : request.status === 'completed'
                                    ? 'bg-green-50 text-green-900 border-green-200'
                                    : request.status === 'failed'
                                      ? 'bg-red-50 text-red-900 border-red-200'
                                      : 'bg-blue-50 text-blue-900 border-blue-200'
                                  } rounded-full px-3 py-1 font-semibold`}
                              >
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-700">
                              M-Pesa: {request.mpesaNumber} ({request.mpesaName})
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Requested</p>
                                <p className="text-xs font-semibold text-slate-950">{new Date(request.createdAt).toLocaleString()}</p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Processed</p>
                                <p className="text-xs font-semibold text-slate-950">{request.processedAt ? new Date(request.processedAt).toLocaleString() : 'Pending'}</p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Provider Ref</p>
                                <p className="truncate text-xs font-semibold text-slate-950">{request.providerReference || 'Pending'}</p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">M-Pesa Receipt</p>
                                <p className="truncate text-xs font-semibold text-slate-950">{request.mpesaReceipt || 'Pending'}</p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Processed By</p>
                                <p className="text-xs font-semibold text-slate-950">{request.processedBy || 'System'}</p>
                              </div>
                            </div>
                            {request.status === 'failed' && request.failureReason && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-400/20 rounded-lg">
                                <p className="text-xs text-red-800 font-medium flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                  Reason: {request.failureReason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center shadow-sm">
                    <Wallet className="h-12 w-12 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-950 mb-3">No withdrawal requests</h3>
                  <p className="text-slate-700 text-lg font-medium max-w-md mx-auto mb-6">You haven't made any withdrawal requests yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              {sellerProfile?.shopName && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg h-8 px-3 text-xs font-medium"
                    onClick={async () => {
                      const shopUrl = `${window.location.origin}/shop/${encodeURIComponent(sellerProfile.shopName!)}`;
                      try {
                        await navigator.clipboard.writeText(shopUrl);
                        toast({
                          title: 'Link copied!',
                          description: 'Your shop link has been copied to clipboard.',
                        });
                      } catch (err) {
                        toast({
                          title: 'Error',
                          description: 'Failed to copy link. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <LinkIcon className="h-3 w-3" />
                    Copy Shop Link
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">

              {/* Active fulfillment states */}
              <Card className="bg-white border border-slate-200 shadow-sm w-full rounded-2xl">
                <CardHeader className="p-4">
                  <CardTitle className="text-base sm:text-lg font-black text-slate-950 flex items-center">
                    <div className="w-9 h-9 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center mr-3">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-700" />
                    </div>
                    Pending Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {pendingOverviewOrders.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {pendingOverviewOrders.map((order) => (
                        <div key={order.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm sm:text-base text-slate-950 truncate" title={order.orderNumber}>
                                  {order.orderNumber}
                                </span>
                                <Badge className={`border text-[10px] font-bold ${getPendingStatusStyles(order.status)}`}>
                                  {formatOrderStatusLabel(order.status)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-700 truncate">
                                {(order.items || []).map(item => `${item.quantity}x ${item.product_name}`).join(', ') || 'Order items pending'}
                              </p>
                            </div>
                            <div className="sm:text-right shrink-0">
                              <p className="text-sm font-black text-slate-950">{formatCurrency(order.totalAmount)}</p>
                              <p className="text-[11px] text-slate-500">
                                {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-slate-600 text-sm">No service, collection, or delivery pending orders</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Product Management</h2>
              <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">Manage all your products in one place</p>
            </div>

            {/* Products List with Inventory Management */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950">All Products</h3>
                  <p className="text-slate-700 text-xs sm:text-sm font-medium mt-1">Manage inventory and track stock levels</p>
                </div>

                <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-3 py-1.5 rounded-lg font-semibold text-xs w-full sm:w-auto h-8"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full max-w-full sm:max-w-[640px] p-0 bg-transparent border-none shadow-none focus-visible:outline-none h-[100dvh] sm:h-auto overflow-hidden">
                    <div className="product-modal-light bg-black border-x border-y sm:border border-white/15 rounded-none sm:rounded-[2.5rem] h-full sm:h-auto overflow-hidden shadow-2xl flex flex-col">
                      <AddProductForm
                        onSuccess={() => {
                          fetchProducts();
                          setIsAddProductModalOpen(false);
                        }}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <ProductsList
                products={products as any}
                onDelete={handleDeleteProduct}
                onEdit={(id) => navigate(`/seller/edit-product/${id}`)}
                onStatusUpdate={handleStatusUpdate}
                onRefresh={fetchProducts}
              />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-2 sm:mb-3">Store Settings</h2>
              <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium max-w-3xl mx-auto px-4 sm:px-0">
                Manage your store configuration and preferences. Update your store details, location, and appearance.
              </p>
            </div>

            <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
              {/* Banner Upload Section */}
              <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] rounded-xl sm:rounded-2xl lg:rounded-3xl p-2.5 sm:p-3 lg:p-5 xl:p-6 shadow-lg border border-white/10">
                <BannerUpload
                  currentBannerUrl={sellerProfile?.bannerImage}
                  onBannerUploaded={(bannerUrl) => {
                    // Profile will be automatically updated by SellerAuthContext
                  }}
                />
              </div>

              {/* Store Information */}
              <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] rounded-xl sm:rounded-2xl lg:rounded-3xl p-2.5 sm:p-3 lg:p-5 xl:p-6 shadow-lg border border-white/10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="mb-2 sm:mb-0 flex-1 min-w-0">
                    <h3 className="text-sm sm:text-lg lg:text-xl font-black text-white truncate">Store Information</h3>
                    <p className="text-gray-300 text-[10px] sm:text-xs font-medium mt-1">
                      Your store details and contact information
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={toggleEdit}
                          disabled={isSaving}
                          className="text-xs sm:text-sm bg-transparent border-white/10 text-gray-200 hover:bg-white/5 flex-1 sm:flex-none min-w-[80px] sm:min-w-[100px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg text-xs sm:text-sm flex-1 sm:flex-none min-w-[80px] sm:min-w-[100px]"
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={toggleEdit}
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg text-xs sm:text-sm flex-1 sm:flex-none min-w-[80px] sm:min-w-[100px]"
                      >
                        <Edit className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </div>

                {/* Profile Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-4 mb-4 sm:mb-6 lg:mb-8 space-y-4 sm:space-y-0">
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Shop Name</p>
                    {isEditing ? (
                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            name="shopName"
                            value={formData.shopName}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\s/g, '');
                              setFormData(prev => ({ ...prev, shopName: val }));
                            }}
                            placeholder="Shop Name"
                            className={`h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 pr-10 ${formData.shopName !== sellerProfile?.shopName && shopNameAvailable === false ? 'border-red-500 focus:border-red-500' :
                              formData.shopName !== sellerProfile?.shopName && shopNameAvailable === true ? 'border-green-500 focus:border-green-500' : ''
                              }`}
                          />
                          {isCheckingShopName && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                          )}
                          {!isCheckingShopName && formData.shopName && formData.shopName !== sellerProfile?.shopName && shopNameAvailable !== null && (
                            <div className={`absolute right-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${shopNameAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                          )}
                        </div>
                        {formData.shopName !== sellerProfile?.shopName && shopNameAvailable !== null && !isCheckingShopName && (
                          <p className={`text-[10px] ${shopNameAvailable ? 'text-green-400' : 'text-red-400'}`}>
                            {shopNameAvailable ? 'Name available' : 'Name already taken'}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 truncate">byblos.com/shop/{formData.shopName}</p>
                      </div>
                    ) : (
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.shopName || 'Not set'}>
                        {sellerProfile?.shopName || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Full Name</p>
                    {isEditing ? (
                      <Input
                        name="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Your Full Name"
                        className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    ) : (
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.fullName || 'Not set'}>
                        {sellerProfile?.fullName || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl sm:col-span-2">
                    <BusinessPhotoUpload
                      currentPhotoUrl={sellerProfile?.avatarUrl}
                      fallbackInitials={getSellerInitials(sellerProfile?.shopName, sellerProfile?.fullName)}
                      onPhotoUploaded={() => {
                        queryClient.invalidateQueries({ queryKey: ['sellerDashboard'] });
                      }}
                    />
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl sm:col-span-2">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-300">Shop Bio</p>
                      {isEditing && (
                        <span className="text-[10px] text-gray-400">{formData.bio.length}/500</span>
                      )}
                    </div>
                    {isEditing ? (
                      <Textarea
                        name="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                        placeholder="Tell buyers what your shop offers."
                        className="min-h-[92px] text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 resize-none"
                      />
                    ) : (
                      <p className="text-sm sm:text-base font-semibold text-white whitespace-pre-line break-words">
                        {sellerProfile?.bio || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Email</p>
                    <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.email || 'Not set'}>
                      {sellerProfile?.email || 'Not set'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-300 mb-1">WhatsApp Number</p>
                    {isEditing ? (
                      <Input
                        name="whatsappNumber"
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        placeholder="e.g. 0712345678"
                        className="h-8 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    ) : (
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">
                        {sellerProfile?.whatsappNumber || sellerProfile?.phone || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Instagram Link</p>
                    {isEditing ? (
                      <Input
                        name="instagramLink"
                        value={formData.instagramLink}
                        onChange={(e) => setFormData(prev => ({ ...prev, instagramLink: e.target.value }))}
                        placeholder="https://instagram.com/yourshop"
                        className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {sellerProfile?.instagramLink ? (
                          <a
                            href={sellerProfile.instagramLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm sm:text-base lg:text-lg font-semibold text-blue-300 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                            </svg>
                            View
                          </a>
                        ) : (
                          <p className="text-sm sm:text-base font-semibold text-gray-300 italic">Not set</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">TikTok Link</p>
                    {isEditing ? (
                      <Input
                        name="tiktokLink"
                        value={formData.tiktokLink}
                        onChange={(e) => setFormData(prev => ({ ...prev, tiktokLink: e.target.value }))}
                        placeholder="https://tiktok.com/@yourshop"
                        className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {sellerProfile?.tiktokLink ? (
                          <a
                            href={sellerProfile.tiktokLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm sm:text-base lg:text-lg font-semibold text-blue-300 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
                            </svg>
                            View
                          </a>
                        ) : (
                          <p className="text-sm sm:text-base font-semibold text-gray-300 italic">Not set</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 lg:p-5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-1">Facebook Link</p>
                    {isEditing ? (
                      <Input
                        name="facebookLink"
                        value={formData.facebookLink}
                        onChange={(e) => setFormData(prev => ({ ...prev, facebookLink: e.target.value }))}
                        placeholder="https://facebook.com/yourshop"
                        className="h-8 sm:h-9 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {sellerProfile?.facebookLink ? (
                          <a
                            href={sellerProfile.facebookLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm sm:text-base lg:text-lg font-semibold text-blue-300 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                            </svg>
                            View
                          </a>
                        ) : (
                          <p className="text-sm sm:text-base font-semibold text-gray-300 italic">Not set</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Settings */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <h4 className="text-base sm:text-lg lg:text-xl font-bold text-white">Location Settings</h4>
                    {!isEditing && (
                      <button
                        onClick={toggleEdit}
                        className="text-xs sm:text-sm text-yellow-300 hover:text-yellow-200 font-medium flex items-center gap-1 self-start sm:self-auto"
                      >
                        <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        Edit Location
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                      <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">City</p>
                      {isEditing ? (
                        <select
                          name="city"
                          value={formData.city}
                          onChange={handleCityChange}
                          className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-gray-800 text-white"
                        >
                          <option value="">Select a city</option>
                          {Object.keys(cities).map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                          {sellerProfile?.city || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                      <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Location/Area</p>
                      {isEditing ? (
                        <select
                          name="location"
                          value={formData.location}
                          onChange={handleLocationChange}
                          className="w-full p-2 sm:p-3 text-xs sm:text-sm lg:text-base border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-gray-800 text-white"
                          disabled={!formData.city}
                        >
                          <option value="">Select a location</option>
                          {getLocations().map(location => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                          {sellerProfile?.location || 'Not set'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Physical Shop Address */}
                  <div className="p-3 sm:p-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl lg:rounded-2xl">
                    <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Physical Shop Address</p>
                    {isEditing ? (
                      <div className="mt-2">
                        <ShopLocationPicker
                          initialAddress={formData.physicalAddress}
                          initialCoordinates={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                          onLocationChange={handleShopLocationChange}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sellerProfile?.physicalAddress ? (
                          <>
                            <p className="text-xs sm:text-sm lg:text-base font-semibold text-white">
                              {sellerProfile.physicalAddress}
                            </p>
                            <p className="text-xs text-gray-300">
                              {sellerProfile.latitude && sellerProfile.longitude ?
                                `Coordinates: ${sellerProfile.latitude.toFixed(6)}, ${sellerProfile.longitude.toFixed(6)}` :
                                'No map location pinned'}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs sm:text-sm lg:text-base font-semibold text-gray-300 italic">
                            No physical address set
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Refer and Earn */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                    <Gift className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">Refer & Earn</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Build your squad and earn rewards from their sales</p>
                  </div>
                </div>

                <ReferralPanel totalSales={sellerProfile?.totalSales || 0} />
              </div>

              {/* Theme Settings */}
              <div className="bg-white/90 backdrop-blur-[12px] rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-4 lg:p-6 xl:p-8 shadow-lg border border-slate-200">
                <ThemeSelector
                  currentTheme={(sellerProfile?.theme as Theme) || 'default'}
                  onThemeChange={(theme) => {
                    // Profile will be automatically updated by SellerAuthContext
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
};
