import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, TrendingUp, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { Campaign, CustomerRating } from '@/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function MarketingPage() {
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    campaign_type: '',
    start_date: '',
    end_date: '',
    budget: '',
    target_audience: '',
    goals: '',
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await api.get('/marketing/campaigns');
      return response.data;
    },
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['ratings'],
    queryFn: async () => {
      const response = await api.get('/marketing/ratings');
      return response.data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['marketing-analytics'],
    queryFn: async () => {
      const response = await api.get('/marketing/analytics');
      return response.data;
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => api.post('/marketing/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsCampaignDialogOpen(false);
      setCampaignForm({
        name: '',
        description: '',
        campaign_type: '',
        start_date: '',
        end_date: '',
        budget: '',
        target_audience: '',
        goals: '',
      });
      toast({ title: 'Campaign created successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaignMutation.mutate({
      ...campaignForm,
      budget: campaignForm.budget ? parseFloat(campaignForm.budget) : null,
    });
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Marketing</h1>
          <Button onClick={() => setIsCampaignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.average_overall?.toFixed(1) || '0.0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics?.total_ratings || 0} reviews
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recommendation</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.recommendation_rate?.toFixed(0) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">would recommend</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaigns.filter((c: Campaign) => c.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Google Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.google_reviews_submitted || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics?.google_reviews_requested || 0} requested
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="ratings">Customer Ratings</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No campaigns found
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign: Campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.campaign_type || '-'}</TableCell>
                        <TableCell>
                          {campaign.start_date
                            ? new Date(campaign.start_date).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {campaign.end_date
                            ? new Date(campaign.end_date).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {campaign.budget
                            ? campaign.budget.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'GHS',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              campaign.status === 'active'
                                ? 'success'
                                : campaign.status === 'completed'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ratings" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Recommend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No ratings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    ratings.map((rating: CustomerRating) => (
                      <TableRow key={rating.id}>
                        <TableCell>
                          {new Date(rating.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-500 mr-1" />
                            {rating.overall_rating || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{rating.service_rating || '-'}</TableCell>
                        <TableCell>{rating.staff_rating || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {rating.feedback || '-'}
                        </TableCell>
                        <TableCell>
                          {rating.would_recommend !== null ? (
                            <Badge variant={rating.would_recommend ? 'success' : 'destructive'}>
                              {rating.would_recommend ? 'Yes' : 'No'}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={campaignForm.name}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign_type">Type</Label>
                  <Input
                    id="campaign_type"
                    value={campaignForm.campaign_type}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, campaign_type: e.target.value })
                    }
                    placeholder="e.g., Social Media, Event"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={campaignForm.budget}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, budget: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={campaignForm.start_date}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={campaignForm.end_date}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_audience">Target Audience</Label>
                <Input
                  id="target_audience"
                  value={campaignForm.target_audience}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, target_audience: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals">Goals</Label>
                <Textarea
                  id="goals"
                  value={campaignForm.goals}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, goals: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={campaignForm.description}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, description: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCampaignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCampaignMutation.isPending}>
                  {createCampaignMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
