import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { z } from "zod";

import { env } from "../config";
import { getPrisma } from "../db/prismaClient";
import { signToken } from "../utils/jwt";
import { sendOTP, sendPasswordReset } from "../utils/email";
import { sanitizeUser, buildAuthResponse } from "../services/auth.service";

const cjsModule = { exports: {} as Record<string, any> };
const exports = cjsModule.exports as Record<string, any>;


const PASSWORD_MIN_LENGTH = 12;

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number");

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().optional(),
});

const roleSchema = z.object({
  role: z.enum(['ADMIN', 'CUSTOMER']),
});

const hasOtpMailConfig =
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_PORT) &&
  Boolean(process.env.SMTP_USER) &&
  Boolean(process.env.EMAIL_FROM);

// Keep the existing OTP flow for production, but avoid blocking local dev
// when SMTP is not configured yet.
const otpFlowEnabled = process.env.NODE_ENV === 'production' && hasOtpMailConfig;

const forgotSchema = z.object({
  email: emailSchema,
});

const resetSchema = z.object({
  password: passwordSchema,
});

const verifyOTPSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const createOtp = () => crypto.randomInt(100000, 1_000_000).toString();
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");


const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    email: z.string().email().optional(),
  })
  .refine((payload) => payload.name || payload.email, {
    message: 'No changes provided',
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

    const otp = otpFlowEnabled ? createOtp() : null;
    const otpExpiresAt = otpFlowEnabled ? new Date(Date.now() + 10 * 60 * 1000) : null;

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        otp: otp ? hashOtp(otp) : null,
        otpExpiresAt,
      },
    });

    if (!otpFlowEnabled) {
      return res.status(201).json({
        message: 'Account created successfully.',
        ...buildAuthResponse(user),
      });
    }

    if (!otp) {
      return res.status(500).json({
        message: 'Unable to generate OTP.',
      });
    }

    const recipientEmail = email ?? user.email;
    if (!recipientEmail) {
      return res.status(500).json({ message: 'Unable to determine email.' });
    }

    try {
      await sendOTP(recipientEmail, otp);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }

    return res.status(201).json({
      message: 'Account created. OTP sent to your email. Please verify to continue.',
      otpRequired: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
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

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!otpFlowEnabled) {
      return res.status(200).json(buildAuthResponse(user));
    }

    const otp = createOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { email },
      data: { otp: hashOtp(otp), otpExpiresAt },
    });

    const recipientEmail = email;
    if (!recipientEmail) {
      return res.status(500).json({ message: 'Unable to determine email.' });
    }

    try {
      await sendOTP(recipientEmail, otp);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }

    return res.status(200).json({
      message: 'OTP sent to your email. Please verify to continue.',
      otpRequired: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
    }
    return next(error);
  }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = verifyOTPSchema.parse(req.body);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== hashOtp(otp) || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP after successful verification
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpiresAt: null },
    });

    return res.status(200).json(buildAuthResponse(updatedUser));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
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
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
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

    if (!env.frontendUrl) {
      console.error("Password reset email is unavailable because FRONTEND_URL is not configured.");
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

    const resetUrl = `${env.frontendUrl.replace(/\/+$/, '')}/reset-password/${rawToken}`;

    try {
      await sendPasswordReset(user.email, resetUrl);
    } catch (emailError) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      console.error('Failed to send password reset email:', emailError);
    }

    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
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
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await prisma.passwordResetToken.delete({ where: { id: record.id } });

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
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
      return res.status(400).json({ message: error.issues?.[0]?.message || 'Invalid payload' });
    }
    return handleError(error, res, next);
  }
};

cjsModule.exports = {
  signup: exports.signup,
  signin: exports.signin,
  verifyOTP: exports.verifyOTP,
  getProfile: exports.getProfile,
  listUsers: exports.listUsers,
  updateRole: exports.updateRole,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword,
  updateProfile: exports.updateProfile,
};

export default cjsModule.exports;
