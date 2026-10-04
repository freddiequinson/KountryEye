import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Icon, Input, SimpleGrid, Stack, Tab, Table, TabList, TabPanel, TabPanels, Tabs, Tbody, Td, Textarea, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAdd, MdEvent, MdStar, MdTrendingUp } from 'react-icons/md'
import { FaGoogle } from 'react-icons/fa'
import api from '@/lib/api'
import type { Campaign, CustomerRating } from '@/types'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

const emptyCampaign = { name: '', description: '', campaign_type: '', start_date: '', end_date: '', budget: '', target_audience: '', goals: '' }

export default function MarketingPage() {
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false)
  const [campaignForm, setCampaignForm] = useState(emptyCampaign)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/marketing/campaigns')).data,
  })

  const { data: ratings = [] } = useQuery({
    queryKey: ['ratings'],
    queryFn: async () => (await api.get('/marketing/ratings')).data,
  })

  const { data: analytics } = useQuery({
    queryKey: ['marketing-analytics'],
    queryFn: async () => (await api.get('/marketing/analytics')).data,
  })

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => api.post('/marketing/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setIsCampaignDialogOpen(false)
      setCampaignForm(emptyCampaign)
      toast({ title: 'Campaign created successfully' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createCampaignMutation.mutate({ ...campaignForm, budget: campaignForm.budget ? parseFloat(campaignForm.budget) : null })
  }

  const cf = (key: keyof typeof emptyCampaign) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCampaignForm({ ...campaignForm, [key]: e.target.value })

  return (
    <>
      <PageHeader
        title="Marketing"
        actions={
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsCampaignDialogOpen(true)}>
            New Campaign
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px" data-tour="campaigns">
        <StatCard
          name="Avg Rating"
          value={analytics?.average_overall?.toFixed(1) || '0.0'}
          icon={MdStar}
          iconColor="yellow.500"
          helpText={`${analytics?.total_ratings || 0} reviews`}
        />
        <StatCard name="Recommendation" value={`${analytics?.recommendation_rate?.toFixed(0) || 0}%`} icon={MdTrendingUp} helpText="would recommend" />
        <StatCard name="Active Campaigns" value={campaigns.filter((c: Campaign) => c.status === 'active').length} icon={MdEvent} />
        <StatCard
          name="Google Reviews"
          value={analytics?.google_reviews_submitted || 0}
          icon={FaGoogle}
          helpText={`${analytics?.google_reviews_requested || 0} requested`}
        />
      </SimpleGrid>

      <Tabs variant="soft-rounded" data-tour="leads">
        <TabList gap="8px" mb="16px">
          <Tab>Campaigns</Tab>
          <Tab>Customer Ratings</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>Start Date</Th>
                      <Th>End Date</Th>
                      <Th>Budget</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {campaigns.length === 0 ? (
                      <TableMessageRow colSpan={6}>No campaigns found</TableMessageRow>
                    ) : (
                      campaigns.map((campaign: Campaign) => (
                        <Tr key={campaign.id}>
                          <Td fontWeight="600">{campaign.name}</Td>
                          <Td>{campaign.campaign_type || '-'}</Td>
                          <Td>{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : '-'}</Td>
                          <Td>{campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : '-'}</Td>
                          <Td>{campaign.budget ? campaign.budget.toLocaleString('en-US', { style: 'currency', currency: 'GHS' }) : '-'}</Td>
                          <Td>
                            <Badge
                              colorScheme={campaign.status === 'active' ? 'green' : 'gray'}
                              variant={campaign.status === 'active' || campaign.status === 'completed' ? 'subtle' : 'outline'}
                            >
                              {String(campaign.status ?? '').replace(/_/g, ' ')}
                            </Badge>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Overall</Th>
                      <Th>Service</Th>
                      <Th>Staff</Th>
                      <Th>Feedback</Th>
                      <Th>Recommend</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {ratings.length === 0 ? (
                      <TableMessageRow colSpan={6}>No ratings found</TableMessageRow>
                    ) : (
                      ratings.map((rating: CustomerRating) => (
                        <Tr key={rating.id}>
                          <Td>{new Date(rating.created_at).toLocaleDateString()}</Td>
                          <Td>
                            <Flex align="center" gap="4px">
                              <Icon as={MdStar} color="yellow.500" />
                              {rating.overall_rating || '-'}
                            </Flex>
                          </Td>
                          <Td>{rating.service_rating || '-'}</Td>
                          <Td>{rating.staff_rating || '-'}</Td>
                          <Td maxW="320px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {rating.feedback || '-'}
                          </Td>
                          <Td>
                            {rating.would_recommend !== null ? (
                              <Badge colorScheme={rating.would_recommend ? 'green' : 'red'}>{rating.would_recommend ? 'Yes' : 'No'}</Badge>
                            ) : (
                              '-'
                            )}
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <AppModal
        isOpen={isCampaignDialogOpen}
        onClose={() => setIsCampaignDialogOpen(false)}
        size="lg"
        title="Create Campaign"
        footer={
          <>
            <Button variant="light" onClick={() => setIsCampaignDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="campaign-form" variant="brand" isLoading={createCampaignMutation.isPending} loadingText="Creating...">
              Create
            </Button>
          </>
        }
      >
        <form id="campaign-form" onSubmit={handleSubmit}>
          <Stack spacing="16px">
            <Field label="Campaign Name" isRequired>
              <Input variant="main" value={campaignForm.name} onChange={cf('name')} />
            </Field>
            <SimpleGrid columns={2} spacing="16px">
              <Field label="Type">
                <Input variant="main" placeholder="e.g., Social Media, Event" value={campaignForm.campaign_type} onChange={cf('campaign_type')} />
              </Field>
              <Field label="Budget">
                <Input variant="main" type="number" value={campaignForm.budget} onChange={cf('budget')} />
              </Field>
              <Field label="Start Date">
                <Input variant="main" type="date" value={campaignForm.start_date} onChange={cf('start_date')} />
              </Field>
              <Field label="End Date">
                <Input variant="main" type="date" value={campaignForm.end_date} onChange={cf('end_date')} />
              </Field>
            </SimpleGrid>
            <Field label="Target Audience">
              <Input variant="main" value={campaignForm.target_audience} onChange={cf('target_audience')} />
            </Field>
            <Field label="Goals">
              <Textarea variant="main" value={campaignForm.goals} onChange={cf('goals')} />
            </Field>
            <Field label="Description">
              <Textarea variant="main" value={campaignForm.description} onChange={cf('description')} />
            </Field>
          </Stack>
        </form>
      </AppModal>
    </>
  )
}
