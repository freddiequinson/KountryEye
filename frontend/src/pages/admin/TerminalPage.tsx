import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, RefreshCw, Filter, AlertCircle, Info, AlertTriangle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
}

export default function TerminalPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [lines, setLines] = useState(100);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Check if user is admin
  const isAdmin = user?.is_superuser;

  const { data: logsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['system-logs', lines, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('lines', lines.toString());
      if (filterType !== 'all') {
        params.append('filter_type', filterType);
      }
      const response = await api.get(`/system/logs?${params.toString()}`);
      return response.data;
    },
    enabled: isAdmin,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsData]);

  const filteredLogs = (logsData?.logs || []).filter((log: LogEntry) => {
    if (!searchTerm) return true;
    return log.message.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'debug':
        return 'text-gray-400';
      default:
        return 'text-green-400';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-3 w-3" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin access required to view system logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          <h1 className="text-2xl font-bold">System Terminal</h1>
          <Badge variant="outline" className="ml-2">
            {logsData?.total || 0} entries
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lines.toString()} onValueChange={(v) => setLines(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 lines</SelectItem>
                <SelectItem value="100">100 lines</SelectItem>
                <SelectItem value="200">200 lines</SelectItem>
                <SelectItem value="500">500 lines</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            {searchTerm && (
              <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Terminal Output */}
      <Card className="flex-1 bg-gray-900 text-gray-100 overflow-hidden">
        <CardHeader className="py-2 px-4 bg-gray-800 border-b border-gray-700">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="ml-2">kountryeye-server — journalctl</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100vh-320px)] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="font-mono text-xs p-4 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No logs found matching your criteria
                </div>
              ) : (
                filteredLogs.map((log: LogEntry, index: number) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 py-0.5 hover:bg-gray-800 px-2 -mx-2 rounded ${getLevelColor(log.level)}`}
                  >
                    <span className="flex-shrink-0 opacity-50">
                      {getLevelIcon(log.level)}
                    </span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error display */}
      {logsData?.errors && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error retrieving logs:</span>
              <span>{logsData.errors}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
