import { CORE_FETCH_GRAPHQL } from '../../scripts/commerce.js';

const CATEGORY_ID_QUERY = `
  query($name: String!) {
    categories(filters: { name: { match: $name } }) {
      items { id name }
    }
  }
`;

const SORT_MAP = {
  'price-asc': '{ price: ASC }',
  'price-desc': '{ price: DESC }',
  'name-asc': '{ name: ASC }',
  'name-desc': '{ name: DESC }',
};

// Parses authored rows of the shape "key: value" into a config object.
// Order of rows doesn't matter, and unrecognized keys are ignored —
// authors can freely combine any supported parameters in da.live
// without needing a code change for new combinations.
function parseBlockConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const text = row.textContent.trim();
    const separatorIndex = text.indexOf(':');
    if (separatorIndex === -1) return;
    const key = text.slice(0, separatorIndex).trim().toLowerCase();
    const value = text.slice(separatorIndex + 1).trim();
    if (key && value) config[key] = value;
  });
  return config;
}

async function resolveCategoryId(categoryName) {
  const { data, errors } = await CORE_FETCH_GRAPHQL.fetchGraphQl(CATEGORY_ID_QUERY, {
    variables: { name: categoryName },
  });
  if (errors || !data.categories.items.length) return null;
  return data.categories.items[0].id;
}

function buildProductsQuery({ pageSize, categoryId, sort }) {
  const filter = categoryId ? `filter: { category_id: { eq: "${categoryId}" } },` : '';
  const sortClause = sort ? `sort: ${sort},` : '';
  return `
    query {
      products(search: "", ${filter} ${sortClause} pageSize: ${pageSize}) {
        items {
          name
          sku
          small_image { url }
          price_range {
            minimum_price {
              regular_price { value currency }
            }
          }
          ... on ConfigurableProduct {
            variants {
              product { sku }
            }
          }
        }
      }
    }
  `;
}

export default async function decorate(block) {
  // Authored rows use "key: value" syntax, one per row, any order:
  //   count: 4
  //   category: Watches
  //   sort: price-asc | price-desc | name-asc | name-desc
  const config = parseBlockConfig(block);

  const urlParams = new URLSearchParams(window.location.search);
  const categoryIdFromUrl = urlParams.get('category');

  const pageSize = config.count && !Number.isNaN(Number(config.count)) ? Number(config.count) : 12;
  const sort = SORT_MAP[config.sort] || null;

  block.textContent = '';

  const loading = document.createElement('p');
  loading.textContent = 'Loading products...';
  block.append(loading);

  let categoryId = categoryIdFromUrl;
  if (!categoryId && config.category) {
    try {
      categoryId = await resolveCategoryId(config.category);
    } catch (e) {
      // fall through, show all products if category lookup fails
    }
  }

  let data;
  let errors;
  try {
    ({ data, errors } = await CORE_FETCH_GRAPHQL.fetchGraphQl(buildProductsQuery({ pageSize, categoryId, sort })));
  } catch (e) {
    loading.textContent = `Failed to load products: ${e.message}`;
    return;
  }

  if (errors) {
    loading.textContent = `Error: ${errors[0].message}`;
    return;
  }

  block.textContent = '';

  if (config.category) {
    const heading = document.createElement('h2');
    heading.textContent = config.category;
    block.append(heading);
  }

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
        const firstVariantSku = product.variants?.[0]?.product?.sku;

        if (firstVariantSku) {
          await addProductsToCart([{
            sku: firstVariantSku,
            parentSku: product.sku,
            quantity: 1,
          }]);
        } else {
          await addProductsToCart([{ sku: product.sku, quantity: 1 }]);
        }

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
