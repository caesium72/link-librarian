import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

const shortcuts = [
  { key: "/", description: "Focus search" },
  { key: "j / ↓", description: "Next link" },
  { key: "k / ↑", description: "Previous link" },
  { key: "o / Enter", description: "Open selected link" },
  { key: "v", description: "Toggle grid/list view" },
  { key: "Esc", description: "Close detail / unfocus" },
];

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Keyboard className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">{s.key}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
