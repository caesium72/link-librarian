import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { addLink } from "@/lib/api/links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Search, Sparkles, ExternalLink, Plus, RefreshCw,
  Bot, Code, Zap, Github, Box, Cloud,
} from "lucide-react";

interface DiscoveredTool {
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  ai: <Bot className="h-4 w-4" />,
  "dev-tool": <Code className="h-4 w-4" />,
  productivity: <Zap className="h-4 w-4" />,
  "open-source": <Github className="h-4 w-4" />,
  framework: <Box className="h-4 w-4" />,
  saas: <Cloud className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  ai: "bg-primary/10 text-primary",
  "dev-tool": "bg-chart-2/20 text-chart-2",
  productivity: "bg-chart-4/20 text-chart-4",
  "open-source": "bg-chart-3/20 text-chart-3",
  framework: "bg-chart-5/20 text-chart-5",
  saas: "bg-chart-1/20 text-chart-1",
};

export default function Discover() {
  const { user, loading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [hasSearched, setHasSearched] = useState(false);

  const discover = async (cat: string) => {
    setIsLoading(true);
    setCategory(cat);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-tools", {
        body: { category: cat },
      });
      if (error) throw error;
      if (data?.tools) {
        setTools(data.tools);
      } else {
        throw new Error(data?.error || "No tools returned");
      }
    } catch (e: any) {
      toast({ title: "Discovery failed", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveToLibrary = async (tool: DiscoveredTool) => {
    setSavingUrl(tool.url);
    try {
      await addLink(tool.url);
      toast({ title: "Saved!", description: `${tool.name} added to your library.` });
    } catch (e: any) {
      if (e.message === "DUPLICATE") {
        toast({ title: "Already saved", description: `${tool.name} is already in your library.` });
      } else {
        toast({ title: "Save failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setSavingUrl(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Sparkles className="h-6 w-6 animate-pulse text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-3">
            <RouterLink to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </RouterLink>
            <div className="flex items-center gap-2">
              <img src={logo} alt="Xenonowledge" className="h-5 w-5" />
              <h1 className="font-mono text-sm font-semibold">Discover</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-mono uppercase tracking-wider">AI-Powered Research</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Discover New AI & Tech Tools</h2>
          <p className="text-sm text-muted-foreground">Let AI research the latest tools and save them to your library with one click.</p>
        </div>

        {/* Category tabs */}
        <Tabs defaultValue="all" onValueChange={(v) => discover(v)} className="mb-6">
          <TabsList className="grid w-full grid-cols-5 h-9">
            <TabsTrigger value="all" className="text-xs font-mono">All</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs font-mono">AI</TabsTrigger>
            <TabsTrigger value="dev" className="text-xs font-mono">Dev Tools</TabsTrigger>
            <TabsTrigger value="productivity" className="text-xs font-mono">Productivity</TabsTrigger>
            <TabsTrigger value="opensource" className="text-xs font-mono">Open Source</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Refresh */}
        {hasSearched && !isLoading && (
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono" onClick={() => discover(category)}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-full" />
                      <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasSearched && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Click a category above to discover the latest tools</p>
              <Button onClick={() => discover("all")} className="gap-1.5">
                <Sparkles className="h-4 w-4" /> Start Discovering
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!isLoading && tools.length > 0 && (
          <div className="grid gap-3">
            {tools.map((tool, i) => (
              <Card key={i} className="group hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${categoryColors[tool.category] || "bg-muted text-muted-foreground"}`}>
                      {categoryIcons[tool.category] || <Box className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{tool.name}</h3>
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary truncate block font-mono">
                            {tool.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            <ExternalLink className="inline h-2.5 w-2.5 ml-1" />
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 text-xs font-mono gap-1"
                          disabled={savingUrl === tool.url}
                          onClick={() => saveToLibrary(tool)}
                        >
                          <Plus className="h-3 w-3" />
                          {savingUrl === tool.url ? "Saving..." : "Save"}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {tool.category}
                        </Badge>
                        {tool.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] font-mono">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
