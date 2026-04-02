/**
 * Why: Database connection management and query runner panel.
 * What: Two-pane layout showing active connections with a SQL query editor and result preview.
 * How: Renders mock databaseConnections; query actions are declarative stubs awaiting backend wiring.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { databaseConnections } from "@/modules/data/mockWorkspace";
import {
  BrainCircuit,
  Database,
  Download,
  Play,
  Plus,
  RefreshCw,
} from "lucide-react";

export function DatabaseManagerSurface() {
  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" /> Databases
          <Badge variant="outline" className="ml-auto border-amber-500/40 text-[9px] uppercase text-amber-400"><Construction className="mr-1 h-3 w-3" />preview</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Connect
          </Button>
          <Button size="sm" variant="secondary">
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select defaultValue="postgres">
              <SelectTrigger className="h-8 w-32 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">Postgres</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="duckdb">DuckDB</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-28 sm:w-40" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="py-2">
              <CardTitle className="text-xs">Connections</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 min-w-0 flex-1 p-0">
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Tables</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {databaseConnections.map((db) => (
                      <TableRow key={db.id}>
                        <TableCell className="font-medium">{db.name}</TableCell>
                        <TableCell>{db.engine}</TableCell>
                        <TableCell>{db.tables}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label={`Run query on ${db.name}`}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Run query</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label={`Export ${db.name} schema`}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Export schema</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-xs">Query</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea className="min-h-[120px]" placeholder="SELECT * FROM table LIMIT 50;" />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm">
                  <Play className="mr-1 h-4 w-4" /> Run
                </Button>
                <Button size="sm" variant="secondary">
                  <Download className="mr-1 h-4 w-4" /> Save
                </Button>
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <BrainCircuit className="h-3 w-3" /> Est. cost: 3 RU
                </div>
              </div>
              <Separator className="my-3" />
              <div className="rounded-md border p-3 text-sm">Result preview here</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
