"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ApiLog = {
  id: string;
  method: string;
  endpoint: string;
  requestBody: unknown;
  responseStatus: number | null;
  responseBody: unknown;
  ok: boolean;
  durationMs: number | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

type WebhookEvent = {
  id: string;
  payload: unknown;
  signatureValid: boolean;
  processedOk: boolean;
  eventSummary: string | null;
  error: string | null;
  createdAt: string;
};

type Feed<T> = { type: string; items: T[]; total: number; page: number; pageSize: number };

export function LogsClient() {
  const [tab, setTab] = useState<"api" | "webhook">("api");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ title: string; body: unknown } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["logs", tab, page],
    queryFn: () => apiFetch<Feed<ApiLog | WebhookEvent>>(`/api/logs?type=${tab}&page=${page}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Logs"
        description="Every outbound API call and inbound webhook, stored in full."
        actions={
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "api" | "webhook");
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="api">API calls</TabsTrigger>
              <TabsTrigger value="webhook">Webhooks</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="flex-1 p-3 sm:p-4">
        <div className="rounded-lg border">
          {tab === "api" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Time</TableHead>
                  <TableHead className="w-16">Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-20">Duration</TableHead>
                  <TableHead className="w-24">Related</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <Empty cols={6} text="Loading…" />}
                {!isLoading && data?.items.length === 0 && <Empty cols={6} text="No API calls yet." />}
                {(data?.items as ApiLog[] | undefined)?.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setDetail({ title: `${log.method} ${log.endpoint}`, body: { request: log.requestBody, response: log.responseBody } })}
                  >
                    <TableCell data-label="Time" className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell data-label="Method"><Badge variant="outline">{log.method}</Badge></TableCell>
                    <TableCell data-label="Endpoint" className="max-w-0 break-all font-mono text-xs md:truncate">{log.endpoint}</TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={log.ok ? "success" : "destructive"}>{log.responseStatus ?? "—"}</Badge>
                    </TableCell>
                    <TableCell data-label="Duration" className="text-xs text-muted-foreground">{log.durationMs ?? "—"} ms</TableCell>
                    <TableCell data-label="Related" className="text-xs text-muted-foreground">{log.relatedType ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Time</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-24">Signature</TableHead>
                  <TableHead className="w-24">Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <Empty cols={4} text="Loading…" />}
                {!isLoading && data?.items.length === 0 && <Empty cols={4} text="No webhooks received yet." />}
                {(data?.items as WebhookEvent[] | undefined)?.map((ev) => (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer"
                    onClick={() => setDetail({ title: "Webhook payload", body: ev.payload })}
                  >
                    <TableCell data-label="Time" className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(ev.createdAt)}</TableCell>
                    <TableCell data-label="Summary" className="text-xs">{ev.eventSummary || ev.error || "—"}</TableCell>
                    <TableCell data-label="Signature">
                      <Badge variant={ev.signatureValid ? "success" : "warning"}>{ev.signatureValid ? "valid" : "unverified"}</Badge>
                    </TableCell>
                    <TableCell data-label="Processed">
                      <Badge variant={ev.processedOk ? "success" : "destructive"}>{ev.processedOk ? "ok" : "error"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{data?.total ?? 0} total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono text-xs">{detail.title}</DialogTitle>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto scroll-thin rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(detail.body, null, 2)}
            </pre>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
