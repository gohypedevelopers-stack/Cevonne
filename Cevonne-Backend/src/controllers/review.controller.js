const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');

const mediaSchema = z.object({
  url: z.string().url('Media URL must be valid'),
});

const baseReviewSchema = z.object({
  rating: z
    .number({
      required_error: 'Rating is required',
    })
    .int()
    .min(1)
    .max(5),
  title: z.string().trim().max(150).nullish(),
  comment: z.string().trim().max(1000).nullish(),
  media: z.array(mediaSchema).max(6).optional(),
});

const createReviewSchema = baseReviewSchema.extend({
  productId: z.string().min(1, 'Product id is required'),
  userId: z.string().min(1, 'User id is required'),
  status: z
    .enum(['PENDING', 'PUBLISHED', 'REJECTED'])
    .optional(),
});

const updateReviewSchema = baseReviewSchema
  .partial()
  .extend({
    status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED']).optional(),
  })
  .refine(
    (payload) =>
      Object.keys(payload).length > 0,
    {
      message: 'Provide at least one field to update',
    }
  );

const querySchema = z
  .object({
    status: z
      .enum(['PENDING', 'PUBLISHED', 'REJECTED', 'ALL'])
      .optional()
      .default('PUBLISHED'),
    productId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    search: z.string().min(2).optional(),
  })
  .refine(
    (value) => value.productId || value.userId || value.search || value.status,
    { message: 'Invalid query' }
  );

const reviewInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  media: true,
};

exports.listReviews = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const parsed = querySchema.parse(req.query ?? {});

    const where = {
      productId: parsed.productId,
      userId: parsed.userId,
      status: parsed.status === 'ALL' ? undefined : parsed.status,
      OR: parsed.search
        ? [
            { title: { contains: parsed.search, mode: 'insensitive' } },
            { comment: { contains: parsed.search, mode: 'insensitive' } },
            { user: { name: { contains: parsed.search, mode: 'insensitive' } } },
            { user: { email: { contains: parsed.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    // Remove undefined keys to keep Prisma query clean
    Object.keys(where).forEach((key) => {
      if (where[key] === undefined) {
        delete where[key];
      }
    });

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: reviewInclude,
    });

    const summary =
      reviews.length === 0
        ? { averageRating: 0, publishedCount: 0, pendingCount: 0 }
        : await prisma.review.groupBy({
            where: {
              ...where,
              status: undefined,
            },
            by: ['status'],
            _count: true,
          });

    const published = Array.isArray(summary)
      ? summary.find((item) => item.status === 'PUBLISHED')?._count ?? 0
      : 0;
    const pending = Array.isArray(summary)
      ? summary.find((item) => item.status === 'PENDING')?._count ?? 0
      : 0;

    let averageRating = 0;
    if (reviews.length) {
      const publishedReviews = reviews.filter((item) => item.status === 'PUBLISHED');
      if (publishedReviews.length) {
        const total = publishedReviews.reduce((acc, item) => acc + item.rating, 0);
        averageRating = Number((total / publishedReviews.length).toFixed(2));
      }
    }

    return res.status(200).json({
      items: reviews,
      meta: {
        count: reviews.length,
        averageRating,
        publishedCount: published,
        pendingCount: pending,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.errors[0]?.message || 'Invalid review query',
      });
    }
    return next(error);
  }
};

exports.getReview = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const review = await prisma.review.findUnique({
      where: { id: req.params.id },
      include: reviewInclude,
    });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    return res.status(200).json(review);
  } catch (error) {
    return next(error);
  }
};

exports.createReview = async (req, res, next) => {
  try {
    const payload = createReviewSchema.parse(req.body);
    const prisma = await getPrisma();

    const review = await prisma.review.create({
      data: {
        rating: payload.rating,
        title: payload.title ?? null,
        comment: payload.comment ?? null,
        status: payload.status ?? 'PENDING',
        product: { connect: { id: payload.productId } },
        user: { connect: { id: payload.userId } },
        media: payload.media?.length
          ? {
              create: payload.media.map((item) => ({ url: item.url })),
            }
          : undefined,
      },
      include: reviewInclude,
    });
    return res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.errors[0]?.message || 'Invalid review payload',
      });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid productId or userId' });
    }
    return next(error);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    const payload = updateReviewSchema.parse(req.body);
    const prisma = await getPrisma();

    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        rating: payload.rating,
        title: payload.title,
        comment: payload.comment,
        status: payload.status,
        media: payload.media
          ? {
              deleteMany: {},
              create: payload.media.map((item) => ({ url: item.url })),
            }
          : undefined,
      },
      include: reviewInclude,
    });
    return res.status(200).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.errors[0]?.message || 'Invalid review update payload',
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Review not found' });
    }
    return next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    await prisma.review.delete({
      where: { id: req.params.id },
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Review not found' });
    }
    return next(error);
  }
};
