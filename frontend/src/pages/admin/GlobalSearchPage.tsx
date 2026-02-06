import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Search,
  Users,
  UserCog,
  Eye,
  Package,
  Receipt,
  Wrench,
  FileText,
  ClipboardList,
  Building2,
  Megaphone,
  DollarSign,
  ShoppingBag,
  Glasses,
  BarChart3,
  ArrowRight,
  Loader2,
  SearchX,
  Sparkles,
  Clock,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SearchResult {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  meta?: Record<string, any>;
}

interface SearchResponse {
  query: string;
  total_count: number;
  results: Record<string, SearchResult[]>;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  patients: { label: 'Patients', icon: <Users className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  staff: { label: 'Staff', icon: <UserCog className="h-4 w-4" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  visits: { label: 'Visits', icon: <ClipboardList className="h-4 w-4" />, color: 'bg-green-100 text-green-700 border-green-200' },
  scans: { label: 'Scans', icon: <Eye className="h-4 w-4" />, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  referrals: { label: 'Referrals', icon: <ExternalLink className="h-4 w-4" />, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  referral_doctors: { label: 'Referral Doctors', icon: <UserCog className="h-4 w-4" />, color: 'bg-teal-100 text-teal-700 border-teal-200' },
  products: { label: 'Products', icon: <Package className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  sales: { label: 'Sales & Receipts', icon: <Receipt className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  assets: { label: 'Assets & Devices', icon: <Wrench className="h-4 w-4" />, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  fund_requests: { label: 'Memos & Fund Requests', icon: <FileText className="h-4 w-4" />, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  tasks: { label: 'Tasks', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  branches: { label: 'Branches', icon: <Building2 className="h-4 w-4" />, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  invoices: { label: 'Invoices', icon: <DollarSign className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  orders: { label: 'Glasses Orders', icon: <Glasses className="h-4 w-4" />, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  campaigns: { label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />, color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  expenses: { label: 'Expenses', icon: <BarChart3 className="h-4 w-4" />, color: 'bg-red-100 text-red-700 border-red-200' },
  vendors: { label: 'Vendors', icon: <ShoppingBag className="h-4 w-4" />, color: 'bg-lime-100 text-lime-700 border-lime-200' },
  revenue: { label: 'Revenue', icon: <DollarSign className="h-4 w-4" />, color: 'bg-green-100 text-green-700 border-green-200' },
};

const recentSearchesKey = 'kountry_recent_searches';

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(recentSearchesKey) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  const recent = getRecentSearches().filter(s => s !== term);
  recent.unshift(term);
  localStorage.setItem(recentSearchesKey, JSON.stringify(recent.slice(0, 8)));
}

export default function GlobalSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      if (value.trim()) {
        setSearchParams({ q: value.trim() });
      } else {
        setSearchParams({});
      }
    }, 350);
  }, [setSearchParams]);

  const { data, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const response = await api.get('/search/global', { params: { q: debouncedQuery, limit: 15 } });
      return response.data;
    },
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data && debouncedQuery.trim()) {
      saveRecentSearch(debouncedQuery.trim());
    }
  }, [data, debouncedQuery]);

  const handleResultClick = (url: string) => {
    navigate(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setDebouncedQuery('');
      setSearchParams({});
    }
  };

  const recentSearches = getRecentSearches();
  const hasResults = data && data.total_count > 0;
  const hasSearched = debouncedQuery.trim().length >= 1;

  const filteredResults = data?.results
    ? activeFilter
      ? { [activeFilter]: data.results[activeFilter] || [] }
      : data.results
    : {};

  const categoryKeys = data?.results ? Object.keys(data.results) : [];

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 pt-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold" data-tour="page-title">Global Search</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Search across patients, staff, scans, products, receipts, assets, memos, and more.
          </p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search anything... patients, phone numbers, receipts, scans, staff, assets..."
              className="pl-12 pr-12 h-14 text-lg rounded-xl border-2 focus:border-primary shadow-sm"
            />
            {(isLoading || isFetching) && debouncedQuery && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
            )}
          </div>

          {/* Category filter pills */}
          {hasResults && categoryKeys.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge
                variant={activeFilter === null ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => setActiveFilter(null)}
              >
                All ({data.total_count})
              </Badge>
              {categoryKeys.map((key) => {
                const cfg = categoryConfig[key];
                const count = data.results[key]?.length || 0;
                return (
                  <Badge
                    key={key}
                    variant={activeFilter === key ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1 gap-1 ${activeFilter === key ? '' : cfg?.color || ''}`}
                    onClick={() => setActiveFilter(activeFilter === key ? null : key)}
                  >
                    {cfg?.icon}
                    {cfg?.label || key} ({count})
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* No query yet - show recent searches & suggestions */}
          {!hasSearched && (
            <div className="space-y-6">
              {recentSearches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setQuery(term);
                          handleQueryChange(term);
                        }}
                      >
                        <Search className="h-3 w-3 mr-1.5" />
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Try searching for</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Patient name or phone', example: 'Fredrick' },
                    { label: 'Receipt number', example: 'RCP-' },
                    { label: 'Scan number', example: 'SCN-' },
                    { label: 'Staff member', example: 'Ebenezer' },
                    { label: 'Asset or device', example: 'OCT machine' },
                    { label: 'Fund request', example: 'transport' },
                  ].map((s, i) => (
                    <Card
                      key={i}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        setQuery(s.example);
                        handleQueryChange(s.example);
                      }}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">e.g. "{s.example}"</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && hasSearched && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Searching across all records...</p>
            </div>
          )}

          {/* No results */}
          {hasSearched && !isLoading && !hasResults && (
            <div className="flex flex-col items-center justify-center py-20">
              <SearchX className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No results found</h3>
              <p className="text-muted-foreground text-sm">
                No matches for "<span className="font-medium">{debouncedQuery}</span>". Try a different search term.
              </p>
            </div>
          )}

          {/* Results by category */}
          {hasSearched && !isLoading && hasResults && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{data.total_count}</span> results for "<span className="font-medium">{data.query}</span>"
              </p>

              {Object.entries(filteredResults).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const cfg = categoryConfig[category] || { label: category, icon: <Search className="h-4 w-4" />, color: 'bg-gray-100 text-gray-700' };

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </div>
                      <span className="text-xs text-muted-foreground">{items.length} result{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div
                          key={`${category}-${item.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/60 cursor-pointer transition-colors group border border-transparent hover:border-border"
                          onClick={() => handleResultClick(item.url)}
                        >
                          <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
