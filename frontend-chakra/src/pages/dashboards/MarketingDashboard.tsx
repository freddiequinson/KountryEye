import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Flex, Icon, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { MdEvent, MdPeople, MdStar, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'

export default function MarketingDashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['marketing-stats'],
    queryFn: async () => {
      const [campaignsRes, ratingsRes] = await Promise.all([api.get('/marketing/campaigns'), api.get('/marketing/ratings')])
      const campaigns = campaignsRes.data || []
      const ratings = ratingsRes.data || []
      const avgRating = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / ratings.length : 0

      return {
        activeCampaigns: campaigns.filter((c: any) => c.status === 'active').length,
        totalCampaigns: campaigns.length,
        avgRating: avgRating.toFixed(1),
        totalRatings: ratings.length,
        recentCampaigns: campaigns.slice(0, 5),
        recentRatings: ratings.slice(0, 5),
      }
    },
  })

  return (
    <>
      <PageHeader
        title="Marketing Dashboard"
        description="Campaign and ratings overview"
        actions={
          <Button variant="brand" onClick={() => navigate('/marketing')}>
            Go to Marketing
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Active Campaigns" value={stats?.activeCampaigns || 0} icon={MdEvent} helpText={`of ${stats?.totalCampaigns || 0} total`} />
        <StatCard name="Average Rating" value={stats?.avgRating || '0.0'} icon={MdStar} iconColor="yellow.500" helpText="out of 5.0" />
        <StatCard name="Total Ratings" value={stats?.totalRatings || 0} icon={MdPeople} iconColor="secondaryGray.600" />
        <StatCard name="Engagement" value="-" icon={MdTrendingUp} iconColor="green.500" helpText="coming soon" />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px">
        <SectionCard title="Recent Campaigns">
          {stats?.recentCampaigns?.length === 0 ? (
            <Text color="secondaryGray.600" textAlign="center" py="16px">
              No campaigns yet
            </Text>
          ) : (
            <Stack spacing="12px">
              {stats?.recentCampaigns?.map((campaign: any) => (
                <RowBox key={campaign.id} p="8px 12px">
                  <Box>
                    <Text as="span" fontWeight="500">
                      {campaign.name}
                    </Text>
                    <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                      {campaign.campaign_type}
                    </Text>
                  </Box>
                  <Badge colorScheme={campaign.status === 'active' ? 'green' : 'gray'} borderRadius="full">
                    {campaign.status}
                  </Badge>
                </RowBox>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Recent Ratings">
          {stats?.recentRatings?.length === 0 ? (
            <Text color="secondaryGray.600" textAlign="center" py="16px">
              No ratings yet
            </Text>
          ) : (
            <Stack spacing="12px">
              {stats?.recentRatings?.map((rating: any) => (
                <RowBox key={rating.id} p="8px 12px">
                  <Flex gap="4px">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon key={star} as={MdStar} color={star <= (rating.overall_rating || 0) ? 'yellow.500' : 'gray.300'} />
                    ))}
                  </Flex>
                  <Text fontSize="sm" color="secondaryGray.600">
                    {new Date(rating.created_at).toLocaleDateString()}
                  </Text>
                </RowBox>
              ))}
            </Stack>
          )}
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
