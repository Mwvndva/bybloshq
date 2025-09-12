import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';

export default function SellerOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your store's orders
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Orders Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Package className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              We're working on bringing you a seamless order management experience. 
              This feature will be available in an upcoming update.
            </p>
            <Button disabled variant="outline">
              Check Back Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}