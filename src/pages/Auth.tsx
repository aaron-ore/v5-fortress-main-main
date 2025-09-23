import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useLocation } from "react-router-dom"; // NEW: Import useLocation
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { logActivity } from "@/utils/logActivity";
import { useProfile } from "@/context/ProfileContext";

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // NEW: Initialize useLocation
  const { user, isLoading } = useAuth();
  const { profile } = useProfile();

  // NEW: State to store the plan from URL parameter
  const [selectedPlanFromUrl, setSelectedPlanFromUrl] = useState<string | null>(null);

  // Effect to read URL parameters on component mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      setSelectedPlanFromUrl(plan);
      setIsLogin(false); // Automatically switch to signup if a plan is selected
      showSuccess(`You've selected the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan! Please sign up to continue.`);
    }
  }, [location.search]);

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
      }
    } else {
      const options = {
        data: {
          full_name: fullName.trim() || null,
          company_code: companyCode.trim() || null,
          plan: selectedPlanFromUrl, // NEW: Include selected plan in metadata
        },
        redirectTo: window.location.origin + '/auth',
      };
      const { error } = await supabase.auth.signUp({ email, password, options });
      if (error) {
        showError(error.message);
        await logActivity("Signup Failed", `User ${email} failed to sign up.`, profile, { error_message: error.message, full_name: fullName, company_code: companyCode, plan: selectedPlanFromUrl }, true);
      } else {
        showSuccess("Account created! Please check your email to confirm.");
        await logActivity("Signup Success", `User ${email} signed up successfully.`, profile, { full_name: fullName, company_code: companyCode, plan: selectedPlanFromUrl });
        setIsLogin(true);
        setFullName("");
        setCompanyCode("");
        setSelectedPlanFromUrl(null); // Clear selected plan after signup
      }
    }
    setLoading(false);
  };

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
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
          {selectedPlanFromUrl && !isLogin && ( // NEW: Display selected plan
            <p className="text-sm text-primary font-semibold mt-2">
              Signing up for: {selectedPlanFromUrl.charAt(0).toUpperCase() + selectedPlanFromUrl.slice(1)} Plan
            </p>
          )}
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