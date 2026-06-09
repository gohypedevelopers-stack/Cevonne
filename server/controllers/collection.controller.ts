import { z } from "zod";

import { normalizeUploadedAssetUrl } from "@/lib/asset-url";
import { getPrisma } from "../db/prismaClient";
import { deleteFileFromR2 } from "@/server/services/r2";

const cjsModule = { exports: {} as Record<string, any> };
const exports = cjsModule.exports as Record<string, any>;

const collectionMediaSchema = z.object({
  url: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  kind: z.enum(["IMAGE", "VIDEO"]),
  mimeType: z.string().trim().optional().nullable(),
  fileName: z.string().trim().optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
  alt: z.string().trim().optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional().nullable(),
});

const collectionSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  media: z.array(collectionMediaSchema).max(6).optional(),
});

const validateMediaLimits = (
  value: { media?: Array<{ kind: "IMAGE" | "VIDEO" }> },
  ctx: z.RefinementCtx
) => {
  if (!Array.isArray(value.media) || value.media.length === 0) {
    return;
  }

  const images = value.media.filter((item) => item.kind === "IMAGE").length;
  const videos = value.media.filter((item) => item.kind === "VIDEO").length;

  if (images > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["media"],
      message: "You can upload up to 5 images.",
    });
  }

  if (videos > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["media"],
      message: "You can upload only 1 video.",
    });
  }
};

const collectionCreateSchema = collectionSchema.superRefine(validateMediaLimits);
const collectionUpdateSchema = collectionSchema.partial().superRefine(validateMediaLimits);

const collectionMediaSelect = {
  id: true,
  collectionId: true,
  kind: true,
  url: true,
  storageKey: true,
  mimeType: true,
  fileName: true,
  size: true,
  alt: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

const collectionInclude = {
  media: {
    orderBy: { sortOrder: "asc" as const },
    select: collectionMediaSelect,
  },
  _count: {
    select: { products: true },
  },
} as const;

const trimOrNull = (value?: string | null) => {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeMediaItem = (item: Record<string, any>) => ({
  ...item,
  url: normalizeUploadedAssetUrl(item.url) ?? item.url,
});

const normalizeCollection = (collection: Record<string, any> | null) => {
  if (!collection) return collection;

  const media = Array.isArray(collection.media)
    ? collection.media.map((item: Record<string, any>) => normalizeMediaItem(item))
    : collection.media;

  return {
    ...collection,
    imageUrl: normalizeUploadedAssetUrl(collection.imageUrl) ?? collection.imageUrl,
    media,
  };
};

const toMediaCreateInput = (item: z.infer<typeof collectionMediaSchema>, index: number) => ({
  kind: item.kind,
  url: normalizeUploadedAssetUrl(item.url) ?? item.url,
  storageKey: item.storageKey,
  mimeType: trimOrNull(item.mimeType),
  fileName: trimOrNull(item.fileName),
  size: item.size ?? null,
  alt: trimOrNull(item.alt),
  sortOrder: item.sortOrder ?? index,
});

const resolveCoverImageUrl = (media: Array<z.infer<typeof collectionMediaSchema>>) => {
  const image = media.find((item) => item.kind === "IMAGE");
  return image ? normalizeUploadedAssetUrl(image.url) ?? image.url : null;
};

const deleteStorageKeys = async (storageKeys: string[]) => {
  const keys = storageKeys.filter(Boolean);
  if (!keys.length) return;

  await Promise.allSettled(keys.map((key) => deleteFileFromR2(key)));
};

exports.listCollections = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const collections = await prisma.collection.findMany({
      orderBy: { name: "asc" },
      include: collectionInclude,
    });
    return res.status(200).json(collections.map(normalizeCollection));
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
        ...collectionInclude,
        products: {
          select: { id: true, name: true, slug: true, basePrice: true },
        },
      },
    });
    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }
    return res.status(200).json(normalizeCollection(collection));
  } catch (error) {
    return next(error);
  }
};

exports.createCollection = async (req, res, next) => {
  try {
    const payload = collectionCreateSchema.parse(req.body);
    const prisma = await getPrisma();
    const media = Array.isArray(payload.media) ? payload.media : [];
    const coverImageUrl = trimOrNull(payload.imageUrl) ?? resolveCoverImageUrl(media);

    const createdCollection = await prisma.collection.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        description: trimOrNull(payload.description),
        imageUrl: coverImageUrl,
      },
    });

    if (media.length) {
      try {
        await prisma.collectionMedia.createMany({
          data: media.map((item, index) => ({
            collectionId: createdCollection.id,
            ...toMediaCreateInput(item, index),
          })),
        });
      } catch (mediaError) {
        await prisma.collection.delete({
          where: { id: createdCollection.id },
        });
        throw mediaError;
      }
    }

    const collection = await prisma.collection.findUnique({
      where: { id: createdCollection.id },
      include: collectionInclude,
    });

    return res.status(201).json(normalizeCollection(collection));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || "Invalid payload" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Collection slug already exists" });
    }
    return next(error);
  }
};

exports.updateCollection = async (req, res, next) => {
  try {
    const payload = collectionUpdateSchema.parse(req.body);
    const prisma = await getPrisma();
    const existing = await prisma.collection.findUnique({
      where: { id: req.params.id },
      select: {
        media: {
          select: {
            storageKey: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Collection not found" });
    }

    const mediaProvided = Array.isArray(payload.media);
    const nextMedia = Array.isArray(payload.media) ? payload.media : [];
    const removedStorageKeys = mediaProvided
      ? existing.media
          .map((item) => item.storageKey)
          .filter((key) => !nextMedia.some((item) => item.storageKey === key))
      : [];

    const data: Record<string, any> = {};

    if (payload.name !== undefined) {
      data.name = payload.name;
    }

    if (payload.slug !== undefined) {
      data.slug = payload.slug;
    }

    if (payload.description !== undefined) {
      data.description = trimOrNull(payload.description);
    }

    if (payload.imageUrl !== undefined) {
      data.imageUrl = trimOrNull(payload.imageUrl);
    } else if (mediaProvided) {
      data.imageUrl = resolveCoverImageUrl(nextMedia);
    }

    const mediaOperations = mediaProvided
      ? [
          prisma.collectionMedia.deleteMany({
            where: { collectionId: req.params.id },
          }),
          ...(nextMedia.length
            ? [
                prisma.collectionMedia.createMany({
                  data: nextMedia.map((item, index) => ({
                    collectionId: req.params.id,
                    ...toMediaCreateInput(item, index),
                  })),
                }),
              ]
            : []),
        ]
      : [];

    await prisma.$transaction([prisma.collection.update({ where: { id: req.params.id }, data }), ...mediaOperations]);

    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: collectionInclude,
    });

    if (removedStorageKeys.length) {
      await deleteStorageKeys(removedStorageKeys);
    }

    return res.status(200).json(normalizeCollection(collection));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || "Invalid payload" });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Collection not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Collection slug already exists" });
    }
    return next(error);
  }
};

exports.deleteCollection = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      select: {
        media: {
          select: {
            storageKey: true,
          },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    await prisma.collection.delete({
      where: { id: req.params.id },
    });

    await deleteStorageKeys(collection.media.map((item) => item.storageKey));
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Collection not found" });
    }
    return next(error);
  }
};

cjsModule.exports = {
  listCollections: exports.listCollections,
  getCollection: exports.getCollection,
  createCollection: exports.createCollection,
  updateCollection: exports.updateCollection,
  deleteCollection: exports.deleteCollection,
};

export default cjsModule.exports;
