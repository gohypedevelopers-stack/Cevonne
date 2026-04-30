const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');

const baseCollectionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

exports.listCollections = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const collections = await prisma.collection.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    return res.status(200).json(collections);
  } catch (error) {
    return next(error);
  }
};

exports.getCollection = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          select: { id: true, name: true, slug: true, basePrice: true },
        },
      },
    });
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    return res.status(200).json(collection);
  } catch (error) {
    return next(error);
  }
};

exports.createCollection = async (req, res, next) => {
  try {
    const payload = baseCollectionSchema.parse(req.body);
    const prisma = await getPrisma();
    const collection = await prisma.collection.create({
      data: payload,
    });
    return res.status(201).json(collection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Collection slug already exists' });
    }
    return next(error);
  }
};

exports.updateCollection = async (req, res, next) => {
  try {
    const payload = baseCollectionSchema.partial().parse(req.body);
    const prisma = await getPrisma();
    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: payload,
    });
    return res.status(200).json(collection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Collection slug already exists' });
    }
    return next(error);
  }
};

exports.deleteCollection = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    await prisma.collection.delete({
      where: { id: req.params.id },
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Collection not found' });
    }
    return next(error);
  }
};
