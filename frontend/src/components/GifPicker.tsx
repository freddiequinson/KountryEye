import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GifResult {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchGifs = useCallback(async (query: string, newOffset: number = 0) => {
    setLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&offset=${newOffset}&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&offset=${newOffset}&rating=pg-13`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (newOffset === 0) {
        setGifs(data.data || []);
      } else {
        setGifs(prev => [...prev, ...(data.data || [])]);
      }
      setOffset(newOffset);
    } catch (error) {
      console.error('Failed to fetch GIFs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifs('');
  }, [fetchGifs]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (search !== '') {
        fetchGifs(search, 0);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, fetchGifs]);

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.images.fixed_height.url);
  };

  const loadMore = () => {
    fetchGifs(search, offset + 20);
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="pl-8"
            autoFocus
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="h-64">
        <div className="p-2">
          {loading && gifs.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              No GIFs found
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => handleSelect(gif)}
                    className="relative aspect-square overflow-hidden rounded-md hover:ring-2 hover:ring-primary transition-all group"
                  >
                    <img
                      src={gif.images.fixed_height_small.url}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>
                ))}
              </div>
              {gifs.length >= 20 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t text-center">
        <span className="text-xs text-muted-foreground">Powered by GIPHY</span>
      </div>
    </div>
  );
}
