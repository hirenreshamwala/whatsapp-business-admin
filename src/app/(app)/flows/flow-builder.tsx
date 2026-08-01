"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDown, ArrowUp, Braces, Copy, Eye, GripVertical, Plus, Save, Settings2, Trash2, Workflow } from "lucide-react";
import { apiFetch } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { FLOW_CATEGORIES, FLOW_COMPONENTS, componentLabel, defaultComponent, emptyFlowJson, type FlowComponent, type FlowJson, type FlowScreen } from "@/lib/whatsapp/flow-types";
import { validateFlowJson } from "@/lib/whatsapp/flow-validate";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type FlowDetail = {
  id: string; name: string; categories: string[]; retentionDays: number; sensitiveFields: string[];
  completionWebhookUrl: string | null; completionSecretSet: boolean;
  activeVersion: { id: string; status: string; flowJson: FlowJson; validationErrors: unknown; bindings: Binding[] };
};
type Connector = { id: string; name: string; baseUrl: string };
type Binding = { id: string; screen: string; action: string; connectorId: string; requestMapping: unknown; responseMapping: unknown };
type Mode = "visual" | "json" | "settings" | "integrations";

export function FlowBuilder({ flowId }: { flowId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["flow", flowId], queryFn: () => apiFetch<FlowDetail>(`/api/flows/${flowId}`), enabled: Boolean(flowId) });
  const { data: connectors = [] } = useQuery({ queryKey: ["flow-connectors"], queryFn: () => apiFetch<Connector[]>("/api/flow-connectors") });
  const [mode, setMode] = useState<Mode>("visual");
  const [name, setName] = useState("Untitled Flow");
  const [categories, setCategories] = useState<string[]>(["OTHER"]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [sensitiveFields, setSensitiveFields] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [flowJson, setFlowJson] = useState<FlowJson>(emptyFlowJson());
  const [jsonText, setJsonText] = useState(JSON.stringify(emptyFlowJson(), null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const [componentIndex, setComponentIndex] = useState<number | null>(null);
  const [inspectorMode, setInspectorMode] = useState<"preview" | "component">("preview");
  const [componentDrag, setComponentDrag] = useState<{ from: number; over: number; position: "before" | "after" } | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.name); setCategories(data.categories); setRetentionDays(data.retentionDays);
    setSensitiveFields(data.sensitiveFields.join(", ")); setWebhookUrl(data.completionWebhookUrl || "");
    setFlowJson(data.activeVersion.flowJson); setJsonText(JSON.stringify(data.activeVersion.flowJson, null, 2));
  }, [data]);

  const issues = useMemo(() => validateFlowJson(flowJson), [flowJson]);
  const metaValidationErrors: unknown[] = Array.isArray(data?.activeVersion.validationErrors) ? data.activeVersion.validationErrors : [];
  const currentScreen = flowJson.screens[screenIndex] || flowJson.screens[0];
  const selected = componentIndex === null ? null : currentScreen?.layout.children[componentIndex];
  const editable = !data || ["LOCAL", "DRAFT", "ERROR"].includes(data.activeVersion.status);

  const save = useMutation({
    mutationFn: async () => {
      if (flowId) return apiFetch(`/api/flows/${flowId}`, { method: "PATCH", body: JSON.stringify({ name, categories, retentionDays, sensitiveFields: splitCsv(sensitiveFields), completionWebhookUrl: webhookUrl || null, ...(webhookSecret ? { completionSecret: webhookSecret } : {}), flowJson }) });
      return apiFetch<{ id: string }>("/api/flows", { method: "POST", body: JSON.stringify({ name, categories, retentionDays, flowJson }) });
    },
    onSuccess: (result) => { toast({ title: "Flow draft saved" }); if (!flowId && result && typeof result === "object" && "id" in result) router.replace(`/flows/${result.id}`); },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not save Flow", description: error.message }),
  });

  function updateJson(next: FlowJson) { setFlowJson(next); setJsonText(JSON.stringify(next, null, 2)); }
  function updateScreen(patch: Partial<FlowScreen>) {
    updateJson({ ...flowJson, screens: flowJson.screens.map((screen, index) => index === screenIndex ? { ...screen, ...patch } : screen) });
  }
  function updateScreenId(id: string) {
    const previous = currentScreen.id;
    const routing = Object.fromEntries(Object.entries(flowJson.routing_model || {}).map(([from, targets]) => [from === previous ? id : from, targets.map((target) => target === previous ? id : target)]));
    updateJson({ ...flowJson, routing_model: Object.keys(routing).length ? routing : flowJson.routing_model, screens: flowJson.screens.map((screen, index) => index === screenIndex ? { ...screen, id } : screen) });
  }
  function setComponents(children: FlowComponent[]) { updateScreen({ layout: { ...currentScreen.layout, children } }); }
  function updateComponent(patch: Partial<FlowComponent>) {
    if (componentIndex === null) return;
    setComponents(currentScreen.layout.children.map((component, index) => index === componentIndex ? { ...component, ...patch } : component));
  }
  function reorderComponent(from: number, over: number, position: "before" | "after") {
    const children = currentScreen.layout.children;
    if (from < 0 || from >= children.length || over < 0 || over >= children.length) return;
    const selectedComponent = componentIndex === null ? null : children[componentIndex];
    const next = [...children];
    const [moved] = next.splice(from, 1);
    let destination = over + (position === "after" ? 1 : 0);
    if (from < destination) destination -= 1;
    next.splice(destination, 0, moved);
    setComponents(next);
    if (selectedComponent) setComponentIndex(next.indexOf(selectedComponent));
    setInspectorMode("component");
  }
  function parseJsonEditor() {
    try { const parsed = JSON.parse(jsonText) as FlowJson; if (!Array.isArray(parsed.screens)) throw new Error("screens must be an array"); setFlowJson(parsed); setJsonError(null); setScreenIndex(0); setComponentIndex(null); setInspectorMode("preview"); }
    catch (error) { setJsonError(error instanceof Error ? error.message : "Invalid JSON"); }
  }
  function addScreen() {
    const id = `SCREEN_${flowJson.screens.length + 1}`;
    updateJson({ ...flowJson, screens: [...flowJson.screens, { id, title: `Step ${flowJson.screens.length + 1}`, layout: { type: "SingleColumnLayout", children: [{ type: "TextHeading", text: "New step" }, { type: "Footer", label: "Continue", "on-click-action": { name: "complete", payload: {} } }] } }] });
    setScreenIndex(flowJson.screens.length); setComponentIndex(null); setInspectorMode("preview");
  }

  return <div className="flex h-full flex-col">
    <PageHeader title={flowId ? `Edit ${name}` : "New WhatsApp Flow"} description="Build visually or edit canonical Flow JSON. Meta performs the final validation." actions={<>
      <Button variant="ghost" size="sm" onClick={() => router.push("/flows")}>Cancel</Button>
      <Button size="sm" onClick={() => save.mutate()} disabled={!editable || save.isPending || issues.some((issue) => issue.severity === "error")}><Save className="h-4 w-4" /> Save draft</Button>
    </>} />
    <div className="flex items-center gap-1 border-b px-4 py-2">
      <ModeButton active={mode === "visual"} onClick={() => setMode("visual")} icon={<Workflow className="h-4 w-4" />}>Visual</ModeButton>
      <ModeButton active={mode === "json"} onClick={() => setMode("json")} icon={<Braces className="h-4 w-4" />}>JSON</ModeButton>
      <ModeButton active={mode === "settings"} onClick={() => setMode("settings")} icon={<Settings2 className="h-4 w-4" />}>Settings</ModeButton>
      <ModeButton active={mode === "integrations"} onClick={() => setMode("integrations")} icon={<Settings2 className="h-4 w-4" />}>Data integrations</ModeButton>
      <div className="ml-auto flex items-center gap-2 text-xs"><Badge variant="outline">JSON {flowJson.version}</Badge>{issues.length > 0 && <span className={issues.some((i) => i.severity === "error") ? "text-destructive" : "text-amber-600"}>{issues.length} issue{issues.length === 1 ? "" : "s"}</span>}</div>
    </div>
    {mode === "visual" && <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(360px,1fr)_320px]">
      <aside className="overflow-auto border-r p-3 scroll-thin">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-muted-foreground">Screens</span><Button size="icon" variant="ghost" onClick={addScreen}><Plus className="h-4 w-4" /></Button></div>
        <div className="space-y-1">{flowJson.screens.map((screen, index) => <button key={screen.id} onClick={() => { setScreenIndex(index); setComponentIndex(null); setInspectorMode("preview"); }} className={cn("w-full rounded-md border px-2 py-2 text-left text-xs", screenIndex === index && "border-primary bg-primary/5")}><div className="font-medium">{screen.title || screen.id}</div><div className="text-[10px] text-muted-foreground">{screen.id}{screen.terminal ? " · terminal" : ""}</div></button>)}</div>
        <div className="mt-5 text-xs font-semibold uppercase text-muted-foreground">Components</div>
        <div className="mt-2 grid grid-cols-1 gap-1">{FLOW_COMPONENTS.map((type) => <button key={type} onClick={() => { const next = [...currentScreen.layout.children, defaultComponent(type, currentScreen.layout.children.length + 1)]; setComponents(next); setComponentIndex(next.length - 1); setInspectorMode("component"); }} className="rounded border px-2 py-1.5 text-left text-[11px] hover:border-primary hover:bg-primary/5">+ {componentLabel(type)}</button>)}</div>
      </aside>
      <main className="min-h-0 overflow-auto p-4 scroll-thin">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="grid grid-cols-2 gap-2"><Field label="Screen ID"><Input value={currentScreen.id} onChange={(event) => updateScreenId(event.target.value)} /></Field><Field label="Title"><Input value={currentScreen.title || ""} onChange={(event) => updateScreen({ title: event.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(currentScreen.terminal)} onChange={(event) => updateScreen({ terminal: event.target.checked || undefined })} /> Terminal screen</label>
          {flowJson.screens.length > 1 && <Button variant="outline" size="sm" onClick={() => { const removed = currentScreen.id; const routing = Object.fromEntries(Object.entries(flowJson.routing_model || {}).filter(([from]) => from !== removed).map(([from, targets]) => [from, targets.filter((target) => target !== removed)])); updateJson({ ...flowJson, routing_model: routing, screens: flowJson.screens.filter((_, index) => index !== screenIndex) }); setScreenIndex(Math.max(0, screenIndex - 1)); setComponentIndex(null); setInspectorMode("preview"); }}><Trash2 className="h-3.5 w-3.5" /> Delete screen</Button>}
          <Button variant="outline" size="sm" onClick={() => { const clone = JSON.parse(JSON.stringify(currentScreen)) as FlowScreen; clone.id = `${currentScreen.id}_COPY`; clone.title = `${currentScreen.title || currentScreen.id} copy`; updateJson({ ...flowJson, screens: [...flowJson.screens, clone] }); setScreenIndex(flowJson.screens.length); setComponentIndex(null); setInspectorMode("preview"); }}><Copy className="h-3.5 w-3.5" /> Duplicate screen</Button>
          <Field label="Allowed next screens"><div className="flex flex-wrap gap-2">{flowJson.screens.filter((screen) => screen.id !== currentScreen.id).map((screen) => { const active = (flowJson.routing_model?.[currentScreen.id] || []).includes(screen.id); return <label key={screen.id} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs"><input type="checkbox" checked={active} onChange={(event) => { const current = flowJson.routing_model?.[currentScreen.id] || []; const targets = event.target.checked ? [...current, screen.id] : current.filter((id) => id !== screen.id); updateJson({ ...flowJson, routing_model: { ...(flowJson.routing_model || {}), [currentScreen.id]: targets } }); }} />{screen.title || screen.id}</label>; })}{flowJson.screens.length === 1 && <span className="text-xs text-muted-foreground">Add another screen to define routing.</span>}</div></Field>
          <div className="space-y-1">{currentScreen.layout.children.map((component, index) => {
            const showBefore = componentDrag?.over === index && componentDrag.position === "before";
            const showAfter = componentDrag?.over === index && componentDrag.position === "after";
            return <div key={index} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; const card = event.currentTarget.querySelector<HTMLElement>("[data-flow-component-card]"); const bounds = (card || event.currentTarget).getBoundingClientRect(); const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"; setComponentDrag((current) => current && current.over === index && current.position === position ? current : current ? { ...current, over: index, position } : null); }} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData("text/plain")); const card = event.currentTarget.querySelector<HTMLElement>("[data-flow-component-card]"); const bounds = (card || event.currentTarget).getBoundingClientRect(); const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"; reorderComponent(from, index, position); setComponentDrag(null); }}>
              <DropIndicator visible={showBefore} />
              <div data-flow-component-card draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); setComponentDrag({ from: index, over: index, position: "before" }); }} onDragEnd={() => setComponentDrag(null)} onClick={() => { setComponentIndex(index); setInspectorMode("component"); }} className={cn("flex cursor-grab items-center gap-2 rounded-md border bg-card p-2 transition-[opacity,transform,box-shadow,border-color] duration-150 active:cursor-grabbing", componentIndex === index && "border-primary ring-1 ring-primary/20", componentDrag?.from === index && "scale-[0.99] opacity-40 shadow-none")}><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="text-xs font-medium">{componentLabel(component.type)}</div><div className="truncate text-[11px] text-muted-foreground">{String(component.label || component.text || component.name || "Configure component")}</div></div><Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); const next = currentScreen.layout.children.filter((_, i) => i !== index); setComponents(next); setComponentIndex(null); setInspectorMode("preview"); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
              <DropIndicator visible={showAfter} />
            </div>;
          })}</div>
          <div className="rounded-md border p-3"><div className="mb-2 text-xs font-semibold">Validation</div>{issues.length === 0 ? <p className="text-xs text-emerald-600">Local validation passed.</p> : <div className="space-y-1">{issues.map((issue, index) => <div key={index} className={cn("flex gap-1 text-xs", issue.severity === "error" ? "text-destructive" : "text-amber-600")}><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span><code>{issue.path}</code>: {issue.message}</span></div>)}</div>}{metaValidationErrors.length > 0 && <div className="mt-2 border-t pt-2"><div className="text-xs font-medium text-destructive">Meta validation</div><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-destructive">{JSON.stringify(metaValidationErrors, null, 2)}</pre></div>}</div>
        </div>
      </main>
      <aside className="min-h-0 overflow-auto border-l bg-muted/20 p-3 scroll-thin">
        <div className="mb-3 grid grid-cols-2 rounded-lg border bg-background p-1">
          <button type="button" onClick={() => setInspectorMode("preview")} className={cn("flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors", inspectorMode === "preview" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Eye className="h-3.5 w-3.5" /> Preview</button>
          <button type="button" disabled={!selected} onClick={() => setInspectorMode("component")} className={cn("flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", inspectorMode === "component" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Braces className="h-3.5 w-3.5" /> JSON</button>
        </div>
        {inspectorMode === "preview" ? <FlowPhonePreview screen={currentScreen} /> : selected ? <ComponentEditor component={selected} update={updateComponent} rawUpdate={(raw) => { if (componentIndex === null) return; const next = [...currentScreen.layout.children]; next[componentIndex] = raw; setComponents(next); }} /> : <div className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">Select a component to edit its settings and JSON.</div>}
      </aside>
    </div>}
    {mode === "json" && <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]"><div className="flex min-h-0 flex-col p-4"><Textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} onBlur={parseJsonEditor} spellCheck={false} className="min-h-0 flex-1 resize-none font-mono text-xs" />{jsonError && <p className="mt-2 text-xs text-destructive">{jsonError}</p>}<div className="mt-2"><Button size="sm" variant="outline" onClick={parseJsonEditor}>Apply JSON</Button></div></div><div className="overflow-auto border-l p-4"><FlowPhonePreview screen={currentScreen} /></div></div>}
    {mode === "settings" && <div className="mx-auto w-full max-w-3xl space-y-4 overflow-auto p-5"><Field label="Flow name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Categories"><div className="flex flex-wrap gap-2">{FLOW_CATEGORIES.map((category) => <button key={category} onClick={() => setCategories(categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category])} className={cn("rounded-md border px-2 py-1 text-xs", categories.includes(category) && "border-primary bg-primary/10 text-primary")}>{category.replaceAll("_", " ")}</button>)}</div></Field><Field label="Response retention (days)"><Input type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} /></Field><Field label="Sensitive response field names"><Input value={sensitiveFields} onChange={(event) => setSensitiveFields(event.target.value)} placeholder="email, phone, identity_number" /></Field><Field label="Completion webhook URL (HTTPS)"><Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://api.example.com/whatsapp-flow" /></Field><Field label={`Webhook signing secret ${data?.completionSecretSet ? "(configured)" : ""}`}><Input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder={data?.completionSecretSet ? "Leave blank to keep existing" : "At least 16 characters"} /></Field></div>}
    {mode === "integrations" && <BindingsEditor flowId={flowId} screens={flowJson.screens} connectors={connectors} bindings={data?.activeVersion.bindings || []} />}
  </div>;
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick}>{icon}{children}</Button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function DropIndicator({ visible }: { visible: boolean }) { return <div aria-hidden className={cn("relative mx-2 transition-[height,opacity,margin] duration-150", visible ? "my-1 h-0.5 opacity-100" : "h-0 opacity-0")}><div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background))]" /><div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" /></div>; }
function splitCsv(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

function ComponentEditor({ component, update, rawUpdate }: { component: FlowComponent; update: (patch: Partial<FlowComponent>) => void; rawUpdate: (raw: FlowComponent) => void }) {
  const [raw, setRaw] = useState(JSON.stringify(component, null, 2));
  useEffect(() => setRaw(JSON.stringify(component, null, 2)), [component]);
  const isChoiceComponent = ["RadioButtonsGroup", "CheckboxGroup", "Dropdown"].includes(component.type);
  const dataSource = component["data-source"];
  const options = Array.isArray(dataSource) ? dataSource.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];

  function setOptions(next: Record<string, unknown>[]) { update({ "data-source": next }); }
  function addOption() {
    const usedIds = new Set(options.map((option) => String(option.id || "")));
    let number = options.length + 1;
    while (usedIds.has(`option_${number}`)) number += 1;
    setOptions([...options, { id: `option_${number}`, title: `Option ${number}` }]);
  }
  function changeOption(index: number, patch: Record<string, unknown>) { setOptions(options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option)); }
  function moveOption(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= options.length) return;
    const next = [...options];
    [next[index], next[destination]] = [next[destination], next[index]];
    setOptions(next);
  }

  return <div className="space-y-3">
    <div><div className="text-sm font-semibold">{componentLabel(component.type)}</div><div className="text-xs text-muted-foreground">Edit common properties or use component JSON for complete Meta coverage.</div></div>
    {component.name !== undefined && <Field label="Field name"><Input value={component.name} onChange={(event) => update({ name: event.target.value })} /></Field>}
    {component.label !== undefined && <Field label="Label"><Input value={component.label} onChange={(event) => update({ label: event.target.value })} /></Field>}
    {component.text !== undefined && <Field label="Text"><Textarea value={Array.isArray(component.text) ? component.text.join("\n") : component.text} onChange={(event) => update({ text: Array.isArray(component.text) ? event.target.value.split("\n") : event.target.value })} /></Field>}
    {component.required !== undefined && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(component.required)} onChange={(event) => update({ required: event.target.checked })} /> Required</label>}
    {isChoiceComponent && <Field label="Options">
      {typeof dataSource === "string" ? <div className="space-y-2 rounded-md border border-dashed p-3"><p className="text-xs text-muted-foreground">This component uses a dynamic data source. Switch to static options to edit choices visually.</p><Button type="button" size="sm" variant="outline" onClick={() => setOptions([{ id: "option_1", title: "Option 1" }])}>Use static options</Button></div> : <div className="space-y-2">
        {options.map((option, index) => <div key={index} className="rounded-md border bg-background p-2">
          <div className="grid grid-cols-[1fr_1.25fr] gap-2"><Input value={String(option.id || "")} onChange={(event) => changeOption(index, { id: event.target.value })} placeholder="Option ID" aria-label={`Option ${index + 1} ID`} /><Input value={String(option.title || "")} onChange={(event) => changeOption(index, { title: event.target.value })} placeholder="Option label" aria-label={`Option ${index + 1} label`} /></div>
          <div className="mt-1 flex justify-end"><Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveOption(index, -1)} aria-label="Move option up"><ArrowUp className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === options.length - 1} onClick={() => moveOption(index, 1)} aria-label="Move option down"><ArrowDown className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, optionIndex) => optionIndex !== index))} aria-label="Remove option"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
        </div>)}
        {options.length === 0 && <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">No options yet.</p>}
        <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus className="h-3.5 w-3.5" /> Add option</Button>
      </div>}
    </Field>}
    <Field label="Component JSON"><Textarea value={raw} onChange={(event) => setRaw(event.target.value)} onBlur={() => { try { rawUpdate(JSON.parse(raw) as FlowComponent); } catch { /* keep editing */ } }} className="min-h-64 font-mono text-[11px]" /></Field>
  </div>;
}

