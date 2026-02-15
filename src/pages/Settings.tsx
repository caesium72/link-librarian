import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Settings = () => {
  const { user, loading: authLoading } = useRequireAuth();
  const { toast } = useToast();

  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [webhookSet, setWebhookSet] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    const { data } = await supabase
      .from("user_settings")
      .select("telegram_bot_token, telegram_webhook_set")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      if (data.telegram_bot_token) {
        setBotToken(data.telegram_bot_token);
        setHasToken(true);
      }
      setWebhookSet(data.telegram_webhook_set ?? false);
    }
    setLoadingSettings(false);
  };

  const handleSaveToken = async () => {
    if (!botToken.trim()) {
      toast({ title: "Please enter a bot token", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upsert settings
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: user!.id, telegram_bot_token: botToken.trim(), telegram_webhook_set: false },
          { onConflict: "user_id" }
        );

      if (error) throw error;
      setHasToken(true);
      setWebhookSet(false);
      toast({ title: "Bot token saved!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetupWebhook = async () => {
    setSettingUpWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-telegram", {
        body: { userId: user!.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to set webhook");

      // Update settings
      await supabase
        .from("user_settings")
        .update({ telegram_webhook_set: true })
        .eq("user_id", user!.id);

      setWebhookSet(true);
      toast({ title: "Webhook set!", description: "Your bot is now connected. Add it to your group/channel and start pasting links!" });
    } catch (e: any) {
      toast({ title: "Webhook setup failed", description: e.message, variant: "destructive" });
    } finally {
      setSettingUpWebhook(false);
    }
  };

  if (authLoading || loadingSettings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center h-12 px-4 gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-mono text-sm font-semibold">Settings</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-base">
              <Bot className="h-4 w-4" />
              Telegram Bot Setup
            </CardTitle>
            <CardDescription className="text-sm">
              Connect your Telegram bot to automatically capture links from your channels and groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <Label className="font-mono text-sm">Create a Telegram Bot</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Open Telegram, search for <strong>@BotFather</strong>, send <code>/newbot</code>, and follow the instructions. Copy the bot token it gives you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <Label className="font-mono text-sm">Paste your Bot Token</Label>
              </div>
              <div className="ml-8 space-y-2">
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveToken}
                  disabled={saving || !botToken.trim()}
                  size="sm"
                  className="font-mono"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Save Token
                </Button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <Label className="font-mono text-sm">Activate Webhook</Label>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  This tells Telegram to send messages from your bot to Link Librarian.
                </p>
                {webhookSet ? (
                  <div className="flex items-center gap-2 text-sm text-primary font-mono">
                    <CheckCircle2 className="h-4 w-4" />
                    Webhook active
                  </div>
                ) : (
                  <Button
                    onClick={handleSetupWebhook}
                    disabled={settingUpWebhook || !hasToken}
                    size="sm"
                    variant="outline"
                    className="font-mono"
                  >
                    {settingUpWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Activate Webhook
                  </Button>
                )}
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <Label className="font-mono text-sm">Add Bot to your Group/Channel</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Add your bot as an <strong>admin</strong> to the Telegram group or channel where you paste links. It needs admin rights to read messages. Then just paste any link in the chat — it'll appear in your dashboard!
              </p>
            </div>

            {/* Status */}
            {hasToken && (
              <div className={`p-3 rounded-lg border text-sm font-mono ${webhookSet ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                {webhookSet ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    All set! Links you paste in Telegram will appear in your dashboard.
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Token saved. Activate the webhook to start receiving links.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
