const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');

const quantitySchema = z.object({
  quantity: z.number().int().min(0),
});

exports.listInventory = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const records = await prisma.inventory.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        shade: {
          include: {
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });
    return res.status(200).json(records);
  } catch (error) {
    return next(error);
  }
};

exports.listLowStock = async (req, res, next) => {
  try {
    const lt = Number(req.query.lt ?? 10);
    const prisma = await getPrisma();
    const records = await prisma.inventory.findMany({
      where: { quantity: { lt } },
      orderBy: { quantity: 'asc' },
      include: {
        shade: {
          include: {
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });
    return res.status(200).json(records);
  } catch (error) {
    return next(error);
  }
};

exports.updateInventory = async (req, res, next) => {
  try {
    const payload = quantitySchema.parse(req.body);
    const prisma = await getPrisma();

    const record = await prisma.inventory.upsert({
      where: { shadeId: req.params.shadeId },
      create: {
        shadeId: req.params.shadeId,
        quantity: payload.quantity,
      },
      update: {
        quantity: payload.quantity,
      },
      include: {
        shade: {
          include: {
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    return res.status(200).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return res.status(404).json({ message: 'Shade not found' });
    }
    return next(error);
  }
};
