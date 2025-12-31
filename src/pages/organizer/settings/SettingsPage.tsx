import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganizerAuth } from '@/hooks/use-organizer-auth';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Phone, Trash2, Save, Edit, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

// Form schemas
const profileFormSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
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
      phone: organizer?.phone || '',
    },
  });

  // Set initial form values when organizer data is available
  useEffect(() => {
    if (organizer) {
      profileForm.reset({
        full_name: organizer.full_name || '',
        email: organizer.email || '',
        phone: organizer.phone || '',
      });
    }
  }, [organizer]);

  const handleSaveProfile = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      await api.patch('/organizers/profile', data);
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
        await api.delete('/organizers/account');
        toast.success('Account deleted successfully');
        navigate('/');
      } catch (error) {
        console.error('Error deleting account:', error);
        toast.error('Failed to delete account. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/organizer/dashboard')}
            className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl md:text-4xl font-black text-black mb-4">Account Settings</h1>
          <p className="text-gray-600 text-lg font-medium">Manage your account information and preferences</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {/* Profile Information */}
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-black">Profile Information</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
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
                    <Label className="text-sm font-bold text-gray-700">Phone Number</Label>
                    <Input
                      {...profileForm.register('phone')}
                      className="h-12 rounded-xl border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      placeholder="Enter your phone number"
                    />
                    {profileForm.formState.errors.phone && (
                      <p className="text-sm text-red-600">{profileForm.formState.errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
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
                    <Label className="text-sm font-bold text-gray-700">Full Name</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                      <User className="h-5 w-5 text-gray-500" />
                      <span className="font-medium text-black">
                        {profileForm.getValues('full_name') || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Email Address</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                      <Mail className="h-5 w-5 text-gray-500" />
                      <span className="font-medium text-black">
                        {profileForm.getValues('email') || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700">Phone Number</Label>
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200">
                      <Phone className="h-5 w-5 text-gray-500" />
                      <span className="font-medium text-black">
                        {profileForm.getValues('phone') || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Danger Zone */}
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
            <h3 className="text-2xl font-black text-red-600 mb-6">Danger Zone</h3>
            <div className="p-6 border-2 border-red-200 rounded-2xl bg-red-50/50">
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