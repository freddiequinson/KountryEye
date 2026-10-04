import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, IconButton, Input, Select, SimpleGrid, Stack, Table, Tbody, Td, Textarea, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAdd, MdDelete, MdEdit, MdFolderOpen } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, ConfirmDialog, Field, TableMessageRow } from '@/components/ui'

interface Category {
  id: number
  name: string
  description?: string
  category_type: string
  is_active: boolean
  created_at: string
}

const emptyForm = { name: '', description: '', category_type: 'general' }
const typeScheme: Record<string, string> = { medication: 'brand', optical: 'purple' }

export default function CategoriesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [form, setForm] = useState(emptyForm)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/sales/categories')).data,
  })

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingCategory(null)
    setForm(emptyForm)
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      handleCloseDialog()
      toast({ title: 'Category created successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to create category', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/sales/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      handleCloseDialog()
      toast({ title: 'Category updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update category', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sales/categories/${id}`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      setCategoryToDelete(null)
      toast({ title: response.data.message || 'Category deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete category', variant: 'destructive' })
    },
  })

  const handleOpenDialog = (category?: Category) => {
    setEditingCategory(category || null)
    setForm(category ? { name: category.name, description: category.description || '', category_type: category.category_type || 'general' } : emptyForm)
    setIsDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: 'Category name is required', variant: 'destructive' })
      return
    }
    if (editingCategory) updateMutation.mutate({ id: editingCategory.id, data: form })
    else createMutation.mutate(form)
  }

  return (
    <>
      <PageHeader
        title="Product Categories"
        description="Manage product categories for your inventory"
        actions={
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => handleOpenDialog()}>
            Add Category
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px">
        <StatCard name="Total Categories" value={categories.length} icon={MdFolderOpen} iconColor="secondaryGray.600" />
        <StatCard
          name="Active Categories"
          value={categories.filter((c: Category) => c.is_active).length}
          icon={MdFolderOpen}
          iconColor="green.500"
          valueColor="green.500"
        />
        <StatCard
          name="Inactive Categories"
          value={categories.filter((c: Category) => !c.is_active).length}
          icon={MdFolderOpen}
          iconColor="red.500"
          valueColor="red.500"
        />
      </SimpleGrid>

      <Card>
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th textAlign="right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableMessageRow colSpan={6} loading />
              ) : categories.length === 0 ? (
                <TableMessageRow colSpan={6}>No categories found. Create your first category.</TableMessageRow>
              ) : (
                categories.map((category: Category) => (
                  <Tr key={category.id}>
                    <Td fontWeight="600">{category.name}</Td>
                    <Td>
                      <Badge colorScheme={typeScheme[category.category_type] || 'gray'} variant={typeScheme[category.category_type] ? 'subtle' : 'outline'}>
                        {category.category_type || 'general'}
                      </Badge>
                    </Td>
                    <Td color="secondaryGray.600">{category.description || '-'}</Td>
                    <Td>
                      <Badge colorScheme={category.is_active ? 'green' : 'red'}>{category.is_active ? 'Active' : 'Inactive'}</Badge>
                    </Td>
                    <Td>{new Date(category.created_at).toLocaleDateString()}</Td>
                    <Td>
                      <Flex justify="end" gap="8px">
                        <IconButton aria-label="Edit category" variant="ghost" size="sm" icon={<MdEdit />} onClick={() => handleOpenDialog(category)} />
                        <IconButton
                          aria-label="Delete category"
                          variant="ghost"
                          size="sm"
                          color="red.500"
                          icon={<MdDelete />}
                          onClick={() => setCategoryToDelete(category)}
                        />
                      </Flex>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Card>

      {/* Create/Edit Dialog */}
      <AppModal
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        title={editingCategory ? 'Edit Category' : 'Create Category'}
        footer={
          <>
            <Button variant="light" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleSubmit} isLoading={createMutation.isPending || updateMutation.isPending} loadingText="Saving...">
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Category Name" isRequired>
            <Input variant="main" placeholder="e.g., Eye Drops, Frames, Lenses" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field
            label="Category Type"
            isRequired
            helper="Medication categories will appear when prescribing medications. Optical categories for glasses/lens prescriptions."
          >
            <Select variant="main" value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })}>
              <option value="general">General</option>
              <option value="medication">Medication</option>
              <option value="optical">Optical (Glasses/Lens)</option>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea
              variant="main"
              rows={3}
              placeholder="Optional description for this category"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>

      <ConfirmDialog
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)}
        isLoading={deleteMutation.isPending}
        title="Delete Category"
      >
        Are you sure you want to delete "{categoryToDelete?.name}"? If this category has products, it will be deactivated instead of deleted.
      </ConfirmDialog>
    </>
  )
}
