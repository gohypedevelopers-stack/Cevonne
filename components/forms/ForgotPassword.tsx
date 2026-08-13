"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Link } from "@/lib/router";
import { API_BASE } from "@/lib/api";
import { Input } from "@/components/ui/input";

const FORGOT_PASSWORD_CAMPAIGN_IMAGE =
  "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%2010%2C%202026%2C%2012_20_49%20PM.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to request a password reset.");
      }

      toast.success(payload?.message || "Password reset link sent.");
      setResetUrl(payload?.resetUrl || "");
    } catch (error) {
      toast.error(error?.message || "Unable to request a password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-[100dvh] bg-[#fffefd] text-[#181614] lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-[100dvh] overflow-hidden bg-[#bc8d68] lg:block">
        <Image
          src={FORGOT_PASSWORD_CAMPAIGN_IMAGE}
          alt="Cevonne beauty collection"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
        />
      </aside>

      <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-[34rem]">
          <header>
            <h1 className="font-sans text-xl font-medium tracking-[-0.035em] sm:text-[1.35rem]">
              Forgot password
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6b645e]">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5 sm:mt-12">
            <div>
              <label htmlFor="email" className="text-xs font-medium tracking-[0.01em]">
                Email address<span aria-hidden="true">*</span>
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
                required
                className="mt-2.5 h-12 !rounded-[0.3rem] border-[#8b8580] bg-white px-4 text-sm text-[#181614] shadow-none placeholder:text-[#a6a09a] focus-visible:border-[#181614] focus-visible:ring-1 focus-visible:ring-[#181614]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center bg-black px-6 text-sm font-semibold text-white !rounded-full transition-[background-color,transform] hover:bg-[#2c2927] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-[#514b46]">
              Remembered your password?{" "}
              <Link
                href="/login"
                className="font-medium text-[#181614] underline-offset-4 transition-colors hover:text-[#685154] hover:underline focus-visible:underline"
              >
                Back to login
              </Link>
            </p>

            {resetUrl ? (
              <div className="border border-[#ded8d2] bg-[#fcfaf7] p-4 text-sm" aria-live="polite">
                <p className="font-medium text-[#181614]">Reset link</p>
                <a
                  href={resetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-[#514b46] underline underline-offset-4 hover:text-[#685154]"
                >
                  {resetUrl}
                </a>
                <p className="mt-2 text-xs leading-5 text-[#6b645e]">
                  This appears only in local development when the backend returns the generated link.
                </p>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
