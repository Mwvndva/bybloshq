import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function SellerSettings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    location: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await sellerApi.getProfile();
        setProfile({
          fullName: profileData.fullName || profileData.full_name || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
          city: profileData.city || '',
          location: profileData.location || ''
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Manage your account's profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="text-sm p-2.5 rounded-md border bg-muted/50">
                {profile.fullName || 'Not provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="text-sm p-2.5 rounded-md border bg-muted/50">
                {profile.email || 'Not provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="text-sm p-2.5 rounded-md border bg-muted/50">
                {profile.phone || 'Not provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <div className="text-sm p-2.5 rounded-md border bg-muted/50">
                {profile.city || 'Not provided'}
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="location">Location</Label>
              <div className="text-sm p-2.5 rounded-md border bg-muted/50">
                {profile.location || 'Not provided'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/30">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-500">Danger Zone</CardTitle>
          <CardDescription>
            Once you delete your account, there is no going back. Please be certain.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 border-t border-red-100 dark:border-red-900/30 p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Delete Account</h3>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all of its contents.
            </p>
          </div>
          <Button 
            variant="destructive" 
            className="w-full sm:w-auto"
            onClick={() => {
              // Add delete confirmation logic here
              toast({
                title: "Account deletion",
                description: "This feature is not yet implemented.",
                variant: "destructive",
              });
            }}
          >
            Delete Account
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SellerSettings;
