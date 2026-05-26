import { RequestHandler } from "express";
import {
  getAllCompatibility,
  getCompatibilityById,
  insertCompatibility,
  updateCompatibility as updateCompatibilityDB,
  deleteCompatibility as deleteCompatibilityDB,
} from "../lib/d1-client";

export interface CompatibilityRecord {
  id: string;
  equipamento: string;
  parametro?: string;
  fabricante?: string;
  modelo?: string;
  acessorio?: string;
  foto_produto?: string;
  foto_conexao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export const getCompatibility: RequestHandler = async (req, res) => {
  try {
    console.log("[getCompatibility] START");
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    console.log("[getCompatibility] Limit:", limit || "none");

    let records = await getAllCompatibility();

    if (limit) {
      records = records.slice(0, limit);
    }

    console.log("[getCompatibility] SUCCESS - Fetched", records.length, "records");

    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    console.error("[getCompatibility] CRITICAL EXCEPTION:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server exception",
    });
  }
};

export const searchCompatibility: RequestHandler = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Search query required",
      });
    }

    const query = q.toLowerCase();
    const allRecords = await getAllCompatibility();

    const filtered = allRecords.filter(
      (record) =>
        record.equipamento?.toLowerCase().includes(query) ||
        record.fabricante?.toLowerCase().includes(query) ||
        record.modelo?.toLowerCase().includes(query) ||
        record.acessorio?.toLowerCase().includes(query)
    );

    console.log(`[searchCompatibility] Found ${filtered.length} results for "${query}"`);
    res.json({
      success: true,
      data: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error("[searchCompatibility] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to search compatibility records",
    });
  }
};

export const createCompatibility: RequestHandler = async (req, res) => {
  try {
    const { equipamento, parametro, fabricante, modelo, acessorio, foto_produto, foto_conexao, observacoes } = req.body;

    if (!equipamento || !fabricante || !modelo || !acessorio) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: equipamento, fabricante, modelo, acessorio",
      });
    }

    console.log("[createCompatibility] Request body received:", JSON.stringify(req.body, null, 2));

    const insertData: Omit<CompatibilityRecord, 'id' | 'created_at' | 'updated_at'> = {
      equipamento,
      parametro: parametro || undefined,
      fabricante,
      modelo,
      acessorio,
      foto_produto: foto_produto ? JSON.stringify(foto_produto) : undefined,
      foto_conexao: foto_conexao ? JSON.stringify(foto_conexao) : undefined,
      observacoes: observacoes || undefined,
    };

    const record = await insertCompatibility(insertData);

    console.log("[createCompatibility] Record created successfully:", record.id);
    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("[createCompatibility] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create compatibility record",
    });
  }
};

export const updateCompatibility: RequestHandler = async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { equipamento, parametro, fabricante, modelo, acessorio, foto_produto, foto_conexao, observacoes } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Record ID is required",
      });
    }

    const updateData: Partial<Omit<CompatibilityRecord, 'id' | 'created_at' | 'updated_at'>> = {};
    if (equipamento !== undefined) updateData.equipamento = equipamento;
    if (parametro !== undefined) updateData.parametro = parametro;
    if (fabricante !== undefined) updateData.fabricante = fabricante;
    if (modelo !== undefined) updateData.modelo = modelo;
    if (acessorio !== undefined) updateData.acessorio = acessorio;
    if (foto_produto !== undefined) updateData.foto_produto = JSON.stringify(foto_produto);
    if (foto_conexao !== undefined) updateData.foto_conexao = JSON.stringify(foto_conexao);
    if (observacoes !== undefined) updateData.observacoes = observacoes;

    console.log("[updateCompatibility] Update data:", JSON.stringify(updateData, null, 2));

    const record = await updateCompatibilityDB(id, updateData);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Compatibility record not found",
      });
    }

    console.log("[updateCompatibility] Record updated successfully:", id);
    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("[updateCompatibility] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update compatibility record",
    });
  }
};

export const deleteCompatibility: RequestHandler = async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Record ID is required",
      });
    }

    const success = await deleteCompatibilityDB(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Compatibility record not found",
      });
    }

    console.log("[deleteCompatibility] Record deleted:", id);
    res.json({
      success: true,
      message: "Compatibility record deleted successfully",
    });
  } catch (error) {
    console.error("[deleteCompatibility] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete compatibility record",
    });
  }
};

export const importCompatibility: RequestHandler = async (req, res) => {
  try {
    console.log("[importCompatibility] Request received");

    const { csvData, autoDetectImages } = req.body;
    console.log("[importCompatibility] csvData length:", csvData?.length);
    console.log("[importCompatibility] autoDetectImages:", autoDetectImages);

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      console.error("[importCompatibility] Invalid csvData");
      return res.status(400).json({
        success: false,
        error: "CSV data is required and must be a non-empty array",
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of csvData) {
      try {
        const equipamento = row["EQUIPAMENTO"] || row["equipamento"] || row["Equipamento"] || "";
        const parametro = row["PARAMETRO"] || row["parametro"] || row["Parametro"] || "";
        const fabricante = row["FABRICANTE"] || row["fabricante"] || row["Fabricante"] || "";
        const modelo = row["MODELO"] || row["modelo"] || row["Modelo"] || "";
        const acessorio =
          row["CÓDIGO DO PRODUTO"] ||
          row["codigo_do_produto"] ||
          row["Código do Produto"] ||
          row["acessorio"] ||
          row["Acessorio"] ||
          "";
        const observacoes = row["OBSERVAÇÕES"] || row["observacoes"] || row["Observações"] || "";

        if (!equipamento || !fabricante || !modelo || !acessorio) {
          errorCount++;
          results.push({
            acessorio: acessorio || "unknown",
            success: false,
            error: "Missing required fields: equipamento, fabricante, modelo, acessorio",
          });
          continue;
        }

        const record = await insertCompatibility({
          equipamento,
          parametro: parametro || undefined,
          fabricante,
          modelo,
          acessorio,
          observacoes: observacoes || undefined,
        });

        successCount++;
        results.push({
          acessorio,
          success: true,
          id: record.id,
        });
      } catch (rowError) {
        errorCount++;
        console.error("[importCompatibility] Error processing row:", rowError);
        results.push({
          acessorio: row["CÓDIGO DO PRODUTO"] || row["acessorio"] || "unknown",
          success: false,
          error: rowError instanceof Error ? rowError.message : "Unknown error",
        });
      }
    }

    console.log(`[importCompatibility] Imported ${successCount} records successfully, ${errorCount} failed`);

    const responseData = {
      success: true,
      message: `Importação concluída: ${successCount} registros criados, ${errorCount} erros`,
      successCount,
      errorCount,
      results,
    };

    res.json(responseData);
  } catch (error) {
    console.error("[importCompatibility] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to import compatibility records",
    });
  }
};
