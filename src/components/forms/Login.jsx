import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { signInWithPopup } from "firebase/auth";

import { auth, googleProvider } from "@/lib/firebase";
import { cn } from "@/lib/utils";
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

// Base API URL (e.g., http://localhost:5000/api)
const API_BASE =
  import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:5000/api";

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // using credentialed CORS; backend configured accordingly
  headers: { "Content-Type": "application/json" },
});

export default function Login({ className, ...props }) {
  const [formData, setFormData] = useState({ email: "", password: "", otp: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (otpRequired) {
      return handleVerifyOTP();
    }

    if (!formData.email || !formData.password) {
      toast.error("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      // POST -> /api/users/signin (router mounted at /api/users)
      const { data } = await api.post("/users/signin", {
        email: formData.email,
        password: formData.password,
      });

      if (data.otpRequired) {
        setOtpRequired(true);
        toast.success(data.message || "OTP sent to your email!");
      } else {
        // Fallback if OTP is not enabled/required for some reason
        completeLogin(data);
      }
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

  const handleVerifyOTP = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post("/users/verify-otp", {
        email: formData.email,
        otp: formData.otp,
      });

      completeLogin(data);
    } catch (err) {
      console.error("OTP verification error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Invalid OTP. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const { data } = await api.post("/users/google", {
        email: user.email,
        name: user.displayName,
      });

      completeLogin(data);
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Failed to login with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = (data) => {
    toast.success("Logged in successfully!");
    // Persist to AuthContext (token + user)
    login?.(data.user, data.token);

    if (data?.user?.role === "ADMIN") {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className={cn("w-full max-w-md", className)} {...props}>
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>{otpRequired ? "Verify OTP" : "Login to your account"}</CardTitle>
            <CardDescription>
              {otpRequired
                ? `Enter the 6-digit code sent to ${formData.email}`
                : "Enter your email and password to access your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {!otpRequired ? (
                  <>
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
                          to="/forgot-password"
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
                  </>
                ) : (
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="otp">One-Time Password</FieldLabel>
                      <button
                        type="button"
                        onClick={() => setOtpRequired(false)}
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="123456"
                      value={formData.otp}
                      onChange={handleChange}
                      disabled={isLoading}
                      maxLength={6}
                      className="text-center text-2xl tracking-[1em] font-bold"
                      required
                      autoFocus
                    />
                  </Field>
                )}

                <Field className="space-y-3 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? otpRequired
                        ? "Verifying..."
                        : "Logging in..."
                      : otpRequired
                      ? "Verify OTP"
                      : "Login"}
                  </Button>

                  {!otpRequired && (
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full bg-background"
                      disabled={isLoading}
                      onClick={handleGoogleLogin}
                    >
                      Login with Google
                    </Button>
                  )}

                  <FieldDescription className="text-center">
                    Don&apos;t have an account?{" "}
                    <Link to="/signup" className="underline underline-offset-4">
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

