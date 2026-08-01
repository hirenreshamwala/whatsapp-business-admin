"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  Megaphone,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import {
  type TemplateBuilder,
  type BuilderButton,
  type HeaderType,
  emptyBuilder,
  variableNumbers,
} from "@/lib/whatsapp/template-types";
import { validateTemplate, type FieldError } from "@/lib/whatsapp/template-validate";
import { TEMPLATE_LANGUAGES } from "@/lib/whatsapp/languages";
import { TemplatePreview } from "@/components/whatsapp/template-preview";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const STEPS = ["Basics", "Header", "Body", "Footer", "Buttons", "Review"];

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing", icon: Megaphone, help: "Promotions, offers, announcements, newsletters." },
  { value: "UTILITY", label: "Utility", icon: Bell, help: "Order updates, reminders, alerts tied to a transaction." },
  { value: "AUTHENTICATION", label: "Authentication", icon: ShieldCheck, help: "One-time passcodes and verification." },
] as const;

export function TemplateWizard({ initial, templateId }: { initial?: TemplateBuilder; templateId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [builder, setBuilder] = useState<TemplateBuilder>(initial ?? emptyBuilder());

  const errors = useMemo(() => validateTemplate(builder), [builder]);
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;
  const set = (patch: Partial<TemplateBuilder>) => setBuilder((b) => ({ ...b, ...patch }));

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      const url = templateId ? `/api/templates/${templateId}` : "/api/templates";
      const method = templateId ? "PATCH" : "POST";
      return apiFetch(url, { method, body: JSON.stringify({ builder, submit }) });
    },
    onSuccess: (_d, submit) => {
      toast({ title: submit ? "Submitted to Meta for approval" : "Template saved as draft" });
      router.push("/templates");
      router.refresh();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not save", description: e.message }),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={templateId ? "Edit template" : "New template"}
        description="Build your message step by step. The preview on the right updates live."
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.push("/templates")}>
            Cancel
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Left: stepper + form */}
        <div className="flex min-h-0 flex-col border-r">
          <Stepper step={step} onStep={setStep} />
          <div className="min-h-0 flex-1 overflow-auto scroll-thin p-4">
            {step === 0 && <BasicsStep builder={builder} set={set} errorFor={errorFor} />}
            {step === 1 && <HeaderStep builder={builder} set={set} errorFor={errorFor} />}
            {step === 2 && <BodyStep builder={builder} set={set} errorFor={errorFor} />}
            {step === 3 && <FooterStep builder={builder} set={set} errorFor={errorFor} />}
            {step === 4 && <ButtonsStep builder={builder} set={set} errors={errors} />}
            {step === 5 && <ReviewStep errors={errors} />}
          </div>

          <div className="flex items-center justify-between border-t p-3">
            <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate(false)}>
                  Save draft
                </Button>
                <Button size="sm" disabled={errors.length > 0 || save.isPending} onClick={() => save.mutate(true)}>
                  Submit for approval
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="hidden min-h-0 flex-col bg-muted/30 p-3 lg:flex">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Live preview</div>
          <div className="min-h-0 flex-1">
            <TemplatePreview builder={builder} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 border-b bg-card px-4 py-2 text-xs">
      {STEPS.map((label, i) => (
        <button
          key={label}
          onClick={() => onStep(i)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors",
            i === step ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
              i < step ? "bg-primary text-primary-foreground" : i === step ? "border border-primary" : "border",
            )}
          >
            {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

type StepProps = {
  builder: TemplateBuilder;
  set: (patch: Partial<TemplateBuilder>) => void;
  errorFor: (field: string) => string | undefined;
};

function ErrorLine({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" /> {msg}
    </p>
  );
}

function BasicsStep({ builder, set, errorFor }: StepProps) {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Label className="mb-1.5 block">What kind of message is this?</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = builder.category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => set({ category: c.value })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:border-primary/40",
                )}
              >
                <Icon className={cn("mb-1 h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-[11px] text-muted-foreground">{c.help}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Template name</Label>
        <Input
          value={builder.name}
          onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
          placeholder="order_confirmation"
        />
        <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers and underscores only.</p>
        <ErrorLine msg={errorFor("name")} />
      </div>

      <div className="space-y-1">
        <Label>Language</Label>
        <Select value={builder.language} onValueChange={(v) => set({ language: v })}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label} ({l.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function HeaderStep({ builder, set, errorFor }: StepProps) {
  const types: { value: HeaderType; label: string }[] = [
    { value: "NONE", label: "None" },
    { value: "TEXT", label: "Text" },
    { value: "IMAGE", label: "Image" },
    { value: "VIDEO", label: "Video" },
    { value: "DOCUMENT", label: "Document" },
  ];
  const setHeader = (patch: Partial<TemplateBuilder["header"]>) => set({ header: { ...builder.header, ...patch } });
  const headerVars = variableNumbers(builder.header.text ?? "");

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Label className="mb-1.5 block">Header (optional)</Label>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setHeader({ type: t.value })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium",
                builder.header.type === t.value ? "border-primary bg-primary/5 text-primary" : "hover:border-primary/40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {builder.header.type === "TEXT" && (
        <>
          <div className="space-y-1">
            <Label>Header text</Label>
            <Input
              value={builder.header.text ?? ""}
              onChange={(e) => setHeader({ text: e.target.value })}
              maxLength={60}
              placeholder="Order {{1}} confirmed"
            />
            <p className="text-[11px] text-muted-foreground">Up to 60 characters, at most one variable.</p>
          </div>
          {headerVars.length === 1 && (
            <div className="space-y-1">
              <Label>Sample value for {"{{1}}"}</Label>
              <Input
                value={builder.header.textExample ?? ""}
                onChange={(e) => setHeader({ textExample: e.target.value })}
                placeholder="#A1234"
              />
            </div>
          )}
        </>
      )}

      {["IMAGE", "VIDEO", "DOCUMENT"].includes(builder.header.type) && <MediaUpload builder={builder} setHeader={setHeader} />}

      <ErrorLine msg={errorFor("header")} />
    </div>
  );
}

function MediaUpload({
  builder,
  setHeader,
}: {
  builder: TemplateBuilder;
  setHeader: (patch: Partial<TemplateBuilder["header"]>) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/templates/upload-sample", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setHeader({ mediaHandle: data.handle, mediaFilename: data.filename });
      toast({ title: "Sample uploaded" });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const accept =
    builder.header.type === "IMAGE" ? "image/*" : builder.header.type === "VIDEO" ? "video/*" : ".pdf";

  return (
    <div className="space-y-1">
      <Label>Sample {builder.header.type.toLowerCase()} (Meta requires a sample to review)</Label>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground hover:border-primary/40">
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : builder.header.mediaFilename ? `Uploaded: ${builder.header.mediaFilename}` : "Choose a file"}
        <input type="file" accept={accept} className="hidden" onChange={onFile} disabled={uploading} />
      </label>
    </div>
  );
}

function BodyStep({ builder, set, errorFor }: StepProps) {
  const vars = variableNumbers(builder.body.text);
  const setBody = (patch: Partial<TemplateBuilder["body"]>) => set({ body: { ...builder.body, ...patch } });

  function insertVariable() {
    const next = vars.length + 1;
    setBody({ text: `${builder.body.text}{{${next}}}` });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Message body</Label>
          <Button variant="outline" size="sm" onClick={insertVariable}>
            <Plus className="h-3.5 w-3.5" /> Insert variable
          </Button>
        </div>
        <Textarea
          value={builder.body.text}
          onChange={(e) => setBody({ text: e.target.value })}
          rows={6}
          maxLength={1024}
          placeholder={"Hi {{1}}, your order {{2}} has shipped and will arrive by {{3}}."}
        />
        <p className="text-[11px] text-muted-foreground">
          Use *bold*, _italic_, ~strike~. Add variables like {"{{1}}"} for personalised values.
        </p>
        <ErrorLine msg={errorFor("body")} />
      </div>

      {vars.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <Label>Sample values (used for preview and Meta review)</Label>
          {vars.map((n, i) => (
            <div key={n} className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">{`{{${n}}}`}</Badge>
              <Input
                value={builder.body.examples[i] ?? ""}
                onChange={(e) => {
                  const examples = [...builder.body.examples];
                  examples[i] = e.target.value;
                  setBody({ examples });
                }}
                placeholder={`Example for {{${n}}}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FooterStep({ builder, set, errorFor }: StepProps) {
  return (
    <div className="max-w-xl space-y-1">
      <Label>Footer (optional)</Label>
      <Input
        value={builder.footer.text ?? ""}
        onChange={(e) => set({ footer: { text: e.target.value } })}
        maxLength={60}
        placeholder="Reply STOP to unsubscribe"
      />
      <p className="text-[11px] text-muted-foreground">Up to 60 characters. No variables.</p>
      <ErrorLine msg={errorFor("footer")} />
    </div>
  );
}

function ButtonsStep({
  builder,
  set,
  errors,
}: {
  builder: TemplateBuilder;
  set: (patch: Partial<TemplateBuilder>) => void;
  errors: FieldError[];
}) {
  const { data: publishedFlows = [] } = useQuery({ queryKey: ["flows", "published"], queryFn: () => apiFetch<{ id: string; name: string; activeVersion: { metaFlowId: string; flowJson: { screens: { id: string }[] } } }[]>("/api/flows?published=true") });
  function add(type: BuilderButton["type"]) {
    const b: BuilderButton =
      type === "QUICK_REPLY"
        ? { type, text: "" }
        : type === "URL"
          ? { type, text: "", url: "" }
          : type === "PHONE_NUMBER"
            ? { type, text: "", phoneNumber: "" }
            : type === "COPY_CODE"
              ? { type, example: "" }
              : { type: "FLOW", text: "", flowId: "", flowAction: "navigate" };
    set({ buttons: [...builder.buttons, b] });
  }
  function update(i: number, patch: Partial<BuilderButton>) {
    const buttons = builder.buttons.map((b, idx) => (idx === i ? ({ ...b, ...patch } as BuilderButton) : b));
    set({ buttons });
  }
  function remove(i: number) {
    set({ buttons: builder.buttons.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="max-w-xl space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => add("QUICK_REPLY")}>
          <Plus className="h-3.5 w-3.5" /> Quick reply
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("URL")}>
          <Plus className="h-3.5 w-3.5" /> Visit website
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("PHONE_NUMBER")}>
          <Plus className="h-3.5 w-3.5" /> Call phone
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("COPY_CODE")}>
          <Plus className="h-3.5 w-3.5" /> Copy code
        </Button>
        <Button variant="outline" size="sm" onClick={() => add("FLOW")}>
          <Plus className="h-3.5 w-3.5" /> WhatsApp Flow
        </Button>
      </div>

      {builder.buttons.length === 0 && (
        <p className="text-xs text-muted-foreground">No buttons yet. Buttons are optional.</p>
      )}

      <div className="space-y-2">
        {builder.buttons.map((btn, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{btn.type.replace("_", " ")}</Badge>
              <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {btn.type !== "COPY_CODE" && (
              <Input
                value={btn.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="Button label"
                maxLength={25}
              />
            )}
            {btn.type === "URL" && (
              <>
                <Input value={btn.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://example.com/{{1}}" />
                {variableNumbers(btn.url).length > 0 && (
                  <Input
                    value={btn.example ?? ""}
                    onChange={(e) => update(i, { example: e.target.value })}
                    placeholder="Sample full URL, e.g. https://example.com/order/123"
                  />
                )}
              </>
            )}
            {btn.type === "PHONE_NUMBER" && (
              <Input value={btn.phoneNumber} onChange={(e) => update(i, { phoneNumber: e.target.value })} placeholder="+15551234567" />
            )}
            {btn.type === "COPY_CODE" && (
              <Input value={btn.example} onChange={(e) => update(i, { example: e.target.value })} placeholder="Sample code, e.g. SAVE20" />
            )}
            {btn.type === "FLOW" && (
              <>
                <Select value={btn.flowId || undefined} onValueChange={(flowId) => {
                  const flow = publishedFlows.find((item) => item.activeVersion.metaFlowId === flowId);
                  update(i, { flowId, navigateScreen: flow?.activeVersion.flowJson.screens[0]?.id });
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose a published Flow" /></SelectTrigger>
                  <SelectContent>{publishedFlows.map((flow) => <SelectItem key={flow.id} value={flow.activeVersion.metaFlowId}>{flow.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={btn.flowAction} onValueChange={(flowAction) => update(i, { flowAction: flowAction as "navigate" | "data_exchange" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="navigate">Navigate to screen</SelectItem><SelectItem value="data_exchange">Initialize from endpoint</SelectItem></SelectContent>
                </Select>
                {btn.flowAction === "navigate" && <Input value={btn.navigateScreen || ""} onChange={(e) => update(i, { navigateScreen: e.target.value })} placeholder="Entry screen ID" />}
              </>
            )}
            <ErrorLine msg={errors.find((e) => e.field === `button-${i}`)?.message} />
          </div>
        ))}
      </div>
      <ErrorLine msg={errors.find((e) => e.field === "buttons")?.message} />
    </div>
  );
}

function ReviewStep({ errors }: { errors: FieldError[] }) {
  if (errors.length === 0) {
    return (
      <div className="max-w-xl rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Ready to submit
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything looks valid. Save as a draft, or submit to Meta for approval. Approval usually takes a few
          minutes to a few hours.
        </p>
      </div>
    );
  }
  return (
    <div className="max-w-xl rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertCircle className="h-4 w-4" /> {errors.length} issue{errors.length > 1 ? "s" : ""} to fix
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {errors.map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}
