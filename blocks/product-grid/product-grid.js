import { CORE_FETCH_GRAPHQL } from '../../scripts/commerce.js';

const PRODUCTS_QUERY = `
  query {
    products(search: "", pageSize: 12) {
      items {
        name
        sku
        price_range {
          minimum_price {
            regular_price { value currency }
          }
        }
      }
    }
  }
`;

export default async function decorate(block) {
  block.textContent = '';

  const loading = document.createElement('p');
  loading.textContent = 'Loading products...';
  block.append(loading);

  try {
    const { data, errors } = await CORE_FETCH_GRAPHQL.fetchGraphQl(PRODUCTS_QUERY);

    if (errors) {
      loading.textContent = `Error: ${errors[0].message}`;
      return;
    }

    block.textContent = '';
    const grid = document.createElement('div');
    grid.className = 'product-grid-items';

    data.products.items.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'product-grid-card';

      const name = document.createElement('h3');
      name.textContent = product.name;

      const sku = document.createElement('p');
      sku.className = 'product-grid-sku';
      sku.textContent = product.sku;

      card.append(name, sku);

      if (product.price_range) {
        const price = document.createElement('p');
        price.className = 'product-grid-price';
        const { value, currency } = product.price_range.minimum_price.regular_price;
        price.textContent = `${value.toFixed(2)} ${currency}`;
        card.append(price);
      }

      grid.append(card);
    });

    block.append(grid);
  } catch (e) {
    loading.textContent = `Failed to load products: ${e.message}`;
  }
}
