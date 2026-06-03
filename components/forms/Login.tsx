"use client";

import { useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { resolvePostAuthPath } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // using credentialed CORS; backend configured accordingly
  headers: { "Content-Type": "application/json" },
});

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
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className={cn("w-full max-w-md", className)} {...props}>
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>
              Enter your email and password to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </Field>

                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      href="/forgot-password"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="pr-12"
                      required
                    />
                    {formData.password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20
                                   flex items-center justify-center p-1
                                   text-primary hover:text-primary
                                   focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </Field>

                <Field className="space-y-3 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>

                  <Button
                    variant="outline"
                    type="button"
                    className="w-full bg-background"
                    disabled={isLoading}
                    onClick={() => toast.info("Google login coming soon")}
                  >
                    Login with Google
                  </Button>

                  <FieldDescription className="text-center">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="underline underline-offset-4">
                      Sign up
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

