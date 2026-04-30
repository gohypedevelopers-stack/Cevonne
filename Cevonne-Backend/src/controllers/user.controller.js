const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');
const { signToken } = require('../utils/jwt');

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().optional(),
});

const roleSchema = z.object({
  role: z.enum(['ADMIN', 'CUSTOMER']),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    email: z.string().email().optional(),
  })
  .refine((payload) => payload.name || payload.email, {
    message: 'No changes provided',
  });

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

const buildAuthResponse = (user) => ({
  user: sanitizeUser(user),
  token: signToken({ id: user.id, role: user.role }),
});

const handleError = (error, res, next) => {
  if (error.code === 'P2002') {
    return res.status(409).json({ message: 'Email already exists' });
  }
  return next(error);
};

exports.signup = async (req, res, next) => {
  try {
    const { email, password, name } = authSchema.parse(req.body);
    const prisma = await getPrisma();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    return res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    return handleError(error, res, next);
  }
};

exports.signin = async (req, res, next) => {
  try {
    const { email, password } = authSchema.omit({ name: true }).parse(req.body);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.status(200).json(buildAuthResponse(user));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    return next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

exports.listUsers = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { role } = roleSchema.parse(req.body);
    const prisma = await getPrisma();

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });
    return res.status(200).json(sanitizeUser(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    return next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        expiresAt,
        userId: user.id,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || ''}/reset-password/${rawToken}`;

    return res.status(200).json({
      message: 'If that email exists, a reset link has been sent.',
      resetUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    return next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = resetSchema.parse(req.body);
    const prisma = await getPrisma();

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Token is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.delete({ where: { id: record.id } });

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    return next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const prisma = await getPrisma();

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
    });

    return res.status(200).json(sanitizeUser(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'Invalid payload' });
    }
    return handleError(error, res, next);
  }
};
