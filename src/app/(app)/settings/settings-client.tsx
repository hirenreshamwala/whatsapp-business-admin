"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, CheckCircle2, XCircle, RefreshCw, Save } from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Settings = {
  wabaId: string;
  metaAppId: string;
  phoneNumberId: string;
  phoneNumberDisplay: string;
  businessName: string;
  apiVersion: string;
  webhookVerifyToken: string;
  accessTokenSet: boolean;
  accessTokenMasked: string;
  appSecretSet: boolean;
  callbackUrl: string;
  connected: boolean;
};

export function SettingsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiFetch<Settings>("/api/settings") });

  const [form, setForm] = useState({
    wabaId: "",
    metaAppId: "",
    phoneNumberId: "",
    apiVersion: "v21.0",
    webhookVerifyToken: "",
    accessToken: "",
    appSecret: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        wabaId: data.wabaId,
        metaAppId: data.metaAppId,
        phoneNumberId: data.phoneNumberId,
        apiVersion: data.apiVersion,
        webhookVerifyToken: data.webhookVerifyToken,
      }));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      setForm((f) => ({ ...f, accessToken: "", appSecret: "" }));
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Save failed", description: e.message }),
  });

  const test = useMutation({
    mutationFn: () => apiFetch<{ success: boolean; message?: string; verifiedName?: string }>("/api/settings/test", { method: "POST" }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.success) {
        toast({ title: "Connected", description: r.verifiedName });
        qc.invalidateQueries({ queryKey: ["settings"] });
      }
    },
    onError: (e: Error) => setTestResult({ success: false, message: e.message }),
  });

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Connect your WhatsApp Business Cloud API account."
        actions={
          data?.connected ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {data.phoneNumberDisplay || "Connected"}
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cloud API credentials</CardTitle>
            <CardDescription>
              Find these in Meta Business Manager → WhatsApp → API Setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp Business Account (WABA) ID">
              <Input value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} placeholder="1234567890" />
            </Field>
            <Field label="Phone Number ID">
              <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="1234567890" />
            </Field>
            <Field label="Graph API version">
              <Input value={form.apiVersion} onChange={(e) => setForm({ ...form, apiVersion: e.target.value })} placeholder="v21.0" />
            </Field>
            <Field label="Meta App ID (for media-header templates)">
              <Input value={form.metaAppId} onChange={(e) => setForm({ ...form, metaAppId: e.target.value })} placeholder="Optional — needed to upload image/video/doc header samples" />
            </Field>
            <Field
              label={`Access Token ${data?.accessTokenSet ? `(saved: ${data.accessTokenMasked})` : ""}`}
            >
              <Input
                type="password"
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                placeholder={data?.accessTokenSet ? "•••• leave blank to keep" : "Permanent access token"}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Webhook</CardTitle>
            <CardDescription>
              In Meta → WhatsApp → Configuration, set this Callback URL and Verify Token, then
              subscribe to the <span className="font-medium">messages</span> field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Callback URL">
              <div className="flex gap-2">
                <Input readOnly value={data?.callbackUrl || ""} className="font-mono text-xs" />
                <Button variant="outline" size="icon" type="button" onClick={() => copy(data?.callbackUrl || "")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Verify Token (leave blank to auto-generate)">
                <div className="flex gap-2">
                  <Input
                    value={form.webhookVerifyToken}
                    onChange={(e) => setForm({ ...form, webhookVerifyToken: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" type="button" onClick={() => copy(form.webhookVerifyToken)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
              <Field label={`App Secret ${data?.appSecretSet ? "(saved)" : ""} — used to verify signatures`}>
                <Input
                  type="password"
                  value={form.appSecret}
                  onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                  placeholder={data?.appSecretSet ? "•••• leave blank to keep" : "Meta App Secret"}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> Save settings
          </Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
            <RefreshCw className={`h-4 w-4 ${test.isPending ? "animate-spin" : ""}`} /> Test connection
          </Button>
          {testResult && (
            <span className={`flex items-center gap-1 text-xs ${testResult.success ? "text-emerald-600" : "text-destructive"}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.success ? "Connection OK" : testResult.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
