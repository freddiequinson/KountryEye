import { useQuery } from '@tanstack/react-query';
import { Star, Calendar, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MarketingDashboard() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['marketing-stats'],
    queryFn: async () => {
      const [campaignsRes, ratingsRes] = await Promise.all([
        api.get('/marketing/campaigns'),
        api.get('/marketing/ratings'),
      ]);
      
      const campaigns = campaignsRes.data || [];
      const ratings = ratingsRes.data || [];
      
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / ratings.length
        : 0;
      
      return {
        activeCampaigns: campaigns.filter((c: any) => c.status === 'active').length,
        totalCampaigns: campaigns.length,
        avgRating: avgRating.toFixed(1),
        totalRatings: ratings.length,
        recentCampaigns: campaigns.slice(0, 5),
        recentRatings: ratings.slice(0, 5),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing Dashboard</h1>
          <p className="text-muted-foreground">Campaign and ratings overview</p>
        </div>
        <Button onClick={() => navigate('/marketing')}>Go to Marketing</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeCampaigns || 0}</div>
            <p className="text-xs text-muted-foreground">of {stats?.totalCampaigns || 0} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgRating || '0.0'}</div>
            <p className="text-xs text-muted-foreground">out of 5.0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRatings || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">coming soon</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentCampaigns?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No campaigns yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.recentCampaigns?.map((campaign: any) => (
                  <div key={campaign.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{campaign.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">{campaign.campaign_type}</span>
                    </div>
                    <Badge variant={campaign.status === 'active' ? 'success' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentRatings?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No ratings yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.recentRatings?.map((rating: any) => (
                  <div key={rating.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= (rating.overall_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(rating.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
