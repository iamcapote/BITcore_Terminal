/**
 * Why: Vector store management panel for browsing, querying, and administering embedding indices.
 * What: Table + card grid showing vector store status, dimensions, and backend metadata.
 * How: Renders mock vectorStores data; actions are declarative stubs awaiting backend wiring.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { vectorStores } from "@/modules/data/mockWorkspace";
import {
  BookOpen,
  ClipboardList,
  Layers,
  Plus,
  RefreshCw,
} from "lucide-react";

export function VectorManagerSurface() {
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" /> Vector Stores
          <Badge variant="outline" className="ml-auto border-amber-500/40 text-[9px] uppercase text-amber-400"><Construction className="mr-1 h-3 w-3" />preview</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-2.5rem)] min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Index
          </Button>
          <Button size="sm" variant="secondary">
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backends</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
                <SelectItem value="faiss">FAISS</SelectItem>
                <SelectItem value="chroma">Chroma</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-40" />
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {vectorStores.map((store) => (
            <div
              key={store.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-300" />
                <div className="text-sm">
                  <div className="font-medium leading-tight">{store.index}</div>
                  <div className="text-xs text-muted-foreground">
                    {store.backend} · {store.dimension}-d · {store.size.toLocaleString()} vectors
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {store.status}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Sync ${store.index}`}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sync embeddings</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Inspect ${store.index}`}>
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open details</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Index</TableHead>
                <TableHead>Backend</TableHead>
                <TableHead>Dim</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vectorStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.index}</TableCell>
                  <TableCell>{store.backend}</TableCell>
                  <TableCell>{store.dimension}</TableCell>
                  <TableCell>{store.size.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={store.status === "Ready" ? "default" : "secondary"}>
                      {store.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Inspect</DropdownMenuItem>
                        <DropdownMenuItem>Search Similar</DropdownMenuItem>
                        <DropdownMenuItem>Rebuild</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
