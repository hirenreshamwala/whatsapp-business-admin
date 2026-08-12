"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone } from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type Broadcast = {
  id: string;
  name: string;
  templateName: string;
  status: "DRAFT" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  total: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};

const STATUS_VARIANT: Record<Broadcast["status"], BadgeProps["variant"]> = {
  DRAFT: "secondary",
  QUEUED: "warning",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
};

export function BroadcastsClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: broadcasts = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => apiFetch<Broadcast[]>("/api/broadcasts"),
    refetchInterval: 4000,
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Broadcasts"
        description="Send an approved template to many contacts at once."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> New broadcast
              </Button>
            </DialogTrigger>
            <NewBroadcastDialog onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["broadcasts"] })} />
          </Dialog>
        }
      />

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Template</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-56">Progress</TableHead>
                <TableHead className="w-40">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Megaphone className="mx-auto mb-1 h-6 w-6 opacity-40" />
                    No broadcasts yet.
                  </TableCell>
                </TableRow>
              )}
              {broadcasts.map((b) => {
                const done = b.sentCount + b.failedCount;
                const pct = b.total ? Math.round((done / b.total) * 100) : 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell data-label="Name" className="font-medium">{b.name}</TableCell>
                    <TableCell data-label="Template" className="text-xs text-muted-foreground">{b.templateName}</TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                    </TableCell>
                    <TableCell data-label="Progress">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {b.sentCount}✓ {b.failedCount > 0 && <span className="text-destructive">{b.failedCount}✗</span>} / {b.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell data-label="Created" className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

type ApprovedTemplate = { id: string; name: string; language: string; status: string };

function NewBroadcastDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "tag">("all");
  const [tag, setTag] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["templates", "approved"],
    queryFn: () => apiFetch<ApprovedTemplate[]>("/api/templates?approved=true"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ total: number }>("/api/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          name,
          templateId,
          audience: audienceType === "all" ? { type: "all" } : { type: "tag", tag },
        }),
      }),
    onSuccess: (r) => {
      toast({ title: `Broadcast started`, description: `${r.total} recipients queued.` });
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not start", description: e.message }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New broadcast</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Campaign name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali sale" />
        </div>
        <div className="space-y-1">
          <Label>Approved template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder={templates.length ? "Choose a template" : "No approved templates"} />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Audience</Label>
          <Select value={audienceType} onValueChange={(v) => setAudienceType(v as "all" | "tag")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contacts</SelectItem>
              <SelectItem value="tag">Contacts with a tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {audienceType === "tag" && (
          <div className="space-y-1">
            <Label>Tag</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="vip" />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Messages send using the template’s sample values. Delivery status updates live from webhooks.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!name || !templateId || (audienceType === "tag" && !tag) || create.isPending}
          onClick={() => create.mutate()}
        >
          Start broadcast
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
