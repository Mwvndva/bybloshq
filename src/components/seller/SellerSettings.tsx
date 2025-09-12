import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sellerApi } from '@/api/sellerApi';

function SellerSettings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await sellerApi.getProfile();
        setProfile({
          fullName: profileData.fullName || profileData.full_name || '',
          email: profileData.email || '',
          phone: profileData.phone || ''
        });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile information',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-medium">Profile Information</h2>
          <p className="text-sm text-gray-500">Your account's profile information.</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="text-sm py-2 px-3 border rounded-md bg-black">
                {profile.fullName || 'Not provided'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="text-sm py-2 px-3 border rounded-md bg-black">
                {profile.email || 'Not provided'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="text-sm py-2 px-3 border rounded-md bg-black">
                {profile.phone || 'Not provided'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 mt-12 pt-8">
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-medium text-red-600">Danger Zone</h2>
            <p className="text-sm text-gray-500">
              Once you delete your account, there is no going back. Please be certain.
            </p>
          </div>

          <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SellerSettings;
