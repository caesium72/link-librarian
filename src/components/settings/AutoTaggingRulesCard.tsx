import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tags, Plus, Trash2, Loader2 } from "lucide-react";

interface TaggingRule {
  id: string;
  condition_type: string;
  condition_value: string;
  tag: string;
  is_active: boolean;
}

const CONDITION_LABELS: Record<string, string> = {
  domain_contains: "Domain contains",
  domain_equals: "Domain equals",
  url_contains: "URL contains",
  title_contains: "Title contains",
};

export function AutoTaggingRulesCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<TaggingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New rule form
  const [conditionType, setConditionType] = useState("domain_contains");
  const [conditionValue, setConditionValue] = useState("");
  const [tag, setTag] = useState("");

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tagging_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setRules(data as TaggingRule[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, [userId]);

  const handleAddRule = async () => {
    if (!conditionValue.trim() || !tag.trim()) {
      toast({ title: "Fill in both fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tagging_rules").insert({
      user_id: userId,
      condition_type: conditionType,
      condition_value: conditionValue.trim().toLowerCase(),
      tag: tag.trim().toLowerCase(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setConditionValue("");
      setTag("");
      toast({ title: "Rule added!" });
      fetchRules();
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("tagging_rules").update({ is_active: !isActive }).eq("id", id);
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !isActive } : r)));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tagging_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Rule deleted" });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-base">
          <Tags className="h-4 w-4" />
          Auto-Tagging Rules
        </CardTitle>
        <CardDescription className="text-sm">
          Automatically tag new links based on conditions. Rules apply when links are analyzed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new rule */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-shrink-0">
              <Select value={conditionType} onValueChange={setConditionType}>
                <SelectTrigger className="w-[160px] font-mono text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="font-mono text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="e.g. github.com"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              className="font-mono text-sm h-9 flex-1 min-w-[120px]"
            />
            <span className="text-xs text-muted-foreground font-mono">→ tag:</span>
            <Input
              placeholder="e.g. dev"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="font-mono text-sm h-9 w-[100px]"
            />
            <Button
              size="sm"
              onClick={handleAddRule}
              disabled={saving || !conditionValue.trim() || !tag.trim()}
              className="font-mono gap-1.5 h-9"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
        </div>

        {/* Rules list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono text-center py-3">
            No rules yet. Add one above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  rule.is_active ? "border-border" : "border-border/50 opacity-60"
                }`}
              >
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={() => handleToggle(rule.id, rule.is_active)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">
                    <span className="text-muted-foreground">
                      {CONDITION_LABELS[rule.condition_type] || rule.condition_type}
                    </span>{" "}
                    <span className="font-medium">{rule.condition_value}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">→</span>
                <Badge variant="secondary" className="font-mono text-xs shrink-0">
                  {rule.tag}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
