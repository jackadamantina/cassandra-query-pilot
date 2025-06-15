import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, ArrowLeft, Plus, Edit, Trash2, Database } from "lucide-react";
import { apiService, Cluster } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Config = () => {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '9042',
    hosts: '',
    datacenter: 'datacenter1',
    username: '',
    password: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se está autenticado
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/');
      return;
    }
    
    loadClusters();
  }, [navigate]);

  const loadClusters = async () => {
    try {
      setLoading(true);
      const data = await apiService.getClusters();
      setClusters(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar clusters",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.host || !formData.port) {
      toast({
        title: "Erro",
        description: "Nome, host e porta são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Processar lista de hosts
      let hostsList = [];
      if (formData.hosts.trim()) {
        hostsList = formData.hosts.split(',').map(h => h.trim()).filter(h => h);
      } else {
        hostsList = [`${formData.host}:${formData.port}`];
      }

      const clusterData = {
        name: formData.name,
        host: formData.host,
        port: parseInt(formData.port),
        hosts: JSON.stringify(hostsList),
        datacenter: formData.datacenter,
        username: formData.username || null,
        password: formData.password || null
      };

      if (editingCluster) {
        await apiService.updateCluster(editingCluster.id, clusterData);
        toast({
          title: "Sucesso",
          description: "Cluster atualizado com sucesso",
        });
      } else {
        await apiService.createCluster(clusterData);
        toast({
          title: "Sucesso",
          description: "Cluster criado com sucesso",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadClusters();
    } catch (error) {
      toast({
        title: "Erro",
        description: `Erro ao ${editingCluster ? 'atualizar' : 'criar'} cluster: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cluster: Cluster) => {
    setEditingCluster(cluster);
    setFormData({
      name: cluster.name,
      host: cluster.host,
      port: cluster.port.toString(),
      hosts: Array.isArray(cluster.hosts) ? cluster.hosts.join(', ') : '',
      datacenter: cluster.datacenter || 'datacenter1',
      username: '',
      password: ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (cluster: Cluster) => {
    if (!confirm(`Tem certeza que deseja excluir o cluster "${cluster.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await apiService.deleteCluster(cluster.id);
      toast({
        title: "Sucesso",
        description: "Cluster excluído com sucesso",
      });
      loadClusters();
    } catch (error) {
      toast({
        title: "Erro",
        description: `Erro ao excluir cluster: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '9042',
      hosts: '',
      datacenter: 'datacenter1',
      username: '',
      password: ''
    });
    setEditingCluster(null);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'offline': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Dashboard</span>
              </Button>
              <Settings className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Configuração de Clusters</h1>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Novo Cluster</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingCluster ? 'Editar Cluster' : 'Novo Cluster'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Cluster *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: PRODUCTION"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="host">Host Principal *</Label>
                    <Input
                      id="host"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      placeholder="Ex: 192.168.1.100"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="port">Porta *</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      placeholder="9042"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="hosts">Hosts Adicionais (opcional)</Label>
                    <Input
                      id="hosts"
                      value={formData.hosts}
                      onChange={(e) => setFormData({ ...formData, hosts: e.target.value })}
                      placeholder="192.168.1.101:9042, 192.168.1.102:9042"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Separar por vírgula se houver múltiplos hosts
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="datacenter">Datacenter</Label>
                    <Input
                      id="datacenter"
                      value={formData.datacenter}
                      onChange={(e) => setFormData({ ...formData, datacenter: e.target.value })}
                      placeholder="datacenter1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="username">Usuário (opcional)</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="cassandra"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password">Senha (opcional)</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : editingCluster ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Clusters Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Clusters Cassandra</span>
              <Badge variant="secondary">{clusters.length} clusters</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Host Principal</TableHead>
                  <TableHead>Porta</TableHead>
                  <TableHead>Hosts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando clusters...
                    </TableCell>
                  </TableRow>
                ) : clusters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Nenhum cluster configurado
                    </TableCell>
                  </TableRow>
                ) : (
                  clusters.map((cluster) => (
                    <TableRow key={cluster.id}>
                      <TableCell className="font-medium">{cluster.name}</TableCell>
                      <TableCell>{cluster.host}</TableCell>
                      <TableCell>{cluster.port}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {cluster.onlineHosts}/{cluster.totalHosts} online
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(cluster.status)}>
                          {cluster.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(cluster)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(cluster)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Config; 