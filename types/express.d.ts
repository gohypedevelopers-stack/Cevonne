import type { SessionUser } from "./user";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
    }
  }
}

export {};
