import { RequestHandler } from "express";
import { insertProducts } from "../lib/d1-client";

export const importFromCSV: RequestHandler = async (req, res) => {
  try {
    const csvContent = req.body.csvContent;

    if (!csvContent || typeof csvContent !== "string" || csvContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "csvContent is required in the request body and must be a non-empty string.",
      });
    }

    if (!csvContent || csvContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "CSV content is empty",
      });
    }
    const lines = csvContent.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: "CSV file is empty or invalid",
      });
    }

    // Parse CSV header
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase());

    const codeIdx = headers.findIndex((h) => h === "code");
    const descIdx = headers.findIndex((h) => h === "description");
    const marcaIdx = headers.findIndex((h) => h === "marca");
    const distIdx = headers.findIndex((h) => h === "price_distributor");
    const distIpiIdx = headers.findIndex(
      (h) => h === "price_distributor_with_ipi"
    );
    const finalIdx = headers.findIndex((h) => h === "price_final");
    const finalIpiIdx = headers.findIndex(
      (h) => h === "price_final_with_ipi"
    );

    const parsePrice = (value: string): number => {
      if (!value || value.trim() === "" || value.trim() === "0.00") return 0;
      const cleaned = value.trim().replace(",", ".");
      return parseFloat(cleaned) || 0;
    };

    const products = [];

    // Parse data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing - handle quoted fields
      const fields = line.split(",").map((f) => f.trim().replace(/^"(.*)"$/, "$1"));

      if (codeIdx >= 0 && fields[codeIdx]) {
        const product = {
          code: fields[codeIdx],
          description: descIdx >= 0 ? fields[descIdx] : "",
          marca: marcaIdx >= 0 ? fields[marcaIdx] : fields[codeIdx],
          price_distributor: distIdx >= 0 ? parsePrice(fields[distIdx]) : 0,
          price_distributor_with_ipi:
            distIpiIdx >= 0 ? parsePrice(fields[distIpiIdx]) : 0,
          price_final: finalIdx >= 0 ? parsePrice(fields[finalIdx]) : 0,
          price_final_with_ipi:
            finalIpiIdx >= 0 ? parsePrice(fields[finalIpiIdx]) : 0,
        };

        if (product.code && product.description) {
          products.push(product);
        }
      }
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid products found in CSV",
      });
    }

    console.log(`[importFromCSV] Importing ${products.length} products to D1`);

    try {
      const count = await insertProducts(products);
      res.json({
        success: true,
        message: `${count} product(s) imported successfully from CSV`,
        count,
      });
    } catch (error) {
      console.error("[importFromCSV] D1 error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to import products",
      });
    }
  } catch (error) {
    console.error("[importFromCSV] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to import CSV",
    });
  }
};
