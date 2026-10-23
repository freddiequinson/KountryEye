import { useState, useEffect, useCallback } from 'react'
import { Box, Button, Center, Flex, IconButton, Image, SimpleGrid, Spinner, Text, useColorModeValue } from '@chakra-ui/react'
import { MdClose } from 'react-icons/md'
import { SearchInput } from '@/components/ui'

interface GifResult {
  id: string
  title: string
  images: {
    fixed_height: { url: string; width: string; height: string }
    fixed_height_small: { url: string; width: string; height: string }
    original: { url: string }
  }
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void
  onClose: () => void
}

const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65' // Public beta key

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const bg = useColorModeValue('white', 'navy.800')
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200')

  const fetchGifs = useCallback(async (query: string, newOffset = 0) => {
    setLoading(true)
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&offset=${newOffset}&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&offset=${newOffset}&rating=pg-13`
      const data = await (await fetch(endpoint)).json()
      setGifs((prev) => (newOffset === 0 ? data.data || [] : [...prev, ...(data.data || [])]))
      setOffset(newOffset)
    } catch (error) {
      console.error('Failed to fetch GIFs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGifs('')
  }, [fetchGifs])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (search !== '') fetchGifs(search, 0)
    }, 300)
    return () => clearTimeout(debounce)
  }, [search, fetchGifs])

  return (
    <Box position="absolute" bottom="100%" left="0" right="0" mb="8px" bg={bg} border="1px solid" borderColor={borderColor} borderRadius="16px" boxShadow="xl" zIndex={50} overflow="hidden">
      <Flex p="12px" gap="8px" align="center" borderBottom="1px solid" borderColor={borderColor}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search GIFs..." maxW="100%" flex="1" autoFocus />
        <IconButton aria-label="Close GIF picker" variant="ghost" size="sm" icon={<MdClose />} onClick={onClose} />
      </Flex>

      <Box h="192px" overflowY="auto" p="8px" className="thin-scrollbar">
        {loading && gifs.length === 0 ? (
          <Center h="100%">
            <Spinner color="brand.500" />
          </Center>
        ) : gifs.length === 0 ? (
          <Center h="100%" color="secondaryGray.600">
            No GIFs found
          </Center>
        ) : (
          <>
            <SimpleGrid columns={4} spacing="4px">
              {gifs.map((gif) => (
                <Box
                  as="button"
                  key={gif.id}
                  onClick={() => onSelect(gif.images.fixed_height.url)}
                  aspectRatio={1}
                  overflow="hidden"
                  borderRadius="6px"
                  _hover={{ boxShadow: '0 0 0 2px var(--chakra-colors-brand-500)', opacity: 0.85 }}
                >
                  <Image src={gif.images.fixed_height_small.url} alt={gif.title} w="100%" h="100%" objectFit="cover" loading="lazy" />
                </Box>
              ))}
            </SimpleGrid>
            {gifs.length >= 20 && (
              <Center mt="12px">
                <Button variant="light" size="sm" onClick={() => fetchGifs(search, offset + 20)} isLoading={loading}>
                  Load More
                </Button>
              </Center>
            )}
          </>
        )}
      </Box>

      <Text p="8px" borderTop="1px solid" borderColor={borderColor} textAlign="center" fontSize="xs" color="secondaryGray.600">
        Powered by GIPHY
      </Text>
    </Box>
  )
}