function FlowPhonePreview({ screen }: { screen: FlowScreen }) {
  return <div><div className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Local preview</div><div className="mx-auto min-h-[560px] max-w-[290px] rounded-[28px] border-4 border-zinc-800 bg-[#f7f5f2] p-3 shadow-xl"><div className="mb-3 border-b pb-2 text-center text-sm font-semibold">{screen.title || screen.id}</div><div className="space-y-2">{screen.layout.children.map((component, index) => <PreviewComponent key={index} component={component} />)}</div></div></div>;
}
function PreviewComponent({ component }: { component: FlowComponent }) {
  if (["TextHeading", "TextSubheading"].includes(component.type)) return <div className={component.type === "TextHeading" ? "text-base font-bold" : "text-sm font-semibold"}>{String(component.text || "Heading")}</div>;
  if (["TextBody", "TextCaption", "RichText"].includes(component.type)) return <div className="whitespace-pre-wrap text-xs text-zinc-600">{Array.isArray(component.text) ? component.text.join("\n") : String(component.text || "Text")}</div>;
  if (component.type === "Footer") return <button className="mt-3 w-full rounded-full bg-[#008069] px-3 py-2 text-xs font-semibold text-white">{String(component.label || "Continue")}</button>;
  if (component.type === "Form") return <div className="space-y-2">{(component.children || []).map((child, index) => <PreviewComponent key={index} component={child} />)}</div>;
  if (["CheckboxGroup", "RadioButtonsGroup", "Dropdown"].includes(component.type)) {
    const source = component["data-source"];
    const options = Array.isArray(source) ? source.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
    const fallback = typeof source === "string" ? "Dynamic options" : "No options configured";
    return <div><div className="mb-1 text-[11px] font-medium">{String(component.label || component.name)}</div>
      {component.type === "Dropdown" ? <select disabled className="w-full rounded-md border bg-white px-2 py-2 text-xs text-zinc-500"><option>{options.length ? "Select an option" : fallback}</option>{options.map((option, index) => <option key={String(option.id || index)}>{String(option.title || option.id || `Option ${index + 1}`)}</option>)}</select> : <div className="space-y-1 rounded-md border bg-white p-2">{options.length ? options.map((option, index) => <label key={String(option.id || index)} className="flex items-center gap-2 text-xs text-zinc-700"><input type={component.type === "RadioButtonsGroup" ? "radio" : "checkbox"} disabled name={component.type === "RadioButtonsGroup" ? String(component.name || "preview-radio") : undefined} />{String(option.title || option.id || `Option ${index + 1}`)}</label>) : <span className="text-xs text-zinc-500">{fallback}</span>}</div>}
    </div>;
  }
  if (["OptIn"].includes(component.type)) return <label className="flex gap-2 text-xs"><input type="checkbox" />{String(component.label || "I agree")}</label>;
  if (["Image"].includes(component.type)) return <div className="flex h-24 items-center justify-center rounded bg-zinc-200 text-xs text-zinc-500">Image</div>;
  if (["If", "Switch"].includes(component.type)) return <div className="rounded border border-dashed p-2 text-[11px] text-zinc-500">Conditional content</div>;
  return <div><div className="mb-1 text-[11px] font-medium">{String(component.label || component.name || componentLabel(component.type))}</div><div className="rounded-md border bg-white px-2 py-2 text-xs text-zinc-400">Enter response</div></div>;
}

