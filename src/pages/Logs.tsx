import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Activity, Database, RefreshCw, Search } from "lucide-react";
import { apiService, QueryLog, AuditLog, User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Logs = () => {
  const [queryLogs, setQueryLogs] = useState<QueryLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadQueryLogs();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    loadQueryLogs();
  }, [selectedUser, selectedCluster, page]);

  const loadUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadQueryLogs = async () => {
    try {
      setLoading(true);
      const userId = selectedUser ? parseInt(selectedUser) : undefined;
      const clusterId = selectedCluster ? parseInt(selectedCluster) : undefined;
      const data = await apiService.getQueryLogs(page, 50, userId, clusterId);
      setQueryLogs(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar logs de queries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await apiService.getAuditLogs(page, 50);
      setAuditLogs(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar logs de auditoria",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'timeout': return 'secondary';
      default: return 'outline';
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'default';
      case 'CREATE_USER': return 'default';
      case 'UPDATE_USER': return 'secondary';
      case 'DELETE_USER': return 'destructive';
      case 'EXECUTE_QUERY': return 'outline';
      case 'EXECUTE_QUERY_ERROR': return 'destructive';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const filteredQueryLogs = queryLogs.filter(log =>
    searchTerm === '' ||
    log.query_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.cluster_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter(log =>
    searchTerm === '' ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.username && log.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-900">Logs do Sistema</h1>
            </div>
            <Button onClick={() => { loadQueryLogs(); loadAuditLogs(); }} className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Usuário
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username} ({user.full_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Cluster
              </label>
              <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os clusters</SelectItem>
                  <SelectItem value="7">OMNI</SelectItem>
                  <SelectItem value="8">BTG</SelectItem>
                  <SelectItem value="9">CLICK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser('');
                  setSelectedCluster('');
                  setSearchTerm('');
                  loadQueryLogs();
                  loadAuditLogs();
                }}
                className="w-full"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="queries" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queries" className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Logs de Queries</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Logs de Auditoria</span>
            </TabsTrigger>
          </TabsList>

          {/* Logs de Queries */}
          <TabsContent value="queries">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Logs de Execução de Queries</h2>
                  <Badge variant="secondary">{filteredQueryLogs.length} registros</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Cluster</TableHead>
                      <TableHead>Query</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Linhas</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Carregando logs...
                        </TableCell>
                      </TableRow>
                    ) : filteredQueryLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Nenhum log encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQueryLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.username}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.cluster_name}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={log.query_text}>
                              {log.query_text}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDuration(log.execution_time_ms)}
                          </TableCell>
                          <TableCell>
                            {log.rows_returned.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(log.status)}>
                              {log.status.toUpperCase()}
                            </Badge>
                            {log.error_message && (
                              <div className="text-xs text-red-600 mt-1" title={log.error_message}>
                                {log.error_message.substring(0, 50)}...
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Logs de Auditoria */}
          <TabsContent value="audit">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Logs de Auditoria</h2>
                  <Badge variant="secondary">{filteredAuditLogs.length} registros</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Nenhum log de auditoria encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.username || 'Sistema'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">{log.resource_type}</span>
                              {log.resource_id && (
                                <span className="text-xs text-gray-500">#{log.resource_id}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {log.details && (
                              <div className="text-xs text-gray-600 truncate" title={JSON.stringify(log.details)}>
                                {JSON.stringify(log.details).substring(0, 100)}...
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {log.ip_address}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Logs; 