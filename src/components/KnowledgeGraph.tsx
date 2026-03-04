import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Link } from "@/types/links";

interface GraphNode {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

function buildGraph(links: Link[]) {
  const tagCount: Record<string, number> = {};
  const cooccurrence: Record<string, number> = {};

  for (const link of links) {
    const tags = link.tags || [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join("|||");
        cooccurrence[key] = (cooccurrence[key] || 0) + 1;
      }
    }
  }

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag]) => tag);

  const topSet = new Set(topTags);

  const nodes: GraphNode[] = topTags.map((tag, i) => {
    const angle = (2 * Math.PI * i) / topTags.length;
    const radius = 180;
    return {
      id: tag,
      label: tag,
      count: tagCount[tag],
      x: 300 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: 250 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    };
  });

  const edges: GraphEdge[] = [];
  for (const [key, weight] of Object.entries(cooccurrence)) {
    const [a, b] = key.split("|||");
    if (topSet.has(a) && topSet.has(b)) {
      edges.push({ source: a, target: b, weight });
    }
  }

  return { nodes, edges };
}

function useSimulation(
  initialNodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
) {
  const nodesRef = useRef<GraphNode[]>([]);
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const frameRef = useRef<number>(0);
  const iterRef = useRef(0);

  useEffect(() => {
    if (initialNodes.length === 0) return;

    nodesRef.current = initialNodes.map((n) => ({ ...n }));
    iterRef.current = 0;

    const cx = width / 2;
    const cy = height / 2;
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    const tick = () => {
      const nodes = nodesRef.current;
      const alpha = Math.max(0.01, 1 - iterRef.current / 200);

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (800 * alpha) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 100) * 0.01 * alpha * Math.min(edge.weight, 3);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Center gravity
      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.005 * alpha;
        node.vy += (cy - node.y) * 0.005 * alpha;
      }

      // Apply velocity
      for (const node of nodes) {
        node.vx *= 0.6;
        node.vy *= 0.6;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(40, Math.min(width - 40, node.x));
        node.y = Math.max(40, Math.min(height - 40, node.y));
      }

      setPositions(nodes.map((n) => ({ x: n.x, y: n.y })));
      iterRef.current++;

      if (iterRef.current < 250) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [initialNodes, edges, width, height]);

  return { nodes: initialNodes, positions };
}

interface KnowledgeGraphProps {
  links: Link[];
  isLoading: boolean;
}

export function KnowledgeGraph({ links, isLoading }: KnowledgeGraphProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDims({ w: width, h: Math.max(400, Math.min(width * 0.75, 600)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes: initialNodes, edges } = useMemo(
    () => buildGraph(links),
    [links]
  );

  const { nodes, positions } = useSimulation(
    initialNodes,
    edges,
    dims.w,
    dims.h
  );

  const maxCount = useMemo(
    () => Math.max(...initialNodes.map((n) => n.count), 1),
    [initialNodes]
  );
  const maxWeight = useMemo(
    () => Math.max(...edges.map((e) => e.weight), 1),
    [edges]
  );

  const connectedTags = useMemo(() => {
    if (!selectedTag) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedTag) set.add(e.target);
      if (e.target === selectedTag) set.add(e.source);
    }
    return set;
  }, [selectedTag, edges]);

  const getNodePos = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx === -1 || !positions[idx]) return { x: 0, y: 0 };
      return positions[idx];
    },
    [nodes, positions]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (initialNodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tags found. Add tags to your links to see the knowledge graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="w-full">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <svg
              width={dims.w}
              height={dims.h}
              className="bg-muted/30"
              onClick={() => setSelectedTag(null)}
            >
              {/* Edges */}
              {edges.map((edge) => {
                const s = getNodePos(edge.source);
                const t = getNodePos(edge.target);
                const isHighlighted =
                  selectedTag &&
                  (edge.source === selectedTag || edge.target === selectedTag);
                const isDimmed = selectedTag && !isHighlighted;
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={
                      isHighlighted
                        ? "hsl(var(--primary))"
                        : "hsl(var(--border))"
                    }
                    strokeWidth={Math.max(
                      1,
                      (edge.weight / maxWeight) * 3
                    )}
                    strokeOpacity={isDimmed ? 0.15 : isHighlighted ? 0.9 : 0.4}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node, idx) => {
                const pos = positions[idx] || { x: node.x, y: node.y };
                const r = 8 + (node.count / maxCount) * 18;
                const isSelected = selectedTag === node.id;
                const isConnected = connectedTags.has(node.id);
                const isDimmed =
                  selectedTag && !isSelected && !isConnected;

                return (
                  <g
                    key={node.id}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTag(
                        selectedTag === node.id ? null : node.id
                      );
                    }}
                    opacity={isDimmed ? 0.25 : 1}
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={
                        isSelected
                          ? "hsl(var(--primary))"
                          : isConnected
                          ? "hsl(var(--primary) / 0.6)"
                          : "hsl(var(--primary) / 0.3)"
                      }
                      stroke={
                        isSelected
                          ? "hsl(var(--primary))"
                          : "hsl(var(--border))"
                      }
                      strokeWidth={isSelected ? 2.5 : 1}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + r + 12}
                      textAnchor="middle"
                      fontSize={11}
                      fill="hsl(var(--foreground))"
                      fontWeight={isSelected ? 600 : 400}
                      className="select-none pointer-events-none"
                    >
                      {node.label}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="hsl(var(--primary-foreground))"
                      className="select-none pointer-events-none"
                    >
                      {node.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>
      </div>

      {selectedTag && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">
              Connected to <Badge variant="default">{selectedTag}</Badge>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(connectedTags).map((tag) => {
                const edge = edges.find(
                  (e) =>
                    (e.source === selectedTag && e.target === tag) ||
                    (e.target === selectedTag && e.source === tag)
                );
                return (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                    {edge && (
                      <span className="ml-1 text-muted-foreground">
                        ({edge.weight})
                      </span>
                    )}
                  </Badge>
                );
              })}
              {connectedTags.size === 0 && (
                <span className="text-xs text-muted-foreground">
                  No connected tags
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
