import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { signInWithPopup } from "firebase/auth";

import { auth, googleProvider } from "@/lib/firebase";

// Base API URL (e.g., http://localhost:5000/api)
const API_BASE =
  import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:5000/api";

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // using credentialed CORS; backend is configured for this
  headers: { "Content-Type": "application/json" },
});

export default function SignupForm({ className, ...props }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    otp: "",
  });
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

    setIsLoading(true);

    try {
      // POST -> /api/users/signup (router mounted at /api/users)
      const { data } = await api.post("/users/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });

      if (data.otpRequired) {
        setOtpRequired(true);
        toast.success(data.message || "Account created! OTP sent to your email.");
      } else {
        completeSignup(data);
      }
    } catch (err) {
      console.error("Signup error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Signup failed. Please try again.";
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

      completeSignup(data);
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

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const { data } = await api.post("/users/google", {
        email: user.email,
        name: user.displayName,
      });

      completeSignup(data);
    } catch (error) {
      console.error("Google signup error:", error);
      toast.error("Failed to sign up with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const completeSignup = (data) => {
    toast.success("Account setup complete!");
    // Save auth in context
    login?.(data.user, data.token);
    if (data?.user?.role === "ADMIN") {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className={cn("w-full max-w-md", className)} {...props}>
        <CardHeader>
          <CardTitle className="text-2xl">{otpRequired ? "Verify OTP" : "Create an account"}</CardTitle>
          <CardDescription>
            {otpRequired 
              ? `Enter the 6-digit code sent to ${formData.email}`
              : "Enter your details below to create your new account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              {!otpRequired ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="bg-background"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="bg-background"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={isLoading}
                        className="bg-background pr-12"
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
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="otp">One-Time Password</Label>
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
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? otpRequired
                      ? "Verifying..."
                      : "Creating account..."
                    : otpRequired
                    ? "Verify OTP"
                    : "Create Account"}
                </Button>
                
                {!otpRequired && (
                  <Button
                    variant="outline"
                    className="w-full bg-background"
                    disabled={isLoading}
                    type="button"
                    onClick={handleGoogleSignup}
                  >
                    Sign up with Google
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link to="/login" className="underline underline-offset-4">
                Log in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
