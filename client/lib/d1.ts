export interface Product {
  id?: string;
  code: string;
  description: string;
  marca?: string;
  priceDistributor?: number;
  price_distributor?: number;
  priceDistributorWithIPI?: number;
  price_distributor_with_ipi?: number;
  priceFinal?: number;
  price_final?: number;
  priceFinalWithIPI?: number;
  price_final_with_ipi?: number;
  priceResale?: number;
  priceResaleWithIPI?: number;
  catalog_path?: string | null;
  created_at?: string;
}

export interface BatchItem {
  loteNumber: string;
  codes: string[];
  quantity: number;
}

export interface BatchProduct {
  id: string;
  code: string;
  description: string;
  marca: string;
  descriptor?: string | null;
  price: number;
  priceWithIPI: number;
  totalPrice: number;
  totalPriceWithIPI: number;
}

export function normalizeCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export async function fetchAllProducts(): Promise<Product[]> {
  try {
    console.log("[D1] Fetching all products from API...");
    const response = await fetch("/api/products");
    
    if (!response.ok) {
      console.error("[D1] Failed to fetch products:", response.status);
      return [];
    }

    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      console.log(`[D1] Loaded ${result.data.length} products`);
      return result.data.map((item: any) => {
        const price = item.price || 0;
        const priceWithIPI = item.priceWithIPI || 0;
        return {
          code: item.code,
          description: item.description,
          // Map API response fields to Product interface
          priceDistributor: price,
          price_distributor: price,
          priceDistributorWithIPI: price,
          price_distributor_with_ipi: price,
          priceFinal: priceWithIPI,
          price_final: priceWithIPI,
          priceFinalWithIPI: priceWithIPI,
          price_final_with_ipi: priceWithIPI,
          priceResale: priceWithIPI,
          priceResaleWithIPI: priceWithIPI,
        };
      });
    }

    return [];
  } catch (err) {
    console.error("[D1] Error in fetchAllProducts:", err);
    return [];
  }
}

export async function searchProductByCode(code: string): Promise<Product | null> {
  const normalizedSearchCode = normalizeCode(code);
  const allProducts = await fetchAllProducts();

  const product = allProducts.find(
    (p) => normalizeCode(p.code) === normalizedSearchCode
  );

  return product || null;
}

export async function fetchProductsByCode(codes: string[]): Promise<Product[]> {
  const allProducts = await fetchAllProducts();

  const normalizedSearchCodes = codes.map(normalizeCode);
  const products = allProducts.filter((p) =>
    normalizedSearchCodes.includes(normalizeCode(p.code))
  );

  return products;
}

export async function generateBatchReport(
  batches: BatchItem[],
  multiplier: number = 3
): Promise<{
  success: boolean;
  reports: Array<{
    lote: string;
    codes: string[];
    quantity: number;
    products: Array<{
      code: string;
      description: string;
      descriptor: string | null;
      marca: string;
      price: number;
      priceWithIPI: number;
      totalPrice: number;
      totalPriceWithIPI: number;
      priceMultiplied?: number;
      totalPriceMultiplied?: number;
    }>;
    batchTotalPrice: number;
    batchTotalPriceWithIPI: number;
  }>;
  notFoundCodes: string[];
}> {
  try {
    const { getDescriptor } = await import("@/services/catalogService");

    const allProducts = await fetchAllProducts();
    const reports = [];
    const notFoundCodes: string[] = [];

    for (const batch of batches) {
      const batchProducts: any[] = [];
      let batchTotalPrice = 0;
      let batchTotalPriceWithIPI = 0;

      for (const code of batch.codes) {
        const normalizedCode = normalizeCode(code);
        const product = allProducts.find(
          (p) => normalizeCode(p.code) === normalizedCode
        );

        if (product) {
          const price = (product as any).price || 0;
          const priceWithIPI = (product as any).priceWithIPI || 0;
          const totalPrice = price * batch.quantity;
          const totalPriceWithIPI = priceWithIPI * batch.quantity;
          const priceMultiplied = priceWithIPI * multiplier;
          const totalPriceMultiplied = totalPriceWithIPI * multiplier;

          let descriptor: string | null = null;
          try {
            const descriptorData = await getDescriptor(product.code);
            if (descriptorData && descriptorData.descriptor) {
              descriptor = descriptorData.descriptor;
            }
          } catch (err) {
            console.warn(`Could not load descriptor for ${product.code}:`, err);
          }

          batchProducts.push({
            code: product.code,
            description: product.description,
            descriptor,
            marca: product.marca || "",
            price,
            priceWithIPI,
            totalPrice,
            totalPriceWithIPI,
            priceMultiplied,
            totalPriceMultiplied,
          });

          batchTotalPrice += totalPrice;
          batchTotalPriceWithIPI += totalPriceWithIPI;
        } else {
          notFoundCodes.push(code);
        }
      }

      reports.push({
        lote: batch.loteNumber,
        codes: batch.codes,
        quantity: batch.quantity,
        products: batchProducts,
        batchTotalPrice,
        batchTotalPriceWithIPI,
      });
    }

    return {
      success: true,
      reports,
      notFoundCodes,
    };
  } catch (error) {
    console.error("[D1] Error generating batch report:", error);
    return {
      success: false,
      reports: [],
      notFoundCodes: [],
    };
  }
}