function BindingsEditor({ flowId, screens, connectors, bindings }: { flowId?: string; screens: FlowScreen[]; connectors: Connector[]; bindings: Binding[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState(screens[0]?.id || "");
  const [connectorId, setConnectorId] = useState(connectors[0]?.id || "");
  const [action, setAction] = useState("data_exchange");
  const [request, setRequest] = useState('{\n  "path": "/flow",\n  "body": {\n    "answers": { "source": "$.form" }\n  }\n}');
  const [response, setResponse] = useState('{\n  "screen": "$.screen",\n  "data": "$.data",\n  "error": "$.error_msg"\n}');
  const save = useMutation({ mutationFn: () => apiFetch(`/api/flows/${flowId}/bindings`, { method: "POST", body: JSON.stringify({ screen, action, connectorId, requestMapping: JSON.parse(request), responseMapping: JSON.parse(response) }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flow", flowId] }); toast({ title: "Data binding saved", description: "The Flow was enabled for Data API 3.0." }); }, onError: (error: Error) => toast({ variant: "destructive", title: "Could not save binding", description: error.message }) });
  if (!flowId) return <div className="p-6 text-sm text-muted-foreground">Save the Flow before adding data integrations.</div>;
  return <div className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_300px] gap-5 overflow-auto p-5"><div className="space-y-4"><div><h3 className="font-semibold">Dynamic data exchange</h3><p className="text-xs text-muted-foreground">Map a screen action to an admin-approved HTTPS connector. Paths beginning with <code>$.</code> read from request, form, initial, or contact context.</p></div><div className="grid grid-cols-3 gap-3"><Field label="Screen"><Select value={screen} onValueChange={setScreen}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{screens.map((item) => <SelectItem key={item.id} value={item.id}>{item.title || item.id}</SelectItem>)}</SelectContent></Select></Field><Field label="Action"><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INIT">INIT</SelectItem><SelectItem value="data_exchange">data_exchange</SelectItem><SelectItem value="BACK">BACK</SelectItem></SelectContent></Select></Field><Field label="Connector"><Select value={connectorId} onValueChange={setConnectorId}><SelectTrigger><SelectValue placeholder="Choose connector" /></SelectTrigger><SelectContent>{connectors.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Request mapping"><Textarea value={request} onChange={(event) => setRequest(event.target.value)} className="min-h-44 font-mono text-xs" /></Field><Field label="Response mapping"><Textarea value={response} onChange={(event) => setResponse(event.target.value)} className="min-h-32 font-mono text-xs" /></Field><Button onClick={() => save.mutate()} disabled={!connectorId || save.isPending}>Save binding</Button>{!connectors.length && <p className="text-xs text-amber-600">Create an approved connector in Settings first.</p>}</div><aside><div className="text-xs font-semibold uppercase text-muted-foreground">Current bindings</div><div className="mt-2 space-y-2">{bindings.map((binding) => <div key={binding.id} className="rounded border p-2 text-xs"><div className="font-medium">{binding.screen}</div><div className="text-muted-foreground">{binding.action} · {connectors.find((item) => item.id === binding.connectorId)?.name || binding.connectorId}</div></div>)}{!bindings.length && <p className="text-xs text-muted-foreground">No bindings configured.</p>}</div></aside></div>;
}
