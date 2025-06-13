
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QueryResult {
  columns: string[];
  rows: any[][];
  totalRows: number;
  executionTime: number;
}

interface QueryResultsProps {
  result: QueryResult | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export const QueryResults = ({ result, currentPage, onPageChange, isLoading }: QueryResultsProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Executando query...</div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            Execute uma query para ver os resultados
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(result.totalRows / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Resultados
          <div className="text-sm text-muted-foreground">
            {result.rows.length} registros - Tempo: {result.executionTime}ms
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.rows.length > 0 ? (
          <>
            <div className="overflow-auto max-h-96 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((column, index) => (
                      <TableHead key={index} className="font-semibold">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} className="font-mono text-sm">
                          {cell !== null ? String(cell) : "NULL"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground p-8">
            Nenhum resultado encontrado
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export type { QueryResult };
