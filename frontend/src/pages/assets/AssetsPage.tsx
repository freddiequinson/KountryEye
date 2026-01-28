import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Asset } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function AssetsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    description: '',
    serial_number: '',
    model: '',
    manufacturer: '',
    location: '',
    purchase_date: '',
    purchase_price: '',
    maintenance_interval_days: '',
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await api.get('/assets');
      return response.data;
    },
  });

  const { data: healthReport } = useQuery({
    queryKey: ['asset-health'],
    queryFn: async () => {
      const response = await api.get('/assets/reports/health');
      return response.data;
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-health'] });
      setIsDialogOpen(false);
      setAssetForm({
        name: '',
        description: '',
        serial_number: '',
        model: '',
        manufacturer: '',
        location: '',
        purchase_date: '',
        purchase_price: '',
        maintenance_interval_days: '',
      });
      toast({ title: 'Asset created successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAssetMutation.mutate({
      ...assetForm,
      purchase_price: assetForm.purchase_price
        ? parseFloat(assetForm.purchase_price)
        : null,
      maintenance_interval_days: assetForm.maintenance_interval_days
        ? parseInt(assetForm.maintenance_interval_days)
        : null,
    });
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Asset Management</h1>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthReport?.total_assets || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Good Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {healthReport?.by_condition?.good || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Maintenance Due</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {healthReport?.maintenance_due || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Warranty Expiring</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {healthReport?.warranty_expiring_soon || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Next Maintenance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No assets found
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset: Asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.location || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={asset.status === 'active' ? 'success' : 'secondary'}
                      >
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          asset.condition === 'good'
                            ? 'success'
                            : asset.condition === 'fair'
                            ? 'warning'
                            : 'destructive'
                        }
                      >
                        {asset.condition}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {asset.next_maintenance_date
                        ? new Date(asset.next_maintenance_date).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name</Label>
                <Input
                  id="name"
                  value={assetForm.name}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={assetForm.serial_number}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, serial_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={assetForm.model}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, model: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={assetForm.manufacturer}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, manufacturer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={assetForm.location}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, location: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={assetForm.purchase_date}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, purchase_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    value={assetForm.purchase_price}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, purchase_price: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance_interval">Maintenance Interval (days)</Label>
                <Input
                  id="maintenance_interval"
                  type="number"
                  value={assetForm.maintenance_interval_days}
                  onChange={(e) =>
                    setAssetForm({
                      ...assetForm,
                      maintenance_interval_days: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={assetForm.description}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, description: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createAssetMutation.isPending}>
                  {createAssetMutation.isPending ? 'Creating...' : 'Create Asset'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
