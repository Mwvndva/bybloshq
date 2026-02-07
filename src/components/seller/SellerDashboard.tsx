import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { PLATFORM_FEE_RATE } from '@/lib/constants';
import { formatCurrency, decodeJwt, isTokenExpired, getImageUrl } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import {
  ArrowLeft,
  BarChart3,
  Bike,
  Check,
  CheckCircle,
  Copy,
  DollarSign,
  Edit,
  Link as LinkIcon,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  TrendingUp,
  User,
  Clock,
  Truck,
  Wallet,
  Download,
  Calendar,
  X,
  XCircle,
  Loader2,
  Info,
  Trash2,
  Handshake
} from 'lucide-react';
import { sellerApi, checkShopNameAvailability, debtService } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';
import { useSellerAuth } from '@/contexts/GlobalAuthContext';
import { BannerUpload } from './BannerUpload';
import { ThemeSelector } from './ThemeSelector';
import { exportWithdrawalsToCSV } from '@/utils/exportUtils';
import { UnifiedAnalyticsHub } from './UnifiedAnalyticsHub';
import PaymentLoadingModal from './PaymentLoadingModal';
import SellerOrdersSection from './SellerOrdersSection';
import ShopLocationPicker from './ShopLocationPicker';
import { ProductsList } from './ProductsList';
import NewClientOrderModal from './NewClientOrderModal';

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

// Local helpers for consistent formatting within this component
const formatNumber = (value: number | null | undefined) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return num.toLocaleString();
};

interface SellerProfile {
  fullName?: string;
  shopName?: string;
  email?: string;
  whatsappNumber?: string;
  phone?: string; // fallback
  city?: string;
  location?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  theme?: Theme;
  instagramLink?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
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
  pendingDebt: number;
  pendingDebtCount: number;
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: RecentOrder[];
  recentDebts?: Array<{
    id: number;
    amount: number;
    clientName: string;
    clientPhone: string;
    productName: string;
    createdAt: string;
  }>;
}

interface SellerDashboardProps {
  children?: (props: {
    fetchData: () => Promise<AnalyticsData>
  }) => React.ReactNode;
}



