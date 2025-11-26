import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  createPromoCode,
  getEventPromoCodes,
  updatePromoCode,
  deletePromoCode,
  getPromoCodeStats,
  type PromoCode,
  type PromoCodeCreateData,
  type PromoCodeUpdateData
} from '@/api/promoCodeApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, BarChart3, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface PromoCodeManagerProps {
  eventId: number;
}

export default function PromoCodeManager({ eventId }: PromoCodeManagerProps) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [statsCode, setStatsCode] = useState<PromoCode | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<PromoCodeCreateData>({
    event_id: eventId,
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    max_uses: null,
    min_purchase_amount: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: null,
    is_active: true,
  });

  useEffect(() => {
    loadPromoCodes();
  }, [eventId]);

  const loadPromoCodes = async () => {
    try {
      setLoading(true);
      const codes = await getEventPromoCodes(eventId);
      setPromoCodes(codes);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load promo codes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.code || !formData.discount_value) {
        toast({
          title: 'Validation Error',
          description: 'Code and discount value are required',
          variant: 'destructive',
        });
        return;
      }

      if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
        toast({
          title: 'Validation Error',
          description: 'Percentage discount cannot exceed 100%',
          variant: 'destructive',
        });
        return;
      }

      await createPromoCode(formData);
      toast({
        title: 'Success',
        description: 'Promo code created successfully',
      });
      setIsCreateDialogOpen(false);
      resetForm();
      loadPromoCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create promo code',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (id: number, data: PromoCodeUpdateData) => {
    try {
      await updatePromoCode(id, data);
      toast({
        title: 'Success',
        description: 'Promo code updated successfully',
      });
      setEditingCode(null);
      loadPromoCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update promo code',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this promo code?')) {
      return;
    }

    try {
      await deletePromoCode(id);
      toast({
        title: 'Success',
        description: 'Promo code deleted successfully',
      });
      loadPromoCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete promo code',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (code: PromoCode) => {
    await handleUpdate(code.id, { is_active: !code.is_active });
  };

  const resetForm = () => {
    setFormData({
      event_id: eventId,
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      max_uses: null,
      min_purchase_amount: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: null,
      is_active: true,
    });
  };

  const getStatusBadge = (code: PromoCode) => {
    const now = new Date();
    const validFrom = parseISO(code.valid_from);
    const validUntil = code.valid_until ? parseISO(code.valid_until) : null;

    if (!code.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }

    if (now < validFrom) {
      return <Badge variant="outline">Not Yet Valid</Badge>;
    }

    if (validUntil && now > validUntil) {
      return <Badge variant="destructive">Expired</Badge>;
    }

    if (code.max_uses !== null && code.used_count >= code.max_uses) {
      return <Badge variant="destructive">Max Uses Reached</Badge>;
    }

    return <Badge variant="default">Active</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Promo Codes</h3>
          <p className="text-sm text-muted-foreground">
            Create discount codes for your event
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create Promo Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Promo Code</DialogTitle>
              <DialogDescription>
                Create a discount code for your event. Customers can use this code when purchasing tickets.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="SUMMER2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_type">Discount Type *</Label>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  Discount Value * ({formData.discount_type === 'percentage' ? '%' : 'KES'})
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  max={formData.discount_type === 'percentage' ? '100' : undefined}
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description for this promo code"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_uses">Max Uses (leave empty for unlimited)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    value={formData.max_uses || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_uses: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_purchase_amount">Min Purchase Amount (KES)</Label>
                  <Input
                    id="min_purchase_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.min_purchase_amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_purchase_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until (optional)</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        valid_until: e.target.value || null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {promoCodes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No promo codes created yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first promo code to offer discounts to customers
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Promo Codes ({promoCodes.length})</CardTitle>
            <CardDescription>Manage discount codes for this event</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {code.discount_type === 'percentage' ? '%' : 'KES'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {code.discount_type === 'percentage'
                        ? `${code.discount_value}%`
                        : formatCurrency(code.discount_value)}
                    </TableCell>
                    <TableCell>
                      {code.used_count} / {code.max_uses ?? '∞'}
                    </TableCell>
                    <TableCell>
                      {code.valid_until
                        ? format(parseISO(code.valid_until), 'MMM dd, yyyy')
                        : 'No expiry'}
                    </TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(code)}
                        >
                          <Switch checked={code.is_active} readOnly />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatsCode(code)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCode(code)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(code.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {editingCode && (
        <EditPromoCodeDialog
          code={editingCode}
          onClose={() => setEditingCode(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Stats Dialog */}
      {statsCode && (
        <PromoCodeStatsDialog
          code={statsCode}
          onClose={() => setStatsCode(null)}
        />
      )}
    </div>
  );
}

// Edit Dialog Component
function EditPromoCodeDialog({
  code,
  onClose,
  onUpdate,
}: {
  code: PromoCode;
  onClose: () => void;
  onUpdate: (id: number, data: PromoCodeUpdateData) => Promise<void>;
}) {
  const [formData, setFormData] = useState<PromoCodeUpdateData>({
    code: code.code,
    description: code.description || '',
    discount_type: code.discount_type,
    discount_value: code.discount_value,
    max_uses: code.max_uses,
    min_purchase_amount: code.min_purchase_amount,
    valid_from: code.valid_from.split('T')[0],
    valid_until: code.valid_until ? code.valid_until.split('T')[0] : null,
    is_active: code.is_active,
  });

  const handleSubmit = async () => {
    await onUpdate(code.id, formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Promo Code</DialogTitle>
          <DialogDescription>Update the promo code details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Same form fields as create dialog */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_code">Code *</Label>
              <Input
                id="edit_code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_discount_type">Discount Type *</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_discount_value">
              Discount Value * ({formData.discount_type === 'percentage' ? '%' : 'KES'})
            </Label>
            <Input
              id="edit_discount_value"
              type="number"
              min="0"
              max={formData.discount_type === 'percentage' ? '100' : undefined}
              step="0.01"
              value={formData.discount_value}
              onChange={(e) =>
                setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_description">Description</Label>
            <Textarea
              id="edit_description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_max_uses">Max Uses</Label>
              <Input
                id="edit_max_uses"
                type="number"
                min="1"
                value={formData.max_uses || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_uses: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_min_purchase">Min Purchase (KES)</Label>
              <Input
                id="edit_min_purchase"
                type="number"
                min="0"
                step="0.01"
                value={formData.min_purchase_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_purchase_amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_valid_from">Valid From</Label>
              <Input
                id="edit_valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) =>
                  setFormData({ ...formData, valid_from: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_valid_until">Valid Until</Label>
              <Input
                id="edit_valid_until"
                type="date"
                value={formData.valid_until || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    valid_until: e.target.value || null,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="edit_is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
            <Label htmlFor="edit_is_active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Stats Dialog Component
function PromoCodeStatsDialog({
  code,
  onClose,
}: {
  code: PromoCode;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getPromoCodeStats(code.id);
        setStats(data.usage);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [code.id]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promo Code Statistics</DialogTitle>
          <DialogDescription>Usage statistics for {code.code}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Uses</p>
                <p className="text-2xl font-bold">{stats.total_uses || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Discount Given</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.total_discount_given || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Original Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.total_original_revenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Final Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.total_final_revenue || 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No statistics available</p>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

