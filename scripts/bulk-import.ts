import { getAllProducts, insertProducts } from "../server/lib/d1-client";

// Product data from the CSV file
const csvData = `code,description,marca,price_distributor,price_distributor_with_ipi,price_final,price_final_with_ipi,priceresale,priceresalewithipi
5L500,BATERIA DE LITIO NAO RECARREGAVEL,,2288.58,2511.72,2542.87,2790.80,,
3L960,BATERIA DE NIMH INTERNA RECARREGAVEL,,2379.44,2611.44,2643.83,2901.60,,
AM1000,BATERIA LIMNO2 12 VOLT,,4202.00,4611.70,4668.89,5124.11,,
5931-A,BATERIA NICD 12 VOLT 1.9 AH,,2165.87,2377.04,2406.52,2641.15,,`;

function parsePrice(value: string): number {
  if (!value || value.trim() === "" || value.trim() === "0.00") return 0;
  const cleaned = value.trim().replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parseCSV(content: string) {
  const lines = content.split("\n").filter((line) => line.trim());
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const codeIdx = headers.indexOf("code");
  const descIdx = headers.indexOf("description");
  const marcaIdx = headers.indexOf("marca");
  const distIdx = headers.indexOf("price_distributor");
  const distIpiIdx = headers.indexOf("price_distributor_with_ipi");
  const finalIdx = headers.indexOf("price_final");
  const finalIpiIdx = headers.indexOf("price_final_with_ipi");

  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

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

  return products;
}

async function main() {
  console.log("Parsing CSV data...");
  const products = parseCSV(csvData);
  console.log(`Parsed ${products.length} products`);

  if (products.length > 0) {
    console.log("Sample product:", products[0]);
    console.log("Importing to D1...");
    const count = insertProducts(products);
    console.log(`Successfully imported ${count} products`);

    const allProducts = getAllProducts();
    console.log(`Total products in database: ${allProducts.length}`);
  }
}

main().catch(console.error);
