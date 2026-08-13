"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, useLocation, useNavigate } from "@/lib/router";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

import { Input } from "@/components/ui/input";

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // using credentialed CORS; backend configured accordingly
  headers: { "Content-Type": "application/json" },
});

const LOGIN_CAMPAIGN_IMAGE =
  "https://cdn.cevonne.com/assets/images/ChatGPT%20Image%20Aug%2010%2C%202026%2C%2011_50_49%20AM.png";

export default function Login({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const searchParams = new URLSearchParams(location.search || "");
  const redirectTo = searchParams.get("redirect") || "";

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      // POST -> /api/users/signin (router mounted at /api/users)
      const { data } = await api.post("/users/signin", formData);

      if (data?.otpRequired) {
        const params = new URLSearchParams();
        params.set("email", formData.email);
        if (redirectTo) params.set("redirect", redirectTo);
        navigate(`/verify-otp?${params.toString()}`);
        toast.success(data?.message || "OTP sent to your email.");
        return;
      }

      toast.success("Logged in successfully!");
      // Persist to AuthContext (token + user)
      login?.(data.user, data.token);

      navigate(
        resolvePostAuthPath({
          role: data?.user?.role,
          redirectTo,
        })
      );
    } catch (err) {
      console.error("Login error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-[100dvh] bg-[#fffefd] text-[#181614] lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-[100dvh] overflow-hidden bg-[#b87537] lg:block">
        <Image
          src={LOGIN_CAMPAIGN_IMAGE}
          alt="Cevonne lipstick collection by the coast"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
        />
      </aside>

      <div className="flex min-h-[100dvh] items-center justify-center px-5 py-12 sm:px-10 lg:px-16 xl:px-24">
        <div className={cn("w-full max-w-[34rem]", className)} {...props}>
        <header>
          <h1 className="font-sans text-xl font-medium tracking-[-0.035em] sm:text-[1.35rem]">
            Login
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#6b645e]">
            Sign in to access your saved favourites, orders, and a faster checkout.
          </p>
        </header>

        <div className="mt-12 sm:mt-14">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-xs font-medium tracking-[0.01em]">
                Email address<span aria-hidden="true">*</span>
              </label>
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              required
              className="h-12 !rounded-[0.3rem] border-[#8b8580] bg-white px-4 text-sm text-[#181614] shadow-none placeholder:text-[#a6a09a] focus-visible:border-[#181614] focus-visible:ring-1 focus-visible:ring-[#181614]"
            />

            <div className="pt-0.5">
              <label htmlFor="password" className="text-xs font-medium tracking-[0.01em]">
                Password<span aria-hidden="true">*</span>
              </label>
              <div className="relative mt-2.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="h-12 !rounded-[0.3rem] border-[#8b8580] bg-white px-4 pr-12 text-sm text-[#181614] shadow-none placeholder:text-[#a6a09a] focus-visible:border-[#181614] focus-visible:ring-1 focus-visible:ring-[#181614]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center !rounded-full text-[#514b46] transition-colors hover:bg-[#f5f1ec] hover:text-[#181614] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Link
                href="/forgot-password"
                className="mt-2 inline-flex text-xs font-medium underline-offset-4 transition-colors hover:text-[#685154] hover:underline focus-visible:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex h-12 w-full items-center justify-center bg-black px-6 text-sm font-semibold text-white !rounded-full transition-[background-color,transform] hover:bg-[#2c2927] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>

            <div className="pt-1">
              <div className="mb-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-[#ded8d2]" />
                <span className="text-[0.6875rem] font-medium tracking-[0.08em] text-[#756d67]">
                  OR
                </span>
                <span className="h-px flex-1 bg-[#ded8d2]" />
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => toast.info("Google sign-in is coming soon.")}
                className="flex h-13 w-full items-center justify-center gap-3 border border-[#24201d] bg-transparent px-5 text-sm font-medium tracking-[-0.01em] !rounded-full transition-colors hover:bg-[#f7f3ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GoogleMark />
                Sign in with Google
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-center text-xs leading-5 text-[#6b645e]">
                By clicking continue, you agree to our{" "}
                <Link
                  href="/terms"
                  className="font-medium text-[#181614] underline decoration-[#514b46] underline-offset-4 transition-colors hover:text-[#685154]"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="font-medium text-[#181614] underline decoration-[#514b46] underline-offset-4 transition-colors hover:text-[#685154]"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              <p className="text-center text-sm text-[#514b46]">
                New to Cevonne?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-[#181614] underline decoration-[#514b46] underline-offset-4 transition-colors hover:text-[#685154]"
                >
                  Create account
                </Link>
              </p>
            </div>
          </form>
        </div>
        </div>
      </div>

    </div>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.75-5.58-4.11H3.08v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.42 13.93A6.02 6.02 0 0 1 6.11 12c0-.67.11-1.32.31-1.93V7.48H3.08A10 10 0 0 0 2 12c0 1.61.39 3.13 1.08 4.52l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87C16.96 2.98 14.7 2 12 2a10 10 0 0 0-8.92 5.48l3.34 2.59C7.2 7.71 9.4 5.96 12 5.96Z" />
    </svg>
  );
}
