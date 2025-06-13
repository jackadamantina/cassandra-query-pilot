
import { useState, useEffect } from "react";
import { ClusterSelector } from "@/components/ClusterSelector";
import { QueryEditor } from "@/components/QueryEditor";
import { QueryResults, QueryResult } from "@/components/QueryResults";
import { LoginForm } from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { LogOut, Users, FileText } from "lucide-react";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState("");

  // Simulação de autenticação (substituir pela integração com Supabase)
  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simular delay de autenticação
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Credenciais padrão
    if (username === "admin" && password === "admin123") {
      setCurrentUser(username);
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const handleExecuteQuery = async (query: string) => {
    if (!selectedCluster) {
      alert("Por favor, selecione um cluster");
      return;
    }

    setIsLoading(true);
    
    // Simular execução da query (substituir pela integração real)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Dados simulados
    const mockResult: QueryResult = {
      columns: ["id", "name", "email", "created_at"],
      rows: [
        ["1", "João Silva", "joao@example.com", "2024-01-15 10:30:00"],
        ["2", "Maria Santos", "maria@example.com", "2024-01-15 11:45:00"],
        ["3", "Pedro Oliveira", "pedro@example.com", "2024-01-15 14:20:00"]
      ],
      totalRows: 3,
      executionTime: 125
    };
    
    setQueryResult(mockResult);
    setCurrentPage(1);
    setIsLoading(false);
    
    console.log(`Query executada no cluster ${selectedCluster}: ${query}`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
    setSelectedCluster("");
    setQueryResult(null);
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
              />
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Usuários
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  Logs
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair ({currentUser})
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
