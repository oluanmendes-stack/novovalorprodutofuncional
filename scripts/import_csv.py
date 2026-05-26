#!/usr/bin/env python3
import csv
import json
import sys

def parse_price(value):
    """Parse price string, handling comma as decimal separator"""
    if not value or value.strip() == '' or value.strip() == '0.00':
        return 0
    # Remove spaces and convert comma to dot
    cleaned = value.strip().replace(',', '.')
    try:
        return float(cleaned)
    except:
        return 0

# Read CSV file
products = []
with open('products_importssssssss.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        code = (row.get('code') or '').strip()
        if not code:
            continue
            
        product = {
            'code': code,
            'description': (row.get('description') or '').strip(),
            'marca': (row.get('marca') or code).strip(),
            'price': parse_price(row.get('price_distributor_with_ipi', '')),
            'priceWithIPI': parse_price(row.get('price_final_with_ipi', '')),
            'distributorPrice': parse_price(row.get('price_distributor', '')),
            'distributorPriceWithIPI': parse_price(row.get('price_distributor_with_ipi', '')),
            'finalPrice': parse_price(row.get('price_final', '')),
            'finalPriceWithIPI': parse_price(row.get('price_final_with_ipi', '')),
        }
        products.append(product)

print(f"Loaded {len(products)} products", file=sys.stderr)
if products:
    print(f"Sample product: {json.dumps(products[0], indent=2)}", file=sys.stderr)

# Output JSON
output = {'products': products}
print(json.dumps(output))
