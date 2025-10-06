import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { profile } = useProfile();

  const [selectedPlanFromUrl, setSelectedPlanFromUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      setSelectedPlanFromUrl(plan);
      setIsLogin(false);
      showSuccess(`Selected ${plan} plan! Sign up.`);
    }
  }, [location.search]);

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
        showSuccess("Logged in!");
        await logActivity("Login Success", `User ${email} logged in successfully.`, profile);
      }
    } else {
      const options = {
        data: {
          full_name: fullName.trim() || null,
          company_code: companyCode.trim() || null,
          plan: selectedPlanFromUrl,
        },
        redirectTo: window.location.origin + '/auth',
      };
      const { error } = await supabase.auth.signUp({ email, password, options });
      if (error) {
        showError(error.message);
        await logActivity("Signup Failed", `User ${email} failed to sign up.`, profile, { error_message: error.message, full_name: fullName, company_code: companyCode, plan: selectedPlanFromUrl }, true);
      } else {
        showSuccess("Account created! Check email to confirm.");
        await logActivity("Signup Success", `User ${email} signed up successfully.`, profile, { full_name: fullName, company_code: companyCode, plan: selectedPlanFromUrl });
        setIsLogin(true);
        setFullName("");
        setCompanyCode("");
        setSelectedPlanFromUrl(null);
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError("Enter email to reset password.");
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
      showSuccess("Password reset email sent! Check inbox.");
      await logActivity("Forgot Password Request", `Password reset email sent to ${email}.`, profile);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth', // Redirect back to your auth page
      },
    });

    if (error) {
      showError(error.message);
      await logActivity("Google Sign-in Failed", `User failed to sign in with Google.`, profile, { error_message: error.message }, true);
    } else {
      // Supabase will redirect the user to Google for authentication,
      // then back to your redirectTo URL. The AuthContext's onAuthStateChange
      // listener will handle the session and subsequent navigation.
    }
    setLoading(false); // This might be reset prematurely if redirect happens quickly
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
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center p-4"
      style={{ backgroundImage: `url('/932271.jpg')` }}
    >
      <Card className="w-full max-w-md bg-black/20 backdrop-blur-lg border border-white/30 shadow-lg text-white">
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
            <span className="text-3xl font-bold text-white">Fortress</span>
          </div>
          <CardTitle className="text-3xl font-bold text-white">
            {isLogin ? "Welcome Back!" : "Join Fortress"}
          </CardTitle>
          <CardDescription className="text-white/80">
            {isLogin ? "Sign in to your account" : "Create a new account to get started"}
          </CardDescription>
          {selectedPlanFromUrl && !isLogin && (
            <p className="text-sm text-primary font-semibold mt-2">
              Signing up for: {selectedPlanFromUrl.charAt(0).toUpperCase() + selectedPlanFromUrl.slice(1)} Plan
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-black/20 border-white/30 text-white placeholder:text-white/70 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-black/20 border-white/30 text-white placeholder:text-white/70 focus:ring-primary focus:border-primary"
              />
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-white">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Your Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-black/20 border-white/30 text-white placeholder:text-white/70 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCode" className="text-white">Company Code (Optional)</Label>
                  <Input
                    id="companyCode"
                    type="text"
                    placeholder="Enter company code (e.g., FORTRESS123)"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="bg-black/20 border-white/30 text-white placeholder:text-white/70 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-xs text-white/70">
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
              <span className="w-full border-t border-white/30" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black/20 px-2 text-white/80">
                Or
              </span>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.24 10.285V14.4h6.83c-.25 1.48-1.08 2.42-2.08 3.16v3.18h2.45c1.78-1.64 2.82-3.9 2.82-6.72 0-.65-.07-1.3-.18-1.95H12.24z" fill="#4285F4"/>
                <path d="M12.24 21.6c3.24 0 5.93-1.08 7.91-2.96l-2.45-3.18c-.67.48-1.8.96-3.46.96-2.62 0-4.83-1.72-5.67-4.05H3.6v3.23c1.12 2.2 3.3 3.78 6.04 3.78h2.6z" fill="#34A853"/>
                <path d="M6.57 12.28c-.24-.6-.38-1.24-.38-1.92s.14-1.32.38-1.92V6.16H3.6c-.78 1.56-1.2 3.24-1.2 4.92s.42 3.36 1.2 4.92l2.97-2.6z" fill="#FBBC05"/>
                <path d="M12.24 5.8c1.48 0 2.76.48 3.78 1.3l2.1-2.08c-1.24-1.16-2.88-1.88-4.88-1.88-2.74 0-4.92 1.58-6.04 3.78l2.97 2.62c.84-2.32 3.05-4.04 5.67-4.04z" fill="#EA4335"/>
              </svg>
              Sign {isLogin ? "In" : "Up"} with Google
            </Button>
            <div className="text-center text-sm">
              {isLogin ? (
                <>
                  <span className="text-white/80">Don't have an account?{" "}</span>
                  <Button variant="link" onClick={() => setIsLogin(false)} className="p-0 h-auto text-primary hover:text-primary/80">
                    Sign Up
                  </Button>
                  <div className="mt-2">
                    <Button variant="link" onClick={handleForgotPassword} className="p-0 h-auto text-white/80 hover:text-primary" disabled={loading}>
                      Forgot Password?
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-white/80">Already have an account?{" "}</span>
                  <Button variant="link" onClick={() => setIsLogin(true)} className="p-0 h-auto text-primary hover:text-primary/80">
                    Sign In
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;