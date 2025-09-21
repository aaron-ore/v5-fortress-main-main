import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { Loader2 } from "lucide-react"; // Import Loader2
import { logActivity } from "@/utils/logActivity"; // NEW: Import logActivity
import { useProfile, type UserProfile } from "@/context/ProfileContext"; // NEW: Import useProfile to get current profile

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth(); // Use useAuth to get user and loading state
  const { profile } = useProfile(); // NEW: Get current profile for logging

  // Effect to redirect if user is already authenticated
  useEffect(() => {
    if (!isLoading && user) {
      console.log("[Auth.tsx] User already authenticated, redirecting to dashboard.");
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(error.message);
        await logActivity("Login Failed", `User ${email} failed to log in.`, profile, { error_message: error.message }, true);
      } else {
        showSuccess("Logged in successfully!");
        await logActivity("Login Success", `User ${email} logged in successfully.`, profile);
        // The useEffect above will handle the navigation to "/"
      }
    } else {
      const options = {
        data: {
          full_name: fullName.trim() || null,
          company_code: companyCode.trim() || null,
        },
        redirectTo: window.location.origin + '/auth', // This is correct for sending back to the app's auth route
      };
      const { error } = await supabase.auth.signUp({ email, password, options });
      if (error) {
        showError(error.message);
        await logActivity("Signup Failed", `User ${email} failed to sign up.`, profile, { error_message: error.message, full_name: fullName, company_code: companyCode }, true);
      } else {
        showSuccess("Account created! Please check your email to confirm.");
        await logActivity("Signup Success", `User ${email} signed up successfully.`, profile, { full_name: fullName, company_code: companyCode });
        setIsLogin(true); // Switch to login form after signup
        setFullName("");
        setCompanyCode("");
      }
    }
    setLoading(false);
  };

  // Removed handleGoogleSignIn function

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError("Please enter your email address to reset your password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) {
      showError(error.message);
      await logActivity("Forgot Password Failed", `Password reset request failed for ${email}.`, profile, { error_message: error.message }, true);
    } else {
      showSuccess("Password reset email sent! Check your inbox.");
      await logActivity("Forgot Password Request", `Password reset email sent to ${email}.`, profile);
    }
    setLoading(false);
  };

  // If still loading auth state, show a loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-2">Checking authentication status.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user is already authenticated, the useEffect will handle redirection, so this part won't be reached.
  // If not authenticated, render the auth form.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* Fortress Logo */}
          <div className="flex items-center justify-center space-x-2 mb-4">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-primary"
            >
              <path
                d="M12 2L2 12L12 22L22 12L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M12 2L2 12L12 22L22 12L12 2Z"
                fill="currentColor"
                fillOpacity="0.2"
            />
          </svg>
            <span className="text-3xl font-bold text-foreground">Fortress</span>
          </div>
          <CardTitle className="text-3xl font-bold">
            {isLogin ? "Welcome Back!" : "Join Fortress"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your account" : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Your Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCode">Company Code (Optional)</Label>
                  <Input
                    id="companyCode"
                    type="text"
                    placeholder="Enter company code (e.g., FORTRESS123)"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If you have a company code, enter it to join your organization.
                  </p>
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
            </Button>
          </form>
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          {/* Removed Google Sign-In Button */}
          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <Button variant="link" onClick={() => setIsLogin(false)} className="p-0 h-auto">
                  Sign Up
                </Button>
                <div className="mt-2">
                  <Button variant="link" onClick={handleForgotPassword} className="p-0 h-auto text-muted-foreground hover:text-primary" disabled={loading}>
                    Forgot Password?
                  </Button>
                </div>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Button variant="link" onClick={() => setIsLogin(true)} className="p-0 h-auto">
                  Sign In
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;