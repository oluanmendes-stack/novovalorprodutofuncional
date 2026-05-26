import { RequestHandler } from "express";
import {
  getAllProducts,
  searchProducts,
  getProductByCode,
  insertProducts,
  deleteAllProducts,
  getProductCount,
} from "../lib/d1-client";

export interface ProductResponse {
  code: string;
  description: string;
  price: number;
  priceWithIPI: number;
}

export const getProducts: RequestHandler = async (req, res) => {
  try {
    console.log("[getProducts] Fetching products from D1...");
    const products = await getAllProducts();

    console.log("[getProducts] Received data:", products.length, "products");
    if (products.length > 0) {
      console.log("[getProducts] First product structure:", JSON.stringify(products[0], null, 2));
    }

    const mappedProducts: ProductResponse[] = products.map((item) => ({
      code: item.code,
      description: item.description,
      price: item.price_distributor_with_ipi || 0,
      priceWithIPI: item.price_final_with_ipi || 0,
    }));

    console.log("[getProducts] Mapped products:", mappedProducts.length);
    res.json({
      success: true,
      data: mappedProducts,
      count: mappedProducts.length,
    });
  } catch (error) {
    console.error("[getProducts] Exception error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch products",
    });
  }
};

export const searchProductsHandler: RequestHandler = async (req, res) => {
  try {
    let { q } = req.query;

    if (!q || (Array.isArray(q) && q.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Search query required",
      });
    }

    // Handle both string and array queries
    const queryString = Array.isArray(q) ? q[0] : q;

    if (typeof queryString !== "string") {
      return res.status(400).json({
        success: false,
        error: "Search query must be a string",
      });
    }

    console.log("[searchProducts] Searching for:", queryString);
    const products = await searchProducts(queryString);

    const mappedProducts: ProductResponse[] = products.map((item) => ({
      code: item.code,
      description: item.description,
      price: item.price_distributor_with_ipi || 0,
      priceWithIPI: item.price_final_with_ipi || 0,
    }));

    res.json({
      success: true,
      data: mappedProducts,
      count: mappedProducts.length,
    });
  } catch (error) {
    console.error("[searchProducts] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search products",
    });
  }
};

export const getProductByCodeHandler: RequestHandler = async (req, res) => {
  try {
    let { code } = req.params;

    if (!code || (Array.isArray(code) && code.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Product code required",
      });
    }

    // Handle both string and array codes (shouldn't happen but be safe)
    const codeString = Array.isArray(code) ? code[0] : code;

    console.log("[getProductByCode] Fetching product:", codeString);
    const product = await getProductByCode(codeString);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const mappedProduct: ProductResponse = {
      code: product.code,
      description: product.description,
      price: product.price_distributor_with_ipi || 0,
      priceWithIPI: product.price_final_with_ipi || 0,
    };

    res.json({
      success: true,
      data: mappedProduct,
    });
  } catch (error) {
    console.error("[getProductByCode] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product",
    });
  }
};

export const importProductsHandler: RequestHandler = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: "Products must be an array",
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one product is required",
      });
    }

    // Validate products
    const validProducts = products.filter((p: any) => {
      return (
        p.code &&
        typeof p.code === "string" &&
        p.description &&
        typeof p.description === "string" &&
        (typeof p.price === "number" || typeof p.price_final_with_ipi === "number") &&
        (typeof p.priceWithIPI === "number" || typeof p.price_final_with_ipi === "number")
      );
    });

    if (validProducts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid products found",
      });
    }

    // Remove duplicates
    const uniqueProducts = Array.from(
      new Map(validProducts.map((p) => [p.code, p])).values()
    );

    // Transform products
    const transformedProducts = uniqueProducts.map((p: any) => ({
      code: p.code.trim(),
      description: p.description.trim(),
      marca: p.marca || p.code.trim(),
      price_distributor: p.price_distributor || p.distributorPrice || 0,
      price_distributor_with_ipi: p.price_distributor_with_ipi || p.distributorPriceWithIPI || 0,
      price_final: p.price_final || p.finalPrice || 0,
      price_final_with_ipi: p.price_final_with_ipi || p.finalPriceWithIPI || 0,
    }));

    console.log("[importProducts] Importing", transformedProducts.length, "products");
    const count = await insertProducts(transformedProducts);

    res.json({
      success: true,
      message: `${count} product(s) imported successfully`,
      count,
    });
  } catch (error) {
    console.error("[importProducts] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to import products",
    });
  }
};

export const deleteAllProductsHandler: RequestHandler = async (req, res) => {
  try {
    console.log("[deleteAllProducts] Deleting all products");
    const count = await deleteAllProducts();

    res.json({
      success: true,
      message: `${count} product(s) deleted successfully`,
      deletedCount: count,
    });
  } catch (error) {
    console.error("[deleteAllProducts] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete products",
    });
  }
};
