const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, 'products_importssssssss.csv');

if (!fs.existsSync(csvPath)) {
  console.error(`❌ Arquivo não encontrado: ${csvPath}`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf-8');

console.log(`📁 Lendo arquivo: ${csvPath}`);
console.log(`📊 Tamanho: ${(csvContent.length / 1024).toFixed(2)} KB`);

const lines = csvContent.split('\n').filter(line => line.trim());
console.log(`📈 Linhas totais: ${lines.length}`);
console.log(`📦 Produtos para importar: ${lines.length - 1}`);

// URL da API (ajuste conforme necessário)
const apiUrl = 'http://localhost:8080/api/products/import-csv';

console.log(`\n🌐 Enviando para: ${apiUrl}`);
console.log('⏳ Aguarde...\n');

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    csvContent: csvContent,
  }),
})
  .then(response => {
    if (!response.ok) {
      console.error(`❌ Erro HTTP ${response.status}`);
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      console.log(`✅ Sucesso!`);
      console.log(`📦 ${data.count} produtos importados`);
      console.log(`💾 Mensagem: ${data.message}`);
    } else {
      console.error(`❌ Erro na API: ${data.error}`);
      if (data.details) {
        console.error(`Detalhes: ${data.details}`);
      }
    }
  })
  .catch(error => {
    console.error(`❌ Erro ao importar:`, error.message);
    console.log(`\n💡 Dica: Certifique-se que o servidor está rodando em http://localhost:8080`);
    process.exit(1);
  });
