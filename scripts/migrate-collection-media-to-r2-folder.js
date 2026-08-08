import path from "node:path";

import dotenv from "dotenv";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const APPLY = process.argv.includes("--apply");
const COLLECTIONS_PREFIX = "collections/";
const ROOT_COLLECTION_KEY = /^collection-(?:image|video)-[^/]+$/;

const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "").trim();
const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "").trim();
const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || "").trim();
const publicUrl = (
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_BASE_URL ||
  process.env.R2_PUBLIC_URL ||
  ""
).trim().replace(/\/+$/, "");
const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || "").trim();

for (const [name, value] of Object.entries({ accountId, accessKeyId, secretAccessKey, bucket, databaseUrl })) {
  if (!value) {
    throw new Error(`Missing required environment value: ${name}`);
  }
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const encodeKeyPath = (key) => key.split("/").map(encodeURIComponent).join("/");
const buildPublicUrl = (key) => (publicUrl ? `${publicUrl}/${encodeKeyPath(key)}` : key);
const targetKeyFor = (key) => `${COLLECTIONS_PREFIX}${key}`;

const replaceStorageKey = (value, oldKey, newKey) => {
  if (typeof value !== "string" || !value) return value;
  if (value.includes(oldKey)) return value.replace(oldKey, newKey);

  const encodedOldKey = encodeKeyPath(oldKey);
  if (value.includes(encodedOldKey)) return value.replace(encodedOldKey, encodeKeyPath(newKey));

  return value === buildPublicUrl(oldKey) ? buildPublicUrl(newKey) : value;
};

const objectExists = async (key) => {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") return false;
    throw error;
  }
};

const listRootCollectionKeys = async () => {
  const keys = [];
  let continuationToken;

  do {
    const page = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "collection-",
        ContinuationToken: continuationToken,
      })
    );

    for (const item of page.Contents || []) {
      if (typeof item.Key === "string" && ROOT_COLLECTION_KEY.test(item.Key)) {
        keys.push(item.Key);
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
};

const main = async () => {
  const media = await prisma.collectionMedia.findMany({
    select: { id: true, collectionId: true, storageKey: true, url: true },
  });
  const mediaByKey = new Map(
    media
      .filter((item) => ROOT_COLLECTION_KEY.test(item.storageKey))
      .map((item) => [item.storageKey, item])
  );
  const rootObjectKeys = await listRootCollectionKeys();
  const candidateKeys = [...new Set([...mediaByKey.keys(), ...rootObjectKeys])].sort();

  if (!candidateKeys.length) {
    console.log("No root-level collection media keys need migration.");
    return;
  }

  console.log(`${APPLY ? "Applying" : "Dry run"}: ${candidateKeys.length} root collection object(s) -> ${COLLECTIONS_PREFIX}`);

  const keyChanges = new Map();
  for (const oldKey of candidateKeys) {
    const item = mediaByKey.get(oldKey);
    const newKey = targetKeyFor(oldKey);
    keyChanges.set(oldKey, newKey);

    if (!APPLY) {
      console.log(`  ${oldKey} -> ${newKey}`);
      continue;
    }

    if (!(await objectExists(oldKey))) {
      console.warn(`  Skipping ${oldKey}: source object was not found in R2.`);
      continue;
    }

    if (!(await objectExists(newKey))) {
      await r2.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: newKey,
          CopySource: encodeURIComponent(`${bucket}/${oldKey}`),
        })
      );
    }

    if (item) {
      await prisma.collectionMedia.update({
        where: { id: item.id },
        data: {
          storageKey: newKey,
          url: replaceStorageKey(item.url, oldKey, newKey),
        },
      });
    }

    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
    console.log(`  moved ${oldKey} -> ${newKey}`);
  }

  if (!APPLY) return;

  const collections = await prisma.collection.findMany({ select: { id: true, imageUrl: true } });
  for (const collection of collections) {
    let nextImageUrl = collection.imageUrl;
    for (const [oldKey, newKey] of keyChanges) {
      nextImageUrl = replaceStorageKey(nextImageUrl, oldKey, newKey);
    }

    if (nextImageUrl !== collection.imageUrl) {
      await prisma.collection.update({
        where: { id: collection.id },
        data: { imageUrl: nextImageUrl },
      });
    }
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    r2.destroy();
  });
