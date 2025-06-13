
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from "lucide-react";

interface QueryEditorProps {
  onExecuteQuery: (query: string) => void;
  isLoading: boolean;
}

export const QueryEditor = ({ onExecuteQuery, isLoading }: QueryEditorProps) => {
  const [query, setQuery] = useState("");

  const handleExecute = () => {
    if (query.trim()) {
      onExecuteQuery(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleExecute();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Editor de Query
          <Button 
            onClick={handleExecute} 
            disabled={!query.trim() || isLoading}
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            {isLoading ? "Executando..." : "Executar (Ctrl+Enter)"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua query SELECT aqui... (limit 100 será aplicado automaticamente)"
          className="min-h-32 font-mono text-sm"
        />
      </CardContent>
    </Card>
  );
};
