import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
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
  XCircle,
  Loader2
} from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';
import { BannerUpload } from './BannerUpload';
import { ThemeSelector } from './ThemeSelector';
import SellerOrdersSection from './SellerOrdersSection';

type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow';

interface SellerProfile {
  fullName?: string;
  shopName?: string;
  email?: string;
  phone?: string;
  city?: string;
  location?: string;
  bannerImage?: string;
  theme?: Theme;
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
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: RecentOrder[];
}

interface SellerDashboardProps {
  children?: (props: { 
    fetchData: () => Promise<AnalyticsData> 
  }) => React.ReactNode;
}

interface StatsCardProps {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
  iconColor?: string;
  bgColor?: string;
  textColor?: string;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  iconColor = 'text-white',
  bgColor = 'bg-gradient-to-br from-yellow-400 to-yellow-500',
  textColor = 'text-black',
  className = ''
}) => (
  <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow hover:shadow-md transition-all duration-300 h-full">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className={`space-y-0.5 flex-1 min-w-0 ${className}`}>
          <p className="text-[9px] xs:text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
          <p className={`text-xl xs:text-2xl font-bold ${textColor} break-words leading-tight`}>
            {value}
          </p>
          <p className="text-[10px] xs:text-xs text-gray-500 font-medium truncate">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${bgColor} rounded-xl flex-shrink-0 flex items-center justify-center shadow`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const SellerDashboard: React.FC<SellerDashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);

  const [formData, setFormData] = useState({
    city: '',
    location: ''
  });

  // Withdrawal modal state
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState<boolean>(false);
  const [withdrawalData, setWithdrawalData] = useState<{
    mpesaNumber: string;
    registeredName: string;
    amount: string;
  }>({
    mpesaNumber: '',
    registeredName: '',
    amount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Handle seller logout
  const handleLogout = () => {
    // Clear seller token and user data from localStorage
    localStorage.removeItem('sellerToken');
    localStorage.removeItem('seller');
    
    // Redirect to login page
    navigate('/seller/login');
    
    // Show success message
    toast({
      title: 'Logged out successfully',
      description: 'You have been logged out of your seller account.',
    });
  };

  // Fetch data function
  const fetchData = useCallback(async (): Promise<AnalyticsData> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check for seller token first
      const token = localStorage.getItem('sellerToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch products and analytics data in parallel
      const [productsData, analyticsData] = await Promise.all([
        sellerApi.getProducts(),
        sellerApi.getAnalytics()
      ]);
      
      console.log('Analytics data received:', {
        totalProducts: analyticsData.totalProducts,
        totalSales: analyticsData.totalSales,
        totalRevenue: analyticsData.totalRevenue,
        balance: analyticsData.balance,
        monthlySales: analyticsData.monthlySales,
        recentOrders: analyticsData.recentOrders
      });
      
      setProducts(productsData);

      // Create analytics data structure
      const processedAnalytics = {
        totalProducts: analyticsData.totalProducts,
        totalSales: analyticsData.totalSales,
        totalRevenue: analyticsData.totalRevenue,
        totalPayout: analyticsData.totalRevenue * 0.85, // Assuming 15% platform fee
        balance: analyticsData.balance || 0,
        monthlySales: analyticsData.monthlySales || [],
        recentOrders: analyticsData.recentOrders || []
      };
      
      console.log('Processed analytics data:', processedAnalytics);
      
      // Return the analytics data with the correct type
      const result: AnalyticsData = {
        totalProducts: processedAnalytics.totalProducts,
        totalSales: processedAnalytics.totalSales,
        totalRevenue: processedAnalytics.totalRevenue,
        totalPayout: processedAnalytics.totalPayout,
        balance: processedAnalytics.balance,
        monthlySales: processedAnalytics.monthlySales,
        recentOrders: processedAnalytics.recentOrders
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
        monthlySales: [],
        recentOrders: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, location.pathname]);

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
          city: sellerProfile?.city || '',
          location: sellerProfile?.location || ''
        });
      }
      return !prev;
    });
  }, [sellerProfile]);

  const handleSaveProfile = useCallback(async () => {
    if (!formData.city || !formData.location) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const updatedProfile = await sellerApi.updateProfile({
        city: formData.city,
        location: formData.location
      });
      
      setSellerProfile(prev => ({
        ...prev,
        city: formData.city,
        location: formData.location
      }));
      
      setIsEditing(false);
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, toast]);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await sellerApi.getProfile();
      setSellerProfile({
        fullName: profile.fullName || profile.full_name,
        shopName: profile.shopName || profile.shop_name,
        email: profile.email,
        phone: profile.phone,
        city: profile.city,
        location: profile.location
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    console.log(`[SellerDashboard] Tab changed to: ${activeTab}`);
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [productsData, analyticsData] = await Promise.all([
          sellerApi.getProducts(),
          sellerApi.getAnalytics()
        ]);
        setProducts(productsData);
        
        // Calculate total sales and revenue from analytics data
        if (analyticsData) {
          // Calculate revenue from monthly sales data
          const salesTotal = analyticsData.monthlySales.reduce(
            (sum, monthData) => sum + monthData.sales, 0
          );
          
          let totalRevenue = 0;
          let calculatedPayout = 0;
          
          // Calculate revenue from recent orders if available
          const ordersData = (analyticsData as any).recentOrders;
          console.log('Raw orders data:', JSON.parse(JSON.stringify(ordersData)));
          
          if (Array.isArray(ordersData) && ordersData.length > 0) {
            const completedOrders = ordersData.filter((order: any) => {
              const isCompleted = order.status === 'COMPLETED';
              console.log(`Order ${order.orderNumber} status: ${order.status}, isCompleted: ${isCompleted}`);
              return isCompleted;
            });
            
            console.log('Completed orders:', completedOrders.length);
            
            totalRevenue = completedOrders.reduce((sum: number, order: any) => {
              let orderTotal = 0;
              
              if (Array.isArray(order.items) && order.items.length > 0) {
                const itemsTotal = order.items.reduce((itemSum: number, item: any) => {
                  const itemPrice = item.price || 0;
                  const itemQty = item.quantity || 1;
                  const itemTotal = itemPrice * itemQty;
                  console.log(`Item ${item.id}: ${itemPrice} x ${itemQty} = ${itemTotal}`);
                  return itemSum + itemTotal;
                }, 0);
                orderTotal = itemsTotal;
                console.log(`Order ${order.orderNumber} items total: ${itemsTotal}`);
              } else {
                orderTotal = order.totalAmount || 0;
                console.log(`Order ${order.orderNumber} using totalAmount: ${orderTotal}`);
              }
              
              console.log(`Adding to totalRevenue: ${sum} + ${orderTotal} = ${sum + orderTotal}`);
              return sum + orderTotal;
            }, 0);
            
            console.log('Final calculated revenue from orders:', totalRevenue);
          }
          
          // If no revenue from orders, use monthly sales as fallback
          if (totalRevenue === 0) {
            totalRevenue = salesTotal;
          }
          
          // Only use the API's totalRevenue if we couldn't calculate from orders or monthly sales
          if (totalRevenue === 0 && analyticsData.totalRevenue) {
            totalRevenue = analyticsData.totalRevenue;
          }
          
          // Use the full revenue amount for payout
          calculatedPayout = totalRevenue;
          
          console.log('Revenue calculation:', {
            fromOrders: ordersData ? ordersData.filter((o: any) => o.status === 'COMPLETED').map((o: any) => ({
              orderNumber: o.orderNumber,
              totalAmount: o.totalAmount,
              items: o.items?.map((i: any) => ({
                price: i.price,
                quantity: i.quantity,
                subtotal: (i.price || 0) * (i.quantity || 1)
              }))
            })) : [],
            calculatedRevenue: totalRevenue,
            apiRevenue: analyticsData.totalRevenue,
            finalRevenue: totalRevenue
          });
          
          const updatedAnalytics: AnalyticsData = {
            ...analyticsData,
            totalSales: (analyticsData as any).totalSales || 0, // Safely access totalSales
            totalRevenue: totalRevenue,
            totalPayout: calculatedPayout,
            recentOrders: (analyticsData as any).recentOrders || [] // Handle recentOrders if it exists
          };
          
          setAnalytics(updatedAnalytics);
          
          console.log('Updated analytics data:', {
            salesTotal,
            totalRevenue: updatedAnalytics.totalRevenue,
            totalPayout: updatedAnalytics.totalPayout
          });
        } else {
          // Transform SellerAnalytics to AnalyticsData by adding missing required properties
          const transformedData: AnalyticsData = {
            ...analyticsData,
            totalSales: (analyticsData as any).totalSales || 0, // Safely access totalSales
            totalPayout: analyticsData.totalRevenue * 0.91, // Calculate payout as 91% of revenue (9% platform fee)
            recentOrders: [] // Initialize as empty array since we don't have this data
          };
          setAnalytics(transformedData);
        }
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (activeTab === 'products') {
      console.log('[SellerDashboard] Fetching products...');
      fetchProducts();
    } else if (activeTab === 'overview' || activeTab === 'dashboard') {
      console.log('[SellerDashboard] Fetching dashboard data...');
      fetchData();
      fetchProfile();
    } else if (activeTab === 'orders') {
      console.log('[SellerDashboard] Orders tab selected');
      // Orders data will be fetched by the SellerOrdersSection component
    }
  }, [activeTab, fetchProducts, fetchProfile]);

  // Create context value to pass to child routes
  const outletContext = {
    products,
    onDeleteProduct: () => {},
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                {activeTab === 'dashboard' ? 'Dashboard' : 
                 activeTab === 'products' ? 'Products' : 
                 'Seller Dashboard'}
              </h2>
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center mb-8">
            <Skeleton className="h-32 w-96" />
          </div>
          
          <div className="flex space-x-2 mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-fit mx-auto">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <RefreshCw className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Unable to load dashboard</h3>
            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
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
      </div>
    );
  }

  const stats = [
    {
      icon: Package,
      title: 'Total Products',
      value: analytics.totalProducts,
      subtitle: 'Products in your store'
    },
    {
      icon: DollarSign,
      title: 'Total Sales',
      value: formatCurrency(analytics.totalRevenue || 0),
      subtitle: 'Gross sales amount',
      iconColor: 'text-white',
      bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
      textColor: 'text-black'
    },
    {
      icon: Wallet,
      title: 'Available Balance',
      // Format balance as a simple string with fixed decimal places
      value: `KSh ${(Math.round(analytics.balance * 100) / 100).toFixed(2)}`,
      subtitle: 'available for withdrawal amount',
      iconColor: 'text-white',
      bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
      textColor: 'text-black',
      className: 'whitespace-nowrap' // Prevent line breaks
    },
    {
      icon: DollarSign,
      title: 'Net Sales',
      value: (() => {
        const totalSales = parseFloat(((analytics as any).totalSales || 0).toFixed(2));
        const platformFeeRate = 0.09; // 9%
        const platformFee = parseFloat((totalSales * platformFeeRate).toFixed(2));
        const netSales = parseFloat((totalSales - platformFee).toFixed(2));
        
        console.log('Net Sales Calculation:', {
          rawTotalSales: (analytics as any).totalSales,
          parsedTotalSales: totalSales,
          platformFeeRate: '9%',
          calculatedPlatformFee: platformFee,
          calculatedNetSales: netSales,
          formattedNetSales: formatCurrency(netSales),
          formattedWithDecimals: new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(netSales)
        });
        
        // Force 2 decimal places in the display
        return new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: 'KES',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(netSales);
      })(),
      subtitle: 'After 9% platform fee',
      iconColor: 'text-white',
      bgColor: 'bg-gradient-to-br from-green-500 to-green-600',
      textColor: 'text-black'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 sm:py-0 sm:h-16 md:h-20 space-y-3 sm:space-y-0">
            {/* Mobile: Stack vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 md:space-x-6 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-black hover:bg-gray-100/80 transition-all duration-200 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm h-8 sm:h-9"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="hidden sm:block h-6 sm:h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
              <div className="flex-1 sm:flex-none">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-black tracking-tight">
                  {sellerProfile?.shopName ? (
                    <span className="block sm:inline">
                      <span className="hidden sm:inline">{sellerProfile.shopName}'s Dashboard</span>
                      <span className="sm:hidden text-base">{sellerProfile.shopName}</span>
                    </span>
                  ) : 'Seller Dashboard'}
                </h1>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <p className="text-xs text-gray-500 font-medium">
                    Welcome, {sellerProfile?.fullName?.split(' ')[0] || 'Seller'}!
                  </p>
                </div>
              </div>
            </div>
            
            {/* Mobile: Stack buttons vertically, Desktop: Horizontal */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {sellerProfile?.shopName && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 sm:h-9 md:h-10 bg-white border-gray-300 text-black hover:bg-yellow-50 hover:border-yellow-300 flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3"
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
                  <span className="hidden sm:inline">Copy Shop Link</span>
                  <span className="sm:hidden text-xs">Copy Link</span>
                </Button>
              )}
              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">

                <Button
                  variant="outline"
                  onClick={() => {
                    // Use totalRevenue from analytics for withdrawal amount
                    // Default to 0 if analytics data is not available yet
                    const availableBalance = analytics?.totalRevenue || 0;
                    setWithdrawalData({
                      mpesaNumber: '',
                      registeredName: sellerProfile?.fullName || '',
                      amount: availableBalance > 0 ? availableBalance.toFixed(2) : '0.00'
                    });
                    setIsWithdrawalModalOpen(true);
                  }}
                  className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-0 rounded-xl h-8 sm:h-9 md:h-10 px-2 sm:px-3 py-1.5 sm:py-2 font-medium shadow-sm"
                >
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline text-sm">Withdraw</span>
                  <span className="sm:hidden text-xs">Withdraw</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchData}
                  className="flex items-center gap-1 sm:gap-2 bg-white border-gray-300 text-black hover:bg-yellow-50 hover:border-yellow-300 rounded-xl h-8 sm:h-9 md:h-10 px-2 sm:px-3 py-1.5 sm:py-2"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline text-sm">Refresh</span>
                  <span className="sm:hidden text-xs">Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 md:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 md:mb-12">
          {stats.map((stat, index) => (
            <div key={index} className="col-span-1">
              <StatsCard {...stat} />
            </div>
          ))}
        </div>

        {/* Navigation Tabs - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-2 mb-6 sm:mb-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-lg border border-gray-200/50 max-w-4xl mx-auto w-full">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'products', label: 'Products', icon: Package },
            { id: 'orders', label: 'Orders', icon: ShoppingBag },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 ${
                activeTab === id
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeTab === 'orders' && (
          <div className="space-y-6 sm:space-y-8 md:space-y-12">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-black mb-2 sm:mb-3 md:mb-4">Order Management</h2>
              <p className="text-gray-600 text-sm sm:text-base md:text-lg font-medium max-w-2xl mx-auto">View and manage customer orders</p>
            </div>
            <SellerOrdersSection />
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div className="space-y-6 sm:space-y-8 md:space-y-12">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-black mb-2 sm:mb-3 md:mb-4">Store Overview</h2>
              <p className="text-gray-600 text-sm sm:text-base md:text-lg font-medium max-w-2xl mx-auto">Manage your products and track your store performance</p>
            </div>

            {/* Recent Products */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-lg border border-gray-200/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-black">Recent Products</h3>
                  <p className="text-gray-600 text-sm sm:text-base font-medium mt-1 sm:mt-2">Your most recently added products</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/seller/add-product')}
                  className="gap-1.5 sm:gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-medium sm:font-semibold text-xs sm:text-sm w-full sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add Product
                </Button>
              </div>
              
              {products.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {products.slice(0, 6).map((product) => (
                    <Card key={product.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                      <div className="relative overflow-hidden rounded-t-2xl">
                        <img
                          src={product.image_url || product.imageUrl || '/placeholder-image.jpg'}
                          alt={product.name}
                          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <Badge 
                          variant="secondary"
                          className="absolute top-4 left-4 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold rounded-xl"
                        >
                          Available
                        </Badge>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{product.name}</h3>
                        <p className="text-yellow-600 font-black text-xl mb-3">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {product.aesthetic}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Package className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Add your first product to get started with your store</p>
                  <Button 
                    onClick={() => navigate('/seller/add-product')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Your First Product
                  </Button>
                </div>
              )}
            </div>

            {/* Store Performance */}
            <div className="flex justify-center">
              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl w-full max-w-xs sm:max-w-sm md:max-w-md">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl font-black text-black flex items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg">
                      <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    Store Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                    <div>
                      <p className="text-xs sm:text-sm font-medium sm:font-semibold text-gray-700">Active Products</p>
                      <p className="text-xl sm:text-2xl font-black text-black">{analytics.totalProducts}</p>
                    </div>
                    <Package className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6 sm:space-y-8 md:space-y-12">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-black mb-2 sm:mb-3 md:mb-4">Product Management</h2>
              <p className="text-gray-600 text-sm sm:text-base md:text-lg font-medium">Manage all your products in one place</p>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-lg border border-gray-200/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-black">Quick Actions</h3>
                  <p className="text-gray-600 text-sm sm:text-base font-medium mt-1 sm:mt-2">Common tasks for your products</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/seller/add-product')}
                  className="gap-1.5 sm:gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-medium sm:font-semibold text-xs sm:text-sm w-full sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add Product
                </Button>
              </div>
              
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <Button 
                  variant="outline" 
                  className="h-12 sm:h-14 md:h-16 justify-start gap-2 sm:gap-3 md:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-lg sm:rounded-xl px-3 sm:px-4"
                  onClick={() => navigate('/seller/products')}
                >
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium sm:font-semibold text-sm sm:text-base truncate">View All Products</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">See all your products</p>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-12 sm:h-14 md:h-16 justify-start gap-2 sm:gap-3 md:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-lg sm:rounded-xl px-3 sm:px-4"
                  onClick={() => navigate('/seller/add-product')}
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium sm:font-semibold text-sm sm:text-base truncate">Add New Product</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Create a new listing</p>
                  </div>
                </Button>
                
              </div>
            </div>

            {/* Recent Products */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-black text-black">Recent Products</h3>
                  <p className="text-gray-600 font-medium mt-2">Your most recently added products</p>
                </div>
              </div>
              
              {products.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {products.slice(0, 6).map((product) => (
                    <Card key={product.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                      <div className="relative overflow-hidden rounded-t-2xl">
                        <img
                          src={product.image_url || product.imageUrl || '/placeholder-image.jpg'}
                          alt={product.name}
                          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <Badge 
                          variant="secondary"
                          className="absolute top-4 left-4 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold rounded-xl"
                        >
                          Available
                        </Badge>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{product.name}</h3>
                        <p className="text-yellow-600 font-black text-xl mb-3">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {product.aesthetic}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Package className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Add your first product to get started with your store</p>
                  <Button 
                    onClick={() => navigate('/seller/add-product')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Your First Product
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 sm:space-y-8 lg:space-y-10">
            <div className="text-center px-2 sm:px-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black mb-2 sm:mb-3">Store Settings</h2>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium max-w-3xl mx-auto">
                Manage your store configuration and preferences. Update your store details, location, and appearance.
              </p>
            </div>
            
            <div className="w-full max-w-7xl mx-auto space-y-6">
              {/* Banner Upload Section */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
                <BannerUpload 
                  currentBannerUrl={sellerProfile?.bannerImage} 
                  onBannerUploaded={(bannerUrl) => {
                    setSellerProfile(prev => prev ? { ...prev, bannerImage: bannerUrl } : {});
                  }} 
                />
              </div>

              {/* Theme Selection */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
                <ThemeSelector 
                  currentTheme={sellerProfile?.theme as any || 'default'}
                  onThemeChange={(theme) => {
                    setSellerProfile(prev => prev ? { ...prev, theme } : { theme });
                  }}
                />
              </div>

              {/* Store Information */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 lg:mb-8">
                  <div className="mb-4 lg:mb-0">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-black">Store Information</h3>
                    <p className="text-gray-600 text-sm sm:text-base font-medium mt-1 lg:mt-2">
                      Your store details and contact information
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                    {isEditing ? (
                      <>
                        <Button 
                          variant="outline"
                          onClick={toggleEdit}
                          disabled={isSaving}
                          className="text-xs sm:text-sm border-gray-300 hover:bg-gray-50 flex-1 sm:flex-none"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs sm:text-sm flex-1 sm:flex-none"
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={toggleEdit}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs sm:text-sm flex-1 sm:flex-none"
                      >
                        <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                        Edit Profile
                      </Button>
                    )}
                    <Button 
                      variant="destructive"
                      onClick={handleLogout}
                      className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm flex-1 sm:flex-none"
                    >
                      <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                      Logout
                    </Button>
                  </div>
                </div>


                
                {/* Profile Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 lg:mb-8">
                  <div className="p-4 sm:p-5 bg-gray-50 rounded-lg lg:rounded-xl">
                    <p className="text-sm font-medium text-gray-700 mb-1">Full Name</p>
                    <p className="text-base font-semibold text-black truncate" title={sellerProfile?.fullName || 'Not set'}>
                      {sellerProfile?.fullName || 'Not set'}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-gray-50 rounded-lg lg:rounded-xl">
                    <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                    <p className="text-base font-semibold text-black truncate" title={sellerProfile?.email || 'Not set'}>
                      {sellerProfile?.email || 'Not set'}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-gray-50 rounded-lg lg:rounded-xl">
                    <p className="text-sm font-medium text-gray-700 mb-1">Phone Number</p>
                    <p className="text-base font-semibold text-black">
                      {sellerProfile?.phone || 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Location Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg sm:text-xl font-bold text-black">Location Settings</h4>
                    {!isEditing && (
                      <button 
                        onClick={toggleEdit}
                        className="text-xs sm:text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Location
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 sm:p-4 bg-white rounded-lg lg:rounded-xl border border-gray-200">
                      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">City</p>
                      {isEditing ? (
                        <select
                          name="city"
                          value={formData.city}
                          onChange={handleCityChange}
                          className="w-full p-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white"
                        >
                          <option value="">Select a city</option>
                          {Object.keys(cities).map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm sm:text-base font-semibold text-black">
                          {sellerProfile?.city || 'Not set'}
                        </p>
                      )}
                    </div>
                    
                    <div className="p-3 sm:p-4 bg-white rounded-lg lg:rounded-xl border border-gray-200">
                      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Location/Area</p>
                      {isEditing ? (
                        <select
                          name="location"
                          value={formData.location}
                          onChange={handleLocationChange}
                          className="w-full p-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white"
                          disabled={!formData.city}
                        >
                          <option value="">Select a location</option>
                          {getLocations().map(location => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm sm:text-base font-semibold text-black">
                          {sellerProfile?.location || 'Not set'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      <Dialog open={isWithdrawalModalOpen} onOpenChange={setIsWithdrawalModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Please fill in your withdrawal details. Net revenue is 91% of your total sales.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mpesaNumber">M-Pesa Number</Label>
              <Input
                id="mpesaNumber"
                type="tel"
                placeholder="e.g., 254712345678"
                value={withdrawalData.mpesaNumber}
                onChange={(e) => setWithdrawalData({...withdrawalData, mpesaNumber: e.target.value})}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registeredName">Name as Registered on M-Pesa</Label>
              <Input
                id="registeredName"
                type="text"
                placeholder="Your full name"
                value={withdrawalData.registeredName}
                onChange={(e) => setWithdrawalData({...withdrawalData, registeredName: e.target.value})}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="amount">Amount to Withdraw (Ksh)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const availableBalance = analytics?.totalRevenue || 0;
                    setWithdrawalData({
                      ...withdrawalData,
                      amount: availableBalance.toFixed(2)
                    });
                  }}
                >
                  Use Available Balance
                </Button>
              </div>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={withdrawalData.amount}
                onChange={(e) => setWithdrawalData({...withdrawalData, amount: e.target.value})}
                disabled={isSubmitting}
                min="0"
                max={analytics?.totalRevenue || 0}
              />
              <p className="text-xs text-gray-500">
                Available: Ksh {analytics?.totalRevenue ? analytics.totalRevenue.toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Withdrawal requests are processed within 24-48 hours. A 9% commission fee applies to all withdrawals.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsWithdrawalModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!withdrawalData.mpesaNumber || !withdrawalData.registeredName || !withdrawalData.amount) {
                  toast({
                    title: 'Error',
                    description: 'Please fill in all fields',
                    variant: 'destructive',
                  });
                  return;
                }

                const availableBalance = analytics?.totalRevenue || 0;
                if (parseFloat(withdrawalData.amount) > availableBalance) {
                  toast({
                    title: 'Error',
                    description: `Withdrawal amount cannot exceed your available balance of Ksh ${availableBalance.toFixed(2)}`,
                    variant: 'destructive',
                  });
                  return;
                }

                try {
                  setIsSubmitting(true);
                  
                  // Send withdrawal request to the server
                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/sellers/withdrawals`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('sellerToken')}`
                    },
                    body: JSON.stringify({
                      mpesaNumber: withdrawalData.mpesaNumber,
                      registeredName: withdrawalData.registeredName,
                      amount: parseFloat(withdrawalData.amount)
                    })
                  });

                  const responseData = await response.json();
                  
                  if (!response.ok) {
                    throw new Error(responseData.message || 'Failed to process withdrawal request');
                  }

                  toast({
                    title: 'Success',
                    description: 'Your withdrawal request has been submitted successfully!',
                  });
                  
                  setIsWithdrawalModalOpen(false);
                } catch (error) {
                  console.error('Error submitting withdrawal request:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to submit withdrawal request. Please try again.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerDashboard;