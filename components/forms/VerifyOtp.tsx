"use client";

import { useMemo, useState } from "react";

import { Link, useNavigate, useSearchParams } from "@/lib/router";
import { toast } from "sonner";

import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { resolvePostAuthPath } from "@/lib/auth";

export default function VerifyOtp() {
  const params = useSearchParams();
  const initialEmail = params.get("email") || "";
  const redirect = params.get("redirect") || "";
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const nextHref = useMemo(() => {
    if (!redirect) return "/";
    return redirect;
  }, [redirect]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !otp) {
      toast.error("Enter the email address and OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to verify the OTP.");
      }

      if (payload?.user && payload?.token) {
        login?.(payload.user, payload.token);
      }

      toast.success(payload?.message || "OTP verified.");
      navigate(
        resolvePostAuthPath({
          role: payload?.user?.role,
          redirectTo: nextHref,
        })
      );
    } catch (err) {
      toast.error(err?.message || "Unable to verify the OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Verify OTP</CardTitle>
            <CardDescription>
              Enter the one-time password sent to your email to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="otp">OTP</FieldLabel>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </Field>
              </FieldGroup>

              <div className="space-y-3">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify OTP"}
                </Button>
                <Link
                  href="/login"
                  className="block text-center text-sm underline underline-offset-4 hover:no-underline"
                >
                  Back to login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
