
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClusterSelector } from "@/components/ClusterSelector";
import { QueryEditor } from "@/components/QueryEditor";
import { QueryResults, QueryResult } from "@/components/QueryResults";
import { LoginForm } from "@/components/LoginForm";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
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
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [isQueryCancelling, setIsQueryCancelling] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    setCurrentQueryId(null);
    
    try {
      const result = await apiService.executeQuery(parseInt(selectedCluster), query);
      setQueryResult(result);
      setCurrentPage(1);
      setCurrentQueryId(result.queryId);
    } catch (error) {
      console.error('Erro ao executar query:', error);
      alert(`Erro ao executar query: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      setCurrentQueryId(null);
    }
  };

  const handleCancelQuery = async () => {
    if (!currentQueryId) return;

    setIsQueryCancelling(true);
    
    try {
      await apiService.cancelQuery(currentQueryId);
      alert('Query cancelada com sucesso');
      setIsLoading(false);
      setCurrentQueryId(null);
    } catch (error) {
      console.error('Erro ao cancelar query:', error);
      alert(`Erro ao cancelar query: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsQueryCancelling(false);
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Center - Cluster Selector */}
              <div className="flex-1 flex justify-center">
                <ClusterSelector 
                  selectedCluster={selectedCluster}
                  onClusterChange={setSelectedCluster}
                  clusters={clusters}
                />
              </div>

              {/* Right side - User menu and cancel button */}
              <div className="flex items-center space-x-2">
                {isLoading && currentQueryId && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleCancelQuery}
                    disabled={isQueryCancelling}
                  >
                    {isQueryCancelling ? 'Cancelando...' : 'Cancelar Query'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair ({currentUser?.username})
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <QueryEditor 
              onExecuteQuery={handleExecuteQuery}
              isLoading={isLoading}
              onCancelQuery={handleCancelQuery}
              canCancel={!!currentQueryId}
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
    </div>
  );
};

export default Index;
