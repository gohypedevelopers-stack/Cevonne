import nodemailer from "nodemailer";

import { env } from "../config/env";

const smtpPort = env.smtpPort ?? 587;
const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: {
    user: env.smtpUser,
    pass: env.googleAppKey,
  },
});

export const sendOTP = async (email: string, otp: string) => {
  const mailOptions = {
    from: env.emailFrom,
    to: email,
    subject: 'Your Login OTP - Cevonne',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333; text-align: center;">Cevonne Login OTP</h2>
        <p>Hello,</p>
        <p>Your one-time password for logging into Cevonne is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #000;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Cevonne. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordReset = async (email: string, resetUrl: string) => {
  const mailOptions = {
    from: env.emailFrom,
    to: email,
    subject: "Reset your Cevonne password",
    text: `Use this link to reset your Cevonne password. It expires in one hour: ${resetUrl}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333; text-align: center;">Reset your Cevonne password</h2>
        <p>We received a request to reset your password.</p>
        <p style="margin: 28px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 999px;">Reset password</a>
        </p>
        <p>This link expires in one hour. If you did not request it, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export default { sendOTP, sendPasswordReset };
