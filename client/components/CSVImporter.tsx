import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { toast } from "sonner";

interface ImportStats {
  imported: number;
  failed: number;
  duplicates: number;
}

interface ErrorState {
  message: string;
  details?: string;
}

export default function CSVImporter() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportCSV = async (file: File) => {
    setLoading(true);
    setStats(null);
    setError(null);

    try {
      const fileContent = await file.text();

      const response = await fetch("/api/products/import-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvContent: fileContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Erro desconhecido ao importar";
        setError({
          message: errorMsg,
          details: data.details,
        });
        toast.error(errorMsg);
        return;
      }

      setStats({
        imported: data.count || 0,
        failed: 0,
        duplicates: 0,
      });

      toast.success(`✓ ${data.count} produtos importados com sucesso!`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao processar o arquivo CSV";
      console.error("Erro na importação:", error);
      setError({
        message: "Erro ao processar o arquivo CSV",
        details: errorMsg,
      });
      toast.error("Erro ao processar o arquivo CSV");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("Por favor, selecione um arquivo CSV válido");
        return;
      }
      handleImportCSV(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Importar Produtos (CSV)
        </h3>
      </div>

      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-100/50 transition-colors cursor-pointer"
          onClick={openFileDialog}
        >
          <Upload className="mx-auto mb-3 text-blue-600" size={32} />
          <p className="text-sm text-gray-600 mb-2">
            Clique para selecionar ou arraste um arquivo CSV
          </p>
          <p className="text-xs text-gray-500">
            Formato esperado: code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi
          </p>
        </div>

        <Button
          onClick={openFileDialog}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Selecionar e Importar
            </>
          )}
        </Button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-900">
                  {error.message}
                </p>
                {error.details && (
                  <p className="mt-2 text-sm text-red-800">
                    {error.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {stats && !error && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-green-900">
                  Importação concluída com sucesso!
                </p>
                <div className="mt-2 text-sm text-green-800 space-y-1">
                  <p>✓ Produtos importados: <span className="font-semibold">{stats.imported}</span></p>
                  {stats.duplicates > 0 && (
                    <p>⚠ Duplicatas encontradas: <span className="font-semibold">{stats.duplicates}</span></p>
                  )}
                  {stats.failed > 0 && (
                    <p>✗ Registros falhados: <span className="font-semibold">{stats.failed}</span></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
