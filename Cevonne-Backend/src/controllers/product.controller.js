const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');

const imageSchema = z.object({
  url: z
    .string()
    .min(1, 'Image URL is required')
    .refine(
      (val) => {
        try {
          // Allow absolute URLs and asset-like relative paths
          // eslint-disable-next-line no-new
          new URL(val);
          return true;
        } catch (err) {
          return /^[\w/@.:-]+$/i.test(val);
        }
      },
      { message: 'Image URL must be a valid URL or asset path' }
    ),
  alt: z.string().optional(),
});

const shadeSchema = z.object({
  name: z.string().min(1),
  hexColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'Hex must be a 6 character hex code')
    .transform((value) => (value.startsWith('#') ? value : `#${value}`)),
  sku: z.string().optional(),
  arAssetUrl: z.string().trim().optional().nullable(),
  arPreviewUrl: z.string().trim().optional().nullable(),
  arCode: z.string().trim().optional().nullable(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
});

const experienceSchema = z
  .object({
    subtitle: z.string().optional(),
    categoryPath: z.array(z.string()).optional(),
    longDescription: z.string().optional(),
    videoUrl: z.string().optional(),
    hero: z
      .object({
        image: z.string().optional(),
        objectPosition: z.string().optional(),
        bg: z.string().optional(),
        overlay: z.string().optional(),
        wheelScrollSwitch: z.boolean().optional(),
      })
      .optional(),
    theme: z
      .object({
        defaultBg: z.string().optional(),
        bgScenes: z.record(z.string()).optional(),
        bgTone: z.record(z.string()).optional(),
      })
      .optional(),
    gallery: z.array(z.string()).optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    badges: z
      .array(
        z.union([
          z.string(),
          z.object({
            type: z.string().optional(),
            label: z.string().optional(),
          }),
        ])
      )
      .optional(),
    benefits: z.array(z.string()).optional(),
    ingredientsHighlight: z
      .array(
        z.object({
          name: z.string().optional(),
          why: z.string().optional(),
        })
      )
      .optional(),
    howToUse: z.array(z.string()).optional(),
    claims: z.array(z.string()).optional(),
    disclaimer: z.string().optional(),
    faqs: z
      .array(
        z.object({
          q: z.string(),
          a: z.string(),
        })
      )
      .optional(),
    shipping: z.string().optional(),
    returns: z.string().optional(),
    pricing: z
      .object({
        price: z.number().optional(),
        originalValue: z.number().optional(),
        currency: z.string().optional(),
        discountText: z.string().optional(),
      })
      .optional(),
    reviewsList: z
      .array(
        z.object({
          author: z.string().optional(),
          rating: z.number().optional(),
          title: z.string().optional(),
          comment: z.string().optional(),
          date: z.string().optional(),
        })
      )
      .optional(),
    videoTitle: z.string().optional(),
    videoDescription: z.string().optional(),
    ingredientsTitle: z.string().optional(),
  })
  .partial()
  .passthrough();

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  brand: z.string().optional(),
  productType: z.string().optional(),
  tags: z.any().optional(),
  badges: z.any().optional(),
  description: z.string().optional(),
  finish: z.string().optional(),
  basePrice: z.number().min(0),
  collectionId: z.string().nullish(),
  images: z.array(imageSchema).optional(),
  shades: z.array(shadeSchema).optional(),
  media: z.any().optional(),
  pricing: z
    .object({
      price: z.number().optional(),
      originalValue: z.number().optional(),
      currency: z.string().optional(),
      discountText: z.string().optional(),
    })
    .optional(),
  ingredients: z.any().optional(),
  size: z.any().optional(),
  setContents: z.any().optional(),
  experience: experienceSchema.optional(),
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const slugify = (value) => {
  if (!value) return undefined;
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const collectGalleryUrls = (raw = {}) => {
  const galleryItems = Array.isArray(raw.gallery) ? raw.gallery : [];
  const experienceGallery = Array.isArray(raw.experience?.gallery) ? raw.experience.gallery : [];
  const mediaGallery = Array.isArray(raw.media?.gallery)
    ? raw.media.gallery.map((g) => g?.url || g?.id || g?.src)
    : [];
  const heroImage = raw.media?.heroImage || raw.hero?.image;

  return [
    heroImage,
    ...galleryItems,
    ...experienceGallery,
    ...mediaGallery,
  ]
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      if (typeof item === 'object') return item.url || item.id || '';
      return '';
    })
    .filter(Boolean)
    .filter((val, idx, arr) => arr.indexOf(val) === idx);
};

