import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestLines, isCatalogCardComplete, type Item } from '../src/domain.ts';

const id = '10000000-0000-4000-8000-000000000001';
const product: Extract<Item, { kind: 'product' }> = {
  id,
  kind: 'product',
  name: 'Лежанка',
  description: 'Мягкая лежанка для кошек и собак.',
  categoryId: '20000000-0000-4000-8000-000000000001',
  price: 3490,
  currency: 'RUB',
  publicationStatus: 'PUBLISHED',
  version: 1,
  images: [
    {
      mediaId: '30000000-0000-4000-8000-000000000001',
      alt: 'Лежанка',
      isCover: true,
      position: 0,
      imageUrl: '/api/v3/media/30000000-0000-4000-8000-000000000001/image',
      thumbUrl: '/api/v3/media/30000000-0000-4000-8000-000000000001/thumb',
    },
  ],
  sku: 'BED-1',
  brand: '',
  productType: 'ACCESSORY',
  animalTypes: ['cat', 'dog'],
  feedForm: '',
  lifeStages: [],
  netWeightGrams: null,
  ingredients: '',
  stock: 3,
  reserved: 0,
  availableQuantity: 3,
};
const pet: Extract<Item, { kind: 'pet' }> = {
  id: '40000000-0000-4000-8000-000000000001',
  kind: 'pet',
  name: 'Барсик',
  description: 'Ласковый кот, который ждёт свой дом.',
  categoryId: product.categoryId,
  price: 7000,
  currency: 'RUB',
  publicationStatus: 'PUBLISHED',
  version: 1,
  images: product.images,
  animalType: 'cat',
  breed: '',
  sex: '',
  birthDate: null,
  status: 'available',
  photoUrls: [],
};

test('catalog excludes legacy pets with placeholder photo URLs and empty fields', () => {
  const legacyPet = {
    ...pet,
    name: 'Cat 1',
    description: '',
    categoryId: null,
    images: [],
    photoUrls: ['url1', 'url2'],
  };
  assert.deepEqual(
    [product, legacyPet, pet].filter(isCatalogCardComplete).map((v) => v.name),
    ['Лежанка', 'Барсик'],
  );
  assert.equal(legacyPet.images.length, 0);
  // Проверка витрины не теряет уже выбранные позиции гостевой корзины.
  assert.equal(
    guestLines([{ id: legacyPet.id, kind: 'pet', quantity: 1 }], [legacyPet])[0]
      .name,
    'Cat 1',
  );
});

test('catalog requires publication, name, description, category, positive price and a managed photo', () => {
  for (const item of [product, pet]) {
    assert.equal(isCatalogCardComplete(item), true);
    const incomplete: Item[] = [
      { ...item, publicationStatus: 'DRAFT' },
      { ...item, publicationStatus: 'ARCHIVED' },
      { ...item, name: '   ' },
      { ...item, description: '   ' },
      { ...item, categoryId: null },
      { ...item, price: null },
      { ...item, price: 0 },
      { ...item, images: [] },
    ];
    for (const candidate of incomplete)
      assert.equal(isCatalogCardComplete(candidate), false);
  }
});

test('catalog checks required product and pet attributes while preserving optional fields', () => {
  assert.equal(isCatalogCardComplete({ ...pet, animalType: null }), false);
  assert.equal(isCatalogCardComplete({ ...product, sku: null }), false);
  assert.equal(isCatalogCardComplete({ ...product, productType: null }), false);
  assert.equal(isCatalogCardComplete({ ...product, animalTypes: [] }), false);
  assert.equal(isCatalogCardComplete(product), true); // Бренд аксессуара необязателен.
  assert.equal(isCatalogCardComplete(pet), true); // Порода и дата рождения необязательны.
  const feed = {
    ...product,
    productType: 'FEED',
    brand: 'Учебная линейка',
    feedForm: 'DRY',
    lifeStages: ['ADULT'],
    netWeightGrams: 1000,
  };
  assert.equal(isCatalogCardComplete(feed), true);
  for (const candidate of [
    { ...feed, brand: ' ' },
    { ...feed, feedForm: '' },
    { ...feed, lifeStages: [] },
    { ...feed, netWeightGrams: null },
    { ...feed, netWeightGrams: 0 },
  ])
    assert.equal(isCatalogCardComplete(candidate), false);
});

test('filled cards stay visible even when the product is out of stock or the pet is reserved', () => {
  assert.equal(
    isCatalogCardComplete({ ...product, stock: 0, availableQuantity: 0 }),
    true,
  );
  assert.equal(isCatalogCardComplete({ ...pet, status: 'reserved' }), true);
});
