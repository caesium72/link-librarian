import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { addLink } from "@/lib/api/links";
import { useToast } from "@/hooks/use-toast";

interface AddLinkInputProps {
  onSuccess: () => void;
}

export function AddLinkInput({ onSuccess }: AddLinkInputProps) {
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = url.trim();
    if (!trimmed) return;

    // Auto-add https:// if it looks like a domain but has no protocol
    if (!/^https?:\/\//i.test(trimmed) && /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL (e.g. example.com).", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      await addLink(trimmed);
      setUrl("");
      toast({ title: "Link added", description: "Analysis will start shortly." });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Paste a URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="font-mono text-sm h-9"
        disabled={isAdding}
      />
      <Button type="submit" size="sm" className="h-9 shrink-0" disabled={isAdding || !url.trim()}>
        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
    </form>
  );
}
