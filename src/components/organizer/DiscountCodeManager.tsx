import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Check, X, Percent, DollarSign, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';

interface DiscountCode {
  id: number;
  event_id: number;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_count: number;
  actual_usage_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
  stats?: {
    total_usage: number;
    total_discount_given: number;
    last_used_at: string;
    unique_customers: number;
  };
}

interface DiscountCodeManagerProps {
  eventId: number;
  eventName: string;
}

export const DiscountCodeManager = ({ eventId, eventName }: DiscountCodeManagerProps) => {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_amount: '0',
    max_discount_amount: '',
    usage_limit: '',
    valid_from: '',
    valid_until: '',
    is_active: true
  });

  useEffect(() => {
    fetchDiscountCodes();
  }, [eventId]);

  const fetchDiscountCodes = async () => {
    try {
      const response = await api.get(`/discount-codes/event/${eventId}`);
      setDiscountCodes((response.data as any)?.data || []);
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch discount codes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '0',
      max_discount_amount: '',
      usage_limit: '',
      valid_from: '',
      valid_until: '',
      is_active: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        event_id: eventId,
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: parseFloat(formData.min_order_amount),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : undefined,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : undefined,
        valid_from: formData.valid_from || new Date().toISOString(),
        valid_until: formData.valid_until || undefined
      };

      if (editingCode) {
        await api.put(`/discount-codes/${editingCode.id}`, payload);
      } else {
        await api.post('/discount-codes', payload);
      }

      toast({
        title: 'Success',
        description: `Discount code ${editingCode ? 'updated' : 'created'} successfully`
      });
      
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingCode(null);
      resetForm();
      fetchDiscountCodes();
    } catch (error: any) {
      console.error('Error saving discount code:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save discount code',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      min_order_amount: code.min_order_amount.toString(),
      max_discount_amount: code.max_discount_amount?.toString() || '',
      usage_limit: code.usage_limit?.toString() || '',
      valid_from: code.valid_from ? new Date(code.valid_from).toISOString().slice(0, 16) : '',
      valid_until: code.valid_until ? new Date(code.valid_until).toISOString().slice(0, 16) : '',
      is_active: code.is_active
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (code: DiscountCode) => {
    if (!confirm(`Are you sure you want to delete discount code "${code.code}"?`)) {
      return;
    }

    try {
      await api.delete(`/discount-codes/${code.id}`);
      
      toast({
        title: 'Success',
        description: 'Discount code deleted successfully'
      });
      fetchDiscountCodes();
    } catch (error: any) {
      console.error('Error deleting discount code:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete discount code',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const getDiscountDisplay = (code: DiscountCode) => {
    if (code.discount_type === 'percentage') {
      return `${code.discount_value}%`;
    } else {
      return formatCurrency(code.discount_value);
    }
  };

  const getUsageStatus = (code: DiscountCode) => {
    if (!code.usage_limit) return { color: 'bg-blue-100 text-blue-800', text: 'Unlimited' };
    
    const percentage = (code.actual_usage_count / code.usage_limit) * 100;
    if (percentage >= 100) return { color: 'bg-red-100 text-red-800', text: 'Used up' };
    if (percentage >= 75) return { color: 'bg-orange-100 text-orange-800', text: 'Low usage' };
    return { color: 'bg-green-100 text-green-800', text: `${code.usage_limit - code.actual_usage_count} left` };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Discount Codes</h3>
          <p className="text-sm text-gray-600">Manage discount codes for "{eventName}"</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Discount Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Discount Code</DialogTitle>
              <DialogDescription>
                Create a new discount code for your event
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Discount Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Early bird special"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount_type">Discount Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: 'percentage' | 'fixed') => 
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="discount_value">
                    {formData.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (KSh)'}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_order_amount">Minimum Order Amount (KSh)</Label>
                  <Input
                    id="min_order_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                
                {formData.discount_type === 'percentage' && (
                  <div>
                    <Label htmlFor="max_discount_amount">Max Discount Amount (KSh)</Label>
                    <Input
                      id="max_discount_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.max_discount_amount}
                      onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usage_limit">Usage Limit (optional)</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
                
                <div>
                  <Label htmlFor="valid_until">Valid Until (optional)</Label>
                  <Input
                    id="valid_until"
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Discount Code</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {discountCodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <Percent className="h-6 w-6 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No discount codes</h3>
            <p className="text-gray-600 text-center mb-4">
              Create discount codes to offer special deals to your customers
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Discount Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {discountCodes.map((code) => {
            const usageStatus = getUsageStatus(code);
            
            return (
              <Card key={code.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg">{code.code}</h4>
                        <Badge className={usageStatus.color}>
                          {usageStatus.text}
                        </Badge>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      {code.description && (
                        <p className="text-gray-600 mb-2">{code.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          {code.discount_type === 'percentage' ? (
                            <Percent className="h-4 w-4" />
                          ) : (
                            <DollarSign className="h-4 w-4" />
                          )}
                          <span>{getDiscountDisplay(code)} discount</span>
                        </div>
                        
                        {code.min_order_amount > 0 && (
                          <span>Min order: {formatCurrency(code.min_order_amount)}</span>
                        )}
                        
                        {code.usage_limit && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{code.actual_usage_count}/{code.usage_limit} used</span>
                          </div>
                        )}
                        
                        {code.valid_until && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Expires: {formatDate(code.valid_until)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(code.code)}
                      >
                        {copiedCode === code.code ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(code)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(code)}
                        disabled={code.actual_usage_count > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {code.stats && (
                    <div className="border-t pt-4 mt-4">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Total Usage</p>
                          <p className="font-semibold">{code.stats.total_usage}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Discount Given</p>
                          <p className="font-semibold">{formatCurrency(code.stats.total_discount_given)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Unique Customers</p>
                          <p className="font-semibold">{code.stats.unique_customers}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Last Used</p>
                          <p className="font-semibold">
                            {code.stats.last_used_at ? formatDate(code.stats.last_used_at) : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Discount Code</DialogTitle>
            <DialogDescription>
              Update discount code settings
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit_code">Discount Code</Label>
              <Input
                id="edit_code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_discount_type">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setFormData({ ...formData, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit_discount_value">
                  {formData.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (KSh)'}
                </Label>
                <Input
                  id="edit_discount_value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Discount Code</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
