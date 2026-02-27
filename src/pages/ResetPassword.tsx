import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Check hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-mono">Invalid Link</CardTitle>
            <CardDescription>This password reset link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full font-mono">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-chart-2/5 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <Card className="w-full max-w-md animate-slide-up relative backdrop-blur-sm bg-card/95 shadow-xl border-border/50">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <img src={logo} alt="Xenonowledge" className="h-8 w-8" />
            <CardTitle className="text-2xl font-mono tracking-tight">Reset Password</CardTitle>
          </div>
          <CardDescription className="text-sm">
            {success ? "Password updated successfully!" : "Enter your new password below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
              <CheckCircle className="h-12 w-12 text-primary animate-scale-in" />
              <p className="text-sm text-muted-foreground font-mono">Redirecting you now...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5 text-xs font-mono">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-10 transition-all duration-200 focus:shadow-sm focus:shadow-primary/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-1.5 text-xs font-mono">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-10 transition-all duration-200 focus:shadow-sm focus:shadow-primary/10"
                />
              </div>
              <Button type="submit" className="w-full font-mono h-11 gap-2 group" disabled={loading}>
                {loading ? (
                  <span className="animate-pulse">Updating...</span>
                ) : (
                  <>
                    Update Password
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