export default function SellerDashboard({ children }: SellerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Use seller auth context - same pattern as BuyerDashboard
  const { seller: sellerProfile, logout: handleLogout, isLoading: isAuthLoading } = useSellerAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<{
    shopName: string;
    city: string;
    location: string;
    physicalAddress: string;
    latitude: number | null;
    longitude: number | null;
    instagramLink: string;
    whatsappNumber: string;
  }>({
    shopName: '',
    city: '',
    location: '',
    physicalAddress: '',
    latitude: null,
    longitude: null,
    instagramLink: '',
    whatsappNumber: ''
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

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

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
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);

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

  // Client Order Modal State
  const [showClientOrderModal, setShowClientOrderModal] = useState(false);
  const [isCreatingClientOrder, setIsCreatingClientOrder] = useState(false);

  // Payment Loading Modal State
  const [showPaymentLoadingModal, setShowPaymentLoadingModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | undefined>();
  const [paymentClientPhone, setPaymentClientPhone] = useState<string | undefined>();

  // Debt Prompt State
  const [processingDebtId, setProcessingDebtId] = useState<number | null>(null);

  const handleSendDebtPrompt = async (debtId: number) => {
    if (processingDebtId) return;

    setProcessingDebtId(debtId);
    try {
      const result = await debtService.initiatePayment(debtId) as any;

      // Show payment loading modal
      setPaymentReference(result.data?.payment?.reference || result.data?.payment?.api_ref);
      // Find the debt to get client phone
      const debt = (analytics as any)?.pendingPayments?.find((d: any) => d.id === debtId);
      setPaymentClientPhone(debt?.client_phone);
      setShowPaymentLoadingModal(true);

      toast({
        title: '📱 Prompt Sent',
        description: 'STK Push sent to client successfully.',
      });
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.response?.data?.message || 'Failed to send prompt.',
        variant: 'destructive'
      });
    } finally {
      setProcessingDebtId(null);
    }
  };

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

  // handleLogout removed - now using logout from SellerAuthContext

  // Fetch data function
  const fetchData = useCallback(async (): Promise<AnalyticsData> => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch products and analytics data in parallel
      // Auth is handled by HttpOnly cookies, no need to check localStorage
      const [productsData, analyticsData] = await Promise.all([
        sellerApi.getProducts(),
        sellerApi.getAnalytics()
      ]);

      setProducts(productsData);

      // Create analytics data structure
      const processedAnalytics = {
        totalProducts: analyticsData.totalProducts,
        totalSales: analyticsData.totalSales,
        totalRevenue: analyticsData.totalRevenue,
        totalPayout: analyticsData.totalRevenue * 0.85, // Assuming 15% platform fee
        balance: analyticsData.balance || 0,
        pendingDebt: analyticsData.pendingDebt || 0,
        pendingDebtCount: (analyticsData as any).pendingDebtCount || 0,
        monthlySales: analyticsData.monthlySales || [],
        recentOrders: analyticsData.recentOrders || [],
        recentDebts: (analyticsData as any).recentDebts || []
      };


      // Return the analytics data with the correct type
      const result: AnalyticsData = {
        totalProducts: processedAnalytics.totalProducts,
        totalSales: processedAnalytics.totalSales,
        totalRevenue: processedAnalytics.totalRevenue,
        totalPayout: processedAnalytics.totalPayout,
        balance: processedAnalytics.balance,
        pendingDebt: processedAnalytics.pendingDebt,
        pendingDebtCount: processedAnalytics.pendingDebtCount,
        monthlySales: processedAnalytics.monthlySales,
        recentOrders: processedAnalytics.recentOrders,
        recentDebts: processedAnalytics.recentDebts
      };

      setAnalytics(processedAnalytics);
      return result;

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
        pendingDebt: 0,
        pendingDebtCount: 0,
        monthlySales: [],
        recentOrders: [],
        recentDebts: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [navigate]); // Removed toast and location.pathname - toast is stable, location causes loops

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

  const toggleEdit = useCallback(() => {
    setIsEditing(prev => {
      // When entering edit mode, populate form with current values
      if (!prev) {
        setFormData({
          shopName: sellerProfile?.shopName || '',
          city: sellerProfile?.city || '',
          location: sellerProfile?.location || '',
          physicalAddress: sellerProfile?.physicalAddress || '',
          latitude: sellerProfile?.latitude || null,
          longitude: sellerProfile?.longitude || null,
          instagramLink: sellerProfile?.instagramLink || '',
          whatsappNumber: sellerProfile?.whatsappNumber || sellerProfile?.phone || ''
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

    setIsSaving(true);

    try {
      const payload: any = {
        shopName: formData.shopName,
        city: formData.city,
        location: formData.location,
        physicalAddress: formData.physicalAddress,
        instagramLink: formData.instagramLink,
        whatsappNumber: formData.whatsappNumber
      };

      if (formData.latitude && formData.longitude) {
        payload.latitude = formData.latitude;
        payload.longitude = formData.longitude;
      }

      await sellerApi.updateProfile(payload);

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

  const handleDeleteProduct = async (id: string) => {
    setProductToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setDeletingId(productToDelete);
      await sellerApi.deleteProduct(productToDelete);
      setShowDeleteDialog(false);
      setProductToDelete(null);

      // Refresh only the products list (lighter than fetchData which also fetches analytics)
      await fetchProducts();

      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || error?.message || 'Failed to delete product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
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

    setIsRequestingWithdrawal(true);

    try {
      await sellerApi.requestWithdrawal({
        amount,
        mpesaNumber: withdrawalForm.mpesaNumber,
        mpesaName: withdrawalForm.mpesaName
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
    } finally {
      setIsRequestingWithdrawal(false);
    }
  }, [withdrawalForm, analytics?.balance, toast, fetchWithdrawalRequests]);

  const handleClientOrderSubmit = useCallback(async (data: {
    clientName: string;
    clientPhone: string;
    paymentType?: 'stk' | 'debt';
    items: Array<{ productId: string; name: string; quantity: number; price: number }>;
  }) => {
    setIsCreatingClientOrder(true);
    try {
      const result = await sellerApi.createClientOrder(data);

      if (data.paymentType === 'debt') {
        toast({
          title: '✅ Order Recorded',
          description: `Order recorded as debt for ${data.clientName}. Inventory updated.`,
          className: 'bg-blue-500/10 border-blue-400/30 text-blue-200',
        });
      } else {
        // STK Push - show loading modal
        setPaymentReference((result as any).payment?.reference || (result as any).payment?.api_ref);
        setPaymentClientPhone(data.clientPhone);
        setShowPaymentLoadingModal(true);

        toast({
          title: '📱 STK Push Sent!',
          description: `Payment request sent to ${data.clientPhone}. Waiting for client to complete payment...`,
          className: 'bg-green-500/10 border-green-400/30 text-green-200',
        });
      }

      setShowClientOrderModal(false);

      // Note: Dashboard will auto-refresh on next load or manual refresh
      // Forcing refresh here causes dashboard to crash
    } catch (error: any) {
      console.error('Error creating client order:', error);
      toast({
        title: '❌ Error',
        description: error.response?.data?.message || error.message || 'Failed to create client order',
        className: 'bg-red-500/10 border-red-400/30 text-red-200',
      });
    } finally {
      setIsCreatingClientOrder(false);
    }
  }, [toast, fetchData]);

  const handlePaymentSuccess = useCallback(() => {
    toast({
      title: '✅ Payment Successful!',
      description: 'The client has completed the payment. Your balance has been updated.',
      className: 'bg-green-500/10 border-green-400/30 text-green-200',
      duration: 5000,
    });
    // Refresh dashboard data
    // Note: Using window.location.reload() to avoid infinite loop from fetchData dependency
    setTimeout(() => window.location.reload(), 2000);
  }, [toast]);

  const handlePaymentFailure = useCallback(() => {
    toast({
      title: '⏱️ Payment Timeout',
      description: 'The payment request has expired. You can send a new prompt if needed.',
      className: 'bg-orange-500/10 border-orange-400/30 text-orange-200',
    });
  }, [toast]);


  // Token expiration check removed - auth is now handled by SellerAuthContext with HttpOnly cookies

  useEffect(() => {

    const fetchData = async () => {
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

    fetchData();
  }, [activeTab, fetchWithdrawalRequests]);

  // Prefetch data on initial mount to make tabs render instantly like Settings
  useEffect(() => {
    let isMounted = true;

    const prefetch = async () => {
      setIsLoading(true);

      try {
        const [productsData, analyticsData] = await Promise.all([
          sellerApi.getProducts(),
          sellerApi.getAnalytics()
        ]);
        if (!isMounted) return;
        setProducts(productsData);

        // Calculate total sales and revenue from analytics data
        if (analyticsData) {
          // Calculate revenue from monthly sales data
          const salesTotal = analyticsData.monthlySales.reduce(
            (sum, monthData) => sum + monthData.sales, 0
          );

          let totalRevenue = 0;
          let calculatedPayout = 0;

          // Try to calculate revenue from orders first (most accurate)
          // We don't have orders here directly unless we fetch them, but analyticsData includes totalRevenue
          // The component logic previously had complex fallbacks. Simplified here:

          if (analyticsData.totalRevenue) {
            totalRevenue = analyticsData.totalRevenue;
          } else if (salesTotal > 0) {
            totalRevenue = salesTotal;
          }

          calculatedPayout = totalRevenue;

          const updatedAnalytics: AnalyticsData = {
            ...analyticsData,
            totalSales: (analyticsData as any).totalSales || 0,
            totalRevenue: totalRevenue,
            totalPayout: calculatedPayout,
            balance: analyticsData.balance || 0,
            pendingDebt: analyticsData.pendingDebt || 0,
            pendingDebtCount: (analyticsData as any).pendingDebtCount || 0,
            monthlySales: analyticsData.monthlySales || [],
            recentOrders: (analyticsData as any).recentOrders || [],
            recentDebts: (analyticsData as any).recentDebts || []
          };

          const result: AnalyticsData = {
            totalProducts: updatedAnalytics.totalProducts,
            totalSales: updatedAnalytics.totalSales,
            totalRevenue: updatedAnalytics.totalRevenue,
            totalPayout: updatedAnalytics.totalPayout,
            balance: updatedAnalytics.balance,
            pendingDebt: updatedAnalytics.pendingDebt,
            pendingDebtCount: updatedAnalytics.pendingDebtCount,
            monthlySales: updatedAnalytics.monthlySales,
            recentOrders: updatedAnalytics.recentOrders,
            recentDebts: updatedAnalytics.recentDebts
          };

          setAnalytics(updatedAnalytics);
        } else {
          // Fallback if analyticsData is null
          const defaultData: AnalyticsData = {
            totalProducts: productsData.length || 0,
            totalSales: 0,
            totalRevenue: 0,
            totalPayout: 0,
            balance: 0,
            pendingDebt: 0,
            pendingDebtCount: 0,
            monthlySales: [],
            recentOrders: []
          };
          setAnalytics(defaultData);
        }
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error('Error prefetching data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    prefetch();
    // fetchProfile() removed - profile is already fetched by SellerAuthContext
    return () => { isMounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Create context value to pass to child routes
  const outletContext = {
    products,
    onDeleteProduct: async () => { },
    fetchData,
  };

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
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex justify-center mb-8">
            <Skeleton className="h-32 w-96" />
          </div>

          <div className="flex space-x-2 mb-12 bg-black/40 backdrop-blur-[12px] p-2 rounded-2xl shadow-lg border border-white/10 w-fit mx-auto">
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <RefreshCw className="h-12 w-12 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3">Unable to load dashboard</h3>
          <p className="text-gray-300 text-lg font-medium max-w-md mx-auto mb-6">
            {error || 'Something went wrong while loading your dashboard data. Please try again.'}
          </p>
          <Button
            onClick={fetchData}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
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
                  {sellerProfile?.shopName ? `${sellerProfile.shopName}'s Dashboard` : 'Seller Dashboard'}
                </h1>
                <p className="text-xs text-gray-300 font-medium truncate">
                  Welcome, {sellerProfile?.fullName?.split(' ')[0] || 'Seller'}!
                </p>
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
                  {sellerProfile?.shopName ? `${sellerProfile.shopName}'s Dashboard` : 'Seller Dashboard'}
                </h1>
                <p className="hidden sm:block text-xs text-gray-300 font-medium">
                  Welcome, {sellerProfile?.fullName?.split(' ')[0] || 'Seller'}!
                </p>
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

      <div className="w-full max-w-screen-2xl mx-auto px-6 lg:px-10 2xl:px-12 py-4 sm:py-5 md:py-6">
        {/* Stats Overview */}
        {/* Stats Overview */}
        <div className="mb-6 sm:mb-7 md:mb-8">
          <UnifiedAnalyticsHub
            analytics={analytics}
            onWithdraw={() => setActiveTab('withdrawals')}
          />
        </div>

        {/* Navigation Tabs - Mobile Responsive */}
        <div className="mb-6 sm:mb-8 bg-black/40 backdrop-blur-[12px] rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-lg border border-white/10 w-full overflow-x-auto">
          <div className="flex items-center justify-start sm:justify-center gap-2 min-w-max">
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
                className={`relative flex items-center justify-center flex-shrink-0 space-x-1.5 sm:space-x-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-base transition-all duration-300 border ${activeTab === id
                  ? 'text-yellow-300 border-yellow-400/30 bg-yellow-400/10 shadow-[0_0_22px_rgba(250,204,21,0.25)] transform scale-[1.03]'
                  : 'text-gray-300 border-transparent hover:text-white hover:bg-white/5'
                  }`}
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
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Order Management</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-medium">View and manage customer orders</p>
            </div>
            <SellerOrdersSection />
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Withdrawal Management</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-medium">Request and track your withdrawal requests</p>
            </div>

            {/* Available Balance Card */}
            <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-lg border border-white/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-white">Available Balance</h3>
                  <p className="text-gray-300 text-[10px] sm:text-xs font-medium mt-0.5">Current balance for withdrawal</p>
                </div>
                <div className="bg-green-500/10 border border-green-400/20 rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-4 shadow-[0_0_24px_rgba(34,197,94,0.12)]">
                  <p className="text-lg sm:text-xl md:text-2xl font-black text-green-200">
                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(analytics?.balance ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Minimum Withdrawal Notification */}
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 sm:gap-3">
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-full p-0.5 sm:p-1 mt-0.5 flex-shrink-0">
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-blue-100 text-[10px] sm:text-xs">Minimum: KSh 50</h4>
                <p className="text-blue-200/80 text-[9px] sm:text-[10px] mt-0.5 leading-tight">
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
                <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
                  <h4 className="text-lg sm:text-xl font-bold text-white mb-4">Request Withdrawal</h4>
                  <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount" className="text-xs font-semibold text-gray-300 mb-2 block">
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
                          className="h-7 sm:h-8 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                          required
                        />
                        <p className="text-xs text-gray-300 mt-1">
                          Max: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(analytics?.balance ?? 0)}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="mpesaNumber" className="text-xs font-semibold text-gray-300 mb-2 block">
                          M-Pesa Number
                        </Label>

                        <Input
                          id="mpesaNumber"
                          type="tel"
                          value={withdrawalForm.mpesaNumber}
                          onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                          placeholder="0712345678"
                          className="h-7 sm:h-8 text-xs sm:text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="mpesaName" className="text-xs font-semibold text-gray-300 mb-2 block">
                        Name on M-Pesa Number
                      </Label>

                      <Input
                        id="mpesaName"
                        type="text"
                        value={withdrawalForm.mpesaName}
                        onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                        placeholder="Enter name as registered on M-Pesa"
                        className="h-7 sm:h-8 text-xs sm:text-sm bg-gray-900 border-white/10 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                        required
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={isRequestingWithdrawal}
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-4 py-1.5 h-6 text-xs rounded-lg font-semibold"
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
                        className="px-4 py-1.5 h-6 text-xs rounded-lg bg-transparent border-white/10 text-gray-200 hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Withdrawal Requests History */}
            <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-lg border border-white/10">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white">Withdrawal Requests</h3>
                  <p className="text-gray-300 text-xs sm:text-sm font-medium mt-1">Track your withdrawal request history</p>
                </div>
              </div>

              {/* Date Filter and Export Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                {/* Date Range Filter */}
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10 bg-zinc-900/50 border-white/10 text-white focus:border-yellow-500/50 focus:ring-yellow-500/20"
                      placeholder="Start date"
                    />
                  </div>
                  <span className="hidden sm:flex items-center text-gray-400 text-sm">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 bg-zinc-900/50 border-white/10 text-white focus:border-yellow-500/50 focus:ring-yellow-500/20"
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
                      className="border-white/10 text-white hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Export Button */}
                <Button
                  onClick={() => exportWithdrawalsToCSV(withdrawalRequests)}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10 hover:border-white/20 gap-2"
                  disabled={withdrawalRequests.length === 0}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>

              {filteredWithdrawals.length > 0 ? (
                <div className="space-y-4">
                  {filteredWithdrawals.map((request) => (
                    <Card key={request.id} className="group hover:shadow-2xl transition-all duration-500 bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] border border-white/10">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <p className="text-base sm:text-xl font-black text-white">
                                {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(request.amount)}
                              </p>
                              <Badge
                                variant="outline"
                                className={`${request.status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-200 border-yellow-400/20'
                                  : request.status === 'approved'
                                    ? 'bg-green-500/10 text-green-200 border-green-400/20'
                                    : request.status === 'rejected' || request.status === 'failed'
                                      ? 'bg-red-500/10 text-red-200 border-red-400/20'
                                      : 'bg-blue-500/10 text-blue-200 border-blue-400/20'
                                  } rounded-full px-3 py-1 font-semibold`}
                              >
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-300">
                              M-Pesa: {request.mpesaNumber} ({request.mpesaName})
                            </p>
                            <p className="text-xs text-gray-300">
                              Requested on {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                            {request.status === 'failed' && request.failureReason && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-400/20 rounded-lg">
                                <p className="text-xs text-red-200 font-medium flex items-center gap-1">
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
                  <div className="w-24 h-24 mx-auto mb-8 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-lg">
                    <Wallet className="h-12 w-12 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-3">No withdrawal requests</h3>
                  <p className="text-gray-300 text-lg font-medium max-w-md mx-auto mb-6">You haven't made any withdrawal requests yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Store Overview</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-medium max-w-3xl mx-auto">Manage your products and track your store performance</p>
              {sellerProfile?.shopName && (
                <div className="mt-4 flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white rounded-lg h-8 px-3 text-xs font-medium"
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

                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 border-emerald-400/30 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all font-bold h-8 px-3 text-xs"
                    onClick={() => setShowClientOrderModal(true)}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                    New Client Order
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">

              {/* Store Performance */}
              <Card className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] border border-white/10 shadow-xl w-full rounded-2xl">
                <CardHeader className="p-4">
                  <CardTitle className="text-base sm:text-lg font-black text-white flex items-center">
                    <div className="w-9 h-9 bg-yellow-500/10 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.18)] rounded-xl flex items-center justify-center mr-3">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    Pending Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {/* Recent Debts List */}
                  {analytics.recentDebts && analytics.recentDebts.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {analytics.recentDebts.map((debt) => (
                        <div key={debt.id} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[150px]" title={debt.clientName}>{debt.clientName}</span>
                              <span className="text-[10px] sm:text-xs text-gray-400 font-mono">{debt.clientPhone}</span>
                            </div>
                            <span className="text-xs sm:text-sm font-mono text-yellow-300 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-lg border border-yellow-500/20">{formatCurrency(debt.amount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm text-gray-400 mb-3">
                            <span className="truncate max-w-[120px] sm:max-w-[150px]" title={debt.productName}>{debt.productName}</span>
                            <span>{new Date(debt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>

                          <div className="flex justify-end mt-2">
                            <Button
                              size="sm"
                              className="w-auto h-6 px-2.5 text-[10px] font-bold bg-gradient-to-r from-yellow-400/80 to-yellow-500/80 text-black border-none hover:from-yellow-400 hover:to-yellow-500 hover:shadow-[0_0_12px_rgba(250,204,21,0.2)]"
                              onClick={() => handleSendDebtPrompt(debt.id)}
                              disabled={processingDebtId === debt.id}
                            >
                              {processingDebtId === debt.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Wallet className="h-3 w-3 mr-1" />
                                  Send Prompt
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-gray-400 text-sm">No pending debts</p>
                    </div>
                  )}
                </CardContent>
              </Card>            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-1.5">Product Management</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-medium">Manage all your products in one place</p>
            </div>

            {/* Products List with Inventory Management */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">All Products</h3>
                  <p className="text-gray-300 text-xs sm:text-sm font-medium mt-1">Manage inventory and track stock levels</p>
                </div>

                <Button
                  size="sm"
                  onClick={() => navigate('/seller/add-product')}
                  className="gap-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-3 py-1.5 rounded-lg font-semibold text-xs w-full sm:w-auto h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Product
                </Button>
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
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white mb-2 sm:mb-3">Store Settings</h2>
              <p className="text-gray-300 text-xs sm:text-sm lg:text-base font-medium max-w-3xl mx-auto px-4 sm:px-0">
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
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg text-xs sm:text-sm flex-1 sm:flex-none min-w-[80px] sm:min-w-[100px]"
                    >
                      <LogOut className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5" />
                      Logout
                    </Button>
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
                    <p className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate" title={sellerProfile?.fullName || 'Not set'}>
                      {sellerProfile?.fullName || 'Not set'}
                    </p>
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

              {/* Theme Settings */}
              <div className="bg-black/40 backdrop-blur-[12px] rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-4 lg:p-6 xl:p-8 shadow-lg border border-white/10">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px] bg-[rgba(17,17,17,0.75)] backdrop-blur-[12px] border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Product</DialogTitle>
            <DialogDescription className="text-zinc-300">
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setProductToDelete(null);
              }}
              disabled={!!deletingId}
              className="bg-transparent border-white/10 text-zinc-200 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Client OrderModal */}
      <NewClientOrderModal
        isOpen={showClientOrderModal}
        onClose={() => setShowClientOrderModal(false)}
        products={products as any}
        onSubmit={handleClientOrderSubmit}
      />

      {/* Payment Loading Modal */}
      <PaymentLoadingModal
        isOpen={showPaymentLoadingModal}
        onClose={() => setShowPaymentLoadingModal(false)}
        paymentReference={paymentReference}
        clientPhone={paymentClientPhone}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
      />
    </>
  );
};