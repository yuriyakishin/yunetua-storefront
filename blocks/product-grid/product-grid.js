import { CORE_FETCH_GRAPHQL } from '../../scripts/commerce.js';

function buildQuery(pageSize) {
  return `
    query {
      products(search: "", pageSize: ${pageSize}) {
        items {
          name
          sku
          small_image { url }
          price_range {
            minimum_price {
              regular_price { value currency }
            }
          }
        }
      }
    }
  `;
}

export default async function decorate(block) {
  // Optional first row in the authored table can specify how many
  // products to show, e.g. a single cell containing "4".
  const paramText = block.children[0]?.textContent.trim();
  const pageSize = paramText && !Number.isNaN(Number(paramText)) ? Number(paramText) : 12;

  block.textContent = '';

  const loading = document.createElement('p');
  loading.textContent = 'Loading products...';
  block.append(loading);

  let data;
  let errors;
  try {
    ({ data, errors } = await CORE_FETCH_GRAPHQL.fetchGraphQl(buildQuery(pageSize)));
  } catch (e) {
    loading.textContent = `Failed to load products: ${e.message}`;
    return;
  }

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

    const img = document.createElement('img');
    img.className = 'product-grid-image';
    img.src = product.small_image?.url || '';
    img.alt = product.name;
    img.loading = 'lazy';

    const name = document.createElement('h3');
    name.textContent = product.name;

    const sku = document.createElement('p');
    sku.className = 'product-grid-sku';
    sku.textContent = product.sku;

    card.append(img, name, sku);

    if (product.price_range) {
      const price = document.createElement('p');
      price.className = 'product-grid-price';
      const { value, currency } = product.price_range.minimum_price.regular_price;
      price.textContent = `${value.toFixed(2)} ${currency}`;
      card.append(price);
    }

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'product-grid-add-button';
    addButton.textContent = 'Add to Cart';

    addButton.addEventListener('click', async () => {
      addButton.disabled = true;
      addButton.textContent = 'Adding...';
      try {
        const { addProductsToCart } = await import('@dropins/storefront-cart/api.js');
        await addProductsToCart([{ sku: product.sku, quantity: 1 }]);
        addButton.textContent = 'Added ✓';
        setTimeout(() => {
          addButton.textContent = 'Add to Cart';
          addButton.disabled = false;
        }, 1500);
      } catch (e) {
        addButton.textContent = 'Error';
        // eslint-disable-next-line no-console
        console.error('Failed to add product to cart:', e);
        setTimeout(() => {
          addButton.textContent = 'Add to Cart';
          addButton.disabled = false;
        }, 1500);
      }
    });

    card.append(addButton);
    grid.append(card);
  });

  block.append(grid);
}
