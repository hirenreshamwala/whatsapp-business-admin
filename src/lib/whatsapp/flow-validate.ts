import { FLOW_COMPONENTS, FLOW_DATA_API_VERSION, type FlowComponent, type FlowJson, type FlowValidationIssue } from "./flow-types";

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const KNOWN = new Set<string>(FLOW_COMPONENTS);

function walk(components: FlowComponent[], visit: (component: FlowComponent, path: string) => void, prefix: string) {
  components.forEach((component, index) => {
    const path = `${prefix}.${index}`;
    visit(component, path);
    if (Array.isArray(component.children)) walk(component.children, visit, `${path}.children`);
    if (Array.isArray(component.then)) walk(component.then as FlowComponent[], visit, `${path}.then`);
    if (Array.isArray(component.else)) walk(component.else as FlowComponent[], visit, `${path}.else`);
    if (component.cases && typeof component.cases === "object") {
      for (const [key, value] of Object.entries(component.cases as Record<string, unknown>)) {
        if (Array.isArray(value)) walk(value as FlowComponent[], visit, `${path}.cases.${key}`);
      }
    }
  });
}

export function validateFlowJson(flow: FlowJson): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const error = (path: string, message: string) => issues.push({ path, message, severity: "error" });
  const warning = (path: string, message: string) => issues.push({ path, message, severity: "warning" });
  if (!flow || typeof flow !== "object") return [{ path: "$", message: "Flow JSON must be an object.", severity: "error" }];
  if (!/^\d+\.\d+$/.test(flow.version || "")) error("version", "A Flow JSON version such as 7.3 is required.");
  if (!Array.isArray(flow.screens) || flow.screens.length === 0) {
    error("screens", "At least one screen is required.");
    return issues;
  }

  const screenIds = new Set<string>();
  let terminalCount = 0;
  let usesEndpoint = false;
  flow.screens.forEach((screen, screenIndex) => {
    const base = `screens.${screenIndex}`;
    if (!screen.id || !NAME_RE.test(screen.id)) error(`${base}.id`, "Screen IDs must start with a letter and contain only letters, numbers, and underscores.");
    if (screen.id === "SUCCESS") error(`${base}.id`, "SUCCESS is reserved by WhatsApp.");
    if (screenIds.has(screen.id)) error(`${base}.id`, `Duplicate screen ID: ${screen.id}`);
    screenIds.add(screen.id);
    if (screen.terminal) terminalCount += 1;
    if (!screen.layout || !Array.isArray(screen.layout.children)) error(`${base}.layout`, "A SingleColumnLayout with children is required.");

    const names = new Set<string>();
    let hasFooter = false;
    walk(screen.layout?.children || [], (component, path) => {
      if (!component.type) error(`${path}.type`, "Component type is required.");
      else if (!KNOWN.has(component.type)) warning(`${path}.type`, `${component.type} is preserved but editable only in JSON mode.`);
      if (component.name) {
        if (!NAME_RE.test(component.name)) error(`${path}.name`, "Field names must start with a letter and contain only letters, numbers, and underscores.");
        if (names.has(component.name)) error(`${path}.name`, `Duplicate field name on screen: ${component.name}`);
        names.add(component.name);
      }
      if (component.type === "Footer") hasFooter = true;
      if (component.type === "If" && (component.condition === undefined || component.condition === "")) warning(`${path}.condition`, "If condition is empty.");
      if (component.type === "Switch") {
        if (component.value === undefined || component.value === "") warning(`${path}.value`, "Switch value expression is empty.");
        const cases = component.cases;
        if (cases && typeof cases === "object" && Object.keys(cases as Record<string, unknown>).some((key) => !key.trim())) {
          error(`${path}.cases`, "Switch case keys cannot be blank.");
        }
      }
      const action = component["on-click-action"] || component["on-select-action"];
      if (action && typeof action === "object" && (action as { name?: string }).name === "data_exchange") usesEndpoint = true;
    }, `${base}.layout.children`);
    if (screen.terminal && !hasFooter) error(`${base}.layout`, "Terminal screens require a Footer component.");
    for (const field of screen.sensitive || []) {
      if (!names.has(field)) error(`${base}.sensitive`, `Sensitive field '${field}' does not exist on this screen.`);
    }
  });
  if (terminalCount === 0) error("screens", "At least one terminal screen is required.");

  for (const [from, targets] of Object.entries(flow.routing_model || {})) {
    if (!screenIds.has(from)) error(`routing_model.${from}`, `Unknown source screen '${from}'.`);
    for (const target of targets) if (!screenIds.has(target)) error(`routing_model.${from}`, `Unknown destination screen '${target}'.`);
  }
  if (usesEndpoint) {
    if (flow.data_api_version !== FLOW_DATA_API_VERSION) error("data_api_version", `Dynamic Flows require data_api_version ${FLOW_DATA_API_VERSION}.`);
    if (!flow.routing_model) error("routing_model", "Dynamic Flows require an explicit routing model.");
  }
  return issues;
}

export function parseFlowJson(value: unknown): FlowJson {
  if (!value || typeof value !== "object" || !Array.isArray((value as FlowJson).screens)) {
    throw new Error("Flow JSON must contain a screens array.");
  }
  return value as FlowJson;
}

export function flowUsesEndpoint(flow: FlowJson): boolean {
  return Boolean(flow.data_api_version) || JSON.stringify(flow).includes('"data_exchange"');
}
