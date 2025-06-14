
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClusterSelector } from "@/components/ClusterSelector";
import { QueryEditor } from "@/components/QueryEditor";
import { QueryResults, QueryResult } from "@/components/QueryResults";
import { LoginForm } from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { LogOut, Users, FileText } from "lucide-react";
import { apiService, User, Cluster } from "@/lib/api";

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  // Verificar se o usuário já está autenticado
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      loadClusters();
      setIsAuthenticated(true);
    }
  }, []);

  const loadClusters = async () => {
    try {
      const clustersData = await apiService.getClusters();
      setClusters(clustersData);
    } catch (error) {
      console.error('Erro ao carregar clusters:', error);
    }
  };

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await apiService.login(username, password);
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      await loadClusters();
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const handleExecuteQuery = async (query: string) => {
    if (!selectedCluster) {
      alert("Por favor, selecione um cluster");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await apiService.executeQuery(parseInt(selectedCluster), query);
      setQueryResult(result);
      setCurrentPage(1);
    } catch (error) {
      console.error('Erro ao executar query:', error);
      alert(`Erro ao executar query: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedCluster("");
    setQueryResult(null);
    setClusters([]);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} isLoading={isLoading} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Cassandra Query Pilot
            </h1>
            <div className="flex items-center space-x-4">
              <ClusterSelector 
                selectedCluster={selectedCluster}
                onClusterChange={setSelectedCluster}
                clusters={clusters}
              />
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/users')}>
                  <Users className="w-4 h-4 mr-2" />
                  Usuários
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/logs')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Logs
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair ({currentUser?.username})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <QueryEditor 
            onExecuteQuery={handleExecuteQuery}
            isLoading={isLoading}
          />
          <QueryResults 
            result={queryResult}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
