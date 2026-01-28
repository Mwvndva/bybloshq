import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganizerAuth } from '@/contexts/GlobalAuthContext';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Phone, Trash2, Save, Edit, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';

// Form schemas
const profileFormSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  whatsapp_number: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function SettingsPage() {
  const { organizer } = useOrganizerAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  // Initialize profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: organizer?.full_name || '',
      email: organizer?.email || '',
      whatsapp_number: organizer?.whatsapp_number || '',
    },
  });

  // Set initial form values when organizer data is available
  useEffect(() => {
    if (organizer) {
      profileForm.reset({
        full_name: organizer.full_name || '',
        email: organizer.email || '',
        whatsapp_number: organizer.whatsapp_number || '',
      });
    }
  }, [organizer]);

  const handleSaveProfile = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      await apiClient.patch('/organizers/profile', data);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await apiClient.delete('/organizers/account');
        toast.success('Account deleted successfully');
        navigate('/');
      } catch (error) {
        console.error('Error deleting account:', error);
        toast.error('Failed to delete account. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Desktop Header - Full Width */}
      <div className="hidden md:block bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10 shadow-sm px-4 sm:px-6 lg:px-8 py-3 sm:py-4 mb-8 md:mb-10">
        <div className="relative flex items-center justify-between h-14 lg:h-16">
          <div className="flex-1 flex items-center justify-start">
            <Button
              variant="secondary-byblos"
              onClick={() => navigate('/organizer/dashboard')}
              className="rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm h-8"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 min-w-0 max-w-[50%] text-center px-1 sm:px-2">
            <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight truncate">
              Account Settings
            </h1>
            <p className="hidden sm:block text-xs text-gray-300 font-medium truncate">
              Manage your account information and preferences
            </p>
          </div>

          <div className="flex-1 flex items-center justify-end">
            <Button
              variant="secondary-byblos"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 sm:gap-2 rounded-xl h-8 px-2 sm:px-3 py-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden md:inline text-sm">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Settings Sections */}
        <div className="space-y-8">
          {/* Profile Information */}
          <div className="bg-[#111111] border border-[#222222] rounded-3xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white">Profile Information</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-xl px-4 py-2"
              >
                {isEditing ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
            </div>

            {isEditing ? (
              <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Full Name</Label>
                    <Input
                      {...profileForm.register('full_name')}
                      className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      placeholder="Enter your full name"
                    />
                    {profileForm.formState.errors.full_name && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Email Address</Label>
                    <Input
                      {...profileForm.register('email')}
                      type="email"
                      className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      placeholder="Enter your email"
                    />
                    {profileForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">WhatsApp Number</Label>
                    <Input
                      {...profileForm.register('whatsapp_number')}
                      className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      placeholder="Enter your phone number"
                    />
                    {profileForm.formState.errors.whatsapp_number && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.whatsapp_number.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl px-6 py-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    variant="byblos"
                    className="shadow-lg px-6 py-3 rounded-xl"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-300">Full Name</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gray-900 border border-white/10 rounded-2xl">
                      <User className="h-5 w-5 text-gray-300" />
                      <span className="font-medium text-white">
                        {profileForm.getValues('full_name') || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-300">Email Address</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gray-900 border border-white/10 rounded-2xl">
                      <Mail className="h-5 w-5 text-gray-300" />
                      <span className="font-medium text-white">
                        {profileForm.getValues('email') || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-300">WhatsApp Number</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gray-900 border border-white/10 rounded-2xl">
                      <Phone className="h-5 w-5 text-gray-300" />
                      <span className="font-medium text-white">
                        {profileForm.getValues('whatsapp_number') || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Danger Zone */}
          <div className="bg-[#111111] border border-red-500/20 rounded-3xl p-8 shadow-lg">
            <h3 className="text-2xl font-black text-red-500 mb-6">Danger Zone</h3>
            <div className="p-6 border border-red-500/30 rounded-2xl bg-red-500/5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-red-600 text-lg">Delete Account</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}