const normalizeImagesInput = (raw = {}) => {
  if (Array.isArray(raw.images) && raw.images.length) {
    return raw.images
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') return { url: image };
        return {
          url: image.url ?? image.src ?? image.id ?? '',
          alt: image.alt,
        };
      })
      .filter((img) => img?.url);
  }

  const gallery = collectGalleryUrls(raw);
  return gallery.length ? gallery.map((url) => ({ url })) : undefined;
};

const normalizeShadesInput = (shades) => {
  if (!Array.isArray(shades) || !shades.length) return undefined;
  return shades.map((shade, index) => ({
    name: shade?.name ?? shade?.label ?? shade?.title ?? shade?.id ?? `Shade ${index + 1}`,
    hexColor: shade?.hexColor ?? shade?.hex ?? shade?.color ?? '#000000',
    sku: shade?.sku ?? shade?.key ?? shade?.id,
    arAssetUrl: shade?.arAssetUrl ?? shade?.arAsset ?? shade?.assetUrl ?? null,
    arPreviewUrl: shade?.arPreviewUrl ?? shade?.previewUrl ?? null,
    arCode: shade?.arCode ?? shade?.code ?? null,
    price: toNumber(shade?.price ?? shade?.basePrice ?? shade?.mrp),
    quantity: shade?.quantity ?? shade?.qty ?? shade?.stock,
  }));
};

const normalizeExperiencePayload = (raw = {}) => {
  const experience = { ...(raw.experience ?? {}) };
  const setIfDefined = (key, value) => {
    if (value !== undefined && value !== null) {
      experience[key] = value;
    }
  };

  setIfDefined('title', raw.title);
  setIfDefined('subtitle', raw.subtitle ?? raw.description?.headline);
  setIfDefined('categoryPath', raw.categoryPath);
  setIfDefined('longDescription', raw.longDescription ?? raw.description?.body);
  setIfDefined('videoUrl', raw.videoUrl);
  setIfDefined('hero', raw.hero);
  setIfDefined('theme', raw.theme);

  const gallery = collectGalleryUrls(raw);
  if (gallery.length) setIfDefined('gallery', gallery);

  setIfDefined('rating', toNumber(raw.rating));
  setIfDefined('reviewCount', toNumber(raw.reviewCount ?? raw.reviews));
  setIfDefined('badges', raw.badges);
  setIfDefined('benefits', raw.benefits);

  const ingredients = raw.ingredients_highlight ?? raw.ingredientsHighlight;
  if (ingredients !== undefined) setIfDefined('ingredientsHighlight', ingredients);

  const howToUse = raw.how_to_use ?? raw.howToUse;
  if (howToUse !== undefined) setIfDefined('howToUse', howToUse);

  setIfDefined('claims', raw.claims);
  setIfDefined('disclaimer', raw.disclaimer);
  setIfDefined('faqs', raw.faqs);
  setIfDefined('shipping', raw.shipping);
  setIfDefined('returns', raw.returns);
  setIfDefined('reviewsList', raw.reviewsList);
  setIfDefined('videoTitle', raw.videoTitle);
  setIfDefined('videoDescription', raw.videoDescription);
  setIfDefined('ingredientsTitle', raw.ingredientsTitle);

  const pricing = raw.pricing ?? {
    price: toNumber(raw.price),
    originalValue: toNumber(raw.mrp),
    currency: raw.currency,
    discountText: raw.discountText,
  };
  if (pricing && Object.values(pricing).some((v) => v !== undefined && v !== null)) {
    setIfDefined('pricing', {
      ...pricing,
      price: toNumber(pricing.price),
      originalValue: toNumber(pricing.originalValue),
    });
  }

  return Object.keys(experience).length ? experience : undefined;
};

const normalizeProductInput = (raw = {}, { allowDefaults = true, deriveSlug = true } = {}) => {
  const normalized = { ...raw };

  const name = raw.name ?? (allowDefaults ? raw.title ?? raw.id : raw.name);
  if (name !== undefined) normalized.name = name;

  if (deriveSlug) {
    const slugSource = raw.slug ?? raw.id ?? (allowDefaults ? name : undefined);
    if (slugSource) {
      normalized.slug =
        slugSource === raw.slug ? slugSource : slugify(slugSource) || slugSource;
    }
  } else if (raw.slug !== undefined) {
    normalized.slug = raw.slug;
  }

  const description =
    typeof raw.description === 'string'
      ? raw.description
      : raw.description?.body ??
        raw.description?.headline ??
        (allowDefaults ? raw.longDescription ?? raw.subtitle : undefined);
  if (description !== undefined) normalized.description = description;

  const priceValue = toNumber(
    raw.basePrice ??
      raw.price ??
      raw.pricing?.price ??
      raw.mrp ??
      raw.pricing?.originalValue
  );
  if (priceValue !== undefined) normalized.basePrice = priceValue;

  if (raw.brand !== undefined) normalized.brand = raw.brand;
  if (raw.type !== undefined) normalized.productType = raw.type;
  if (raw.tags !== undefined) normalized.tags = raw.tags;
  if (raw.badges !== undefined) normalized.badges = raw.badges;
  if (raw.media !== undefined) normalized.media = raw.media;
  if (raw.ingredients !== undefined) normalized.ingredients = raw.ingredients;
  if (raw.size !== undefined) normalized.size = raw.size;
  if (raw.setContents !== undefined) normalized.setContents = raw.setContents;

  if (raw.pricing !== undefined) {
    const pricing = raw.pricing ?? {};
    normalized.pricing = {
      ...pricing,
      price: toNumber(pricing.price),
      originalValue: toNumber(pricing.originalValue),
    };
  }

  if (raw.finish !== undefined) normalized.finish = raw.finish;
  if (raw.collectionId !== undefined) normalized.collectionId = raw.collectionId;

  const shades = normalizeShadesInput(raw.shades);
  if (shades) normalized.shades = shades;

  const images = normalizeImagesInput(raw);
  if (images) normalized.images = images;

  const experience = normalizeExperiencePayload(raw);
  if (experience) normalized.experience = experience;

  return normalized;
};

const parseProductInput = (raw, { partial = false } = {}) => {
  const normalized = normalizeProductInput(raw, {
    allowDefaults: !partial,
    deriveSlug: !partial,
  });
  const schema = partial ? productSchema.partial() : productSchema;
  return schema.parse(normalized);
};

const productInclude = {
  collection: true,
  images: true,
  shades: {
    include: {
      inventory: true,
    },
  },
  reviews: {
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    include: {
      media: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  _count: {
    select: {
      reviews: {
        where: { status: 'PUBLISHED' },
      },
    },
  },
};

const toDecimalString = (value) =>
  value !== undefined && value !== null ? value.toString() : null;

const buildProductData = (payload) => ({
  name: payload.name,
  slug: payload.slug,
  brand: payload.brand,
  productType: payload.productType,
  tags: payload.tags,
  badges: payload.badges,
  description: payload.description,
  finish: payload.finish,
  basePrice: toDecimalString(payload.basePrice),
  media: payload.media,
  pricing: payload.pricing,
  ingredients: payload.ingredients,
  size: payload.size,
  setContents: payload.setContents,
  experience: payload.experience,
  collection: payload.collectionId
    ? { connect: { id: payload.collectionId } }
    : undefined,
  images: payload.images?.length
    ? {
        create: payload.images.map((image) => ({
          url: image.url,
        })),
      }
    : undefined,
  shades: payload.shades?.length
    ? {
        create: payload.shades.map((shade) => ({
          name: shade.name,
          hexColor: shade.hexColor.toUpperCase(),
          sku: shade.sku ?? null,
          arAssetUrl: shade.arAssetUrl ?? null,
          arPreviewUrl: shade.arPreviewUrl ?? null,
          arCode: shade.arCode ?? null,
          price: toDecimalString(shade.price),
          inventory: {
            create: {
              quantity: shade.quantity ?? 0,
            },
          },
        })),
      }
    : undefined,
});

const normalizeBulkItem = (item) => parseProductInput(item);

const toProductResponse = (product) => {
  if (!product) return product;

  const publishedReviews = Array.isArray(product.reviews)
    ? product.reviews.filter((review) => review.status === 'PUBLISHED' || !review.status)
    : [];

  const countValue = product._count?.reviews;
  const reviewCount =
    typeof countValue === 'number'
      ? countValue
      : Array.isArray(product.reviews)
      ? product.reviews.length
      : 0;

  const averageRating =
    publishedReviews.length > 0
      ? Number(
          (
            publishedReviews.reduce((total, current) => total + current.rating, 0) /
            publishedReviews.length
          ).toFixed(2)
        )
      : 0;

  return {
    ...product,
    averageRating,
    reviewCount,
  };
};

exports.listProducts = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const { q } = req.query;
    const products = await prisma.product.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    });
    const mapped = products.map(toProductResponse);
    return res.status(200).json(mapped);
  } catch (error) {
    return next(error);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productInclude,
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json(toProductResponse(product));
  } catch (error) {
    return next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const payload = parseProductInput(req.body);
    const prisma = await getPrisma();

    const product = await prisma.product.create({
      data: buildProductData(payload),
      include: productInclude,
    });

    return res.status(201).json(toProductResponse(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.errors[0]?.message || 'Invalid payload',
      });
    }
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ message: 'Product slug already exists' });
    }
    return next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const payload = parseProductInput(req.body, { partial: true });
    const prisma = await getPrisma();

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: payload.name,
        slug: payload.slug,
        brand: payload.brand,
        productType: payload.productType,
        tags: payload.tags,
        badges: payload.badges,
        description: payload.description,
        finish: payload.finish,
        media: payload.media,
        pricing: payload.pricing,
        ingredients: payload.ingredients,
        size: payload.size,
        setContents: payload.setContents,
        experience: payload.experience,
        basePrice:
          payload.basePrice !== undefined
            ? toDecimalString(payload.basePrice)
            : undefined,
        collection: payload.collectionId
          ? { connect: { id: payload.collectionId } }
          : payload.collectionId === null
          ? { disconnect: true }
          : undefined,
        images: payload.images
          ? {
              deleteMany: {},
              create: payload.images.map((image) => ({
                url: image.url,
              })),
            }
          : undefined,
      },
      include: productInclude,
    });

    if (payload.shades) {
      await prisma.inventory.deleteMany({
        where: { shade: { productId: product.id } },
      });
      await prisma.shade.deleteMany({
        where: { productId: product.id },
      });

      if (payload.shades.length) {
        const createdShades = await prisma.shade.createMany({
          data: payload.shades.map((shade) => ({
            name: shade.name,
            hexColor: shade.hexColor.toUpperCase(),
            sku: shade.sku ?? null,
            arAssetUrl: shade.arAssetUrl ?? null,
            arPreviewUrl: shade.arPreviewUrl ?? null,
            arCode: shade.arCode ?? null,
            price: toDecimalString(shade.price),
            productId: product.id,
          })),
        });

        if (createdShades.count) {
          const shades = await prisma.shade.findMany({
            where: { productId: product.id },
          });
          await Promise.all(
            shades.map((shade, index) =>
              prisma.inventory.create({
                data: {
                  shadeId: shade.id,
                  quantity: payload.shades?.[index]?.quantity ?? 0,
                },
              })
            )
          );
        }
      }
    }

    const refreshed = await prisma.product.findUnique({
      where: { id: product.id },
      include: productInclude,
    });

    return res.status(200).json(toProductResponse(refreshed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.errors[0]?.message || 'Invalid payload',
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ message: 'Product slug already exists' });
    }
    return next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    await prisma.product.delete({
      where: { id: req.params.id },
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' });
    }
    return next(error);
  }
};

exports.bulkImportProducts = async (req, res, next) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Provide an array of products under "items".' });
  }

  const prisma = await getPrisma();
  const summary = {
    created: 0,
    updated: 0,
    failed: 0,
    results: [],
  };

  for (const rawItem of items) {
    try {
      const payload = normalizeBulkItem(rawItem);
      const existing = await prisma.product.findUnique({
        where: { slug: payload.slug },
      });

      if (existing) {
        await prisma.productImage.deleteMany({ where: { productId: existing.id } });
        await prisma.inventory.deleteMany({ where: { shade: { productId: existing.id } } });
        await prisma.shade.deleteMany({ where: { productId: existing.id } });

        await prisma.product.update({
          where: { id: existing.id },
          data: buildProductData(payload),
        });

        summary.updated += 1;
        summary.results.push({ slug: payload.slug, status: 'updated' });
      } else {
        await prisma.product.create({
          data: buildProductData(payload),
        });
        summary.created += 1;
        summary.results.push({ slug: payload.slug, status: 'created' });
      }
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        slug: rawItem?.slug ?? rawItem?.name ?? 'unknown',
        status: 'failed',
        message: error.message || 'Unable to import product',
      });
    }
  }

  return res.status(200).json(summary);
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

exports.exportProducts = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        collection: true,
        shades: {
          include: { inventory: true },
        },
      },
    });

    const headers = [
      'Name',
      'Slug',
      'Base price (INR)',
      'Collection',
      'Shades',
      'Shade SKUs',
      'Shade Quantities',
    ];

    const rows = products.map((product) => {
      const shadeNames = product.shades.map((shade) => shade.name).join(' | ');
      const shadeSkus = product.shades.map((shade) => shade.sku ?? '').join(' | ');
      const shadeQty = product.shades
        .map((shade) => shade.inventory?.quantity ?? 0)
        .join(' | ');
      return [
        product.name,
        product.slug,
        product.basePrice,
        product.collection?.name ?? '',
        shadeNames,
        shadeSkus,
        shadeQty,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};
