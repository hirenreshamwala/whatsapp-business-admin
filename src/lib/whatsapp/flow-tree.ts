import type { FlowComponent } from "./flow-types";

export type ContainerKey = "root" | "children" | "then" | "else" | "default" | `case:${string}`;
export type PathStep = { containerKey: ContainerKey; index: number };
export type NodePath = PathStep[];
export type ContainerAddress = { parentPath: NodePath; containerKey: ContainerKey };
export type ContainerInfo = { key: ContainerKey; label: string };

export const ROOT_ADDRESS: ContainerAddress = { parentPath: [], containerKey: "root" };

export function containersFor(component: FlowComponent): ContainerInfo[] {
  if (component.type === "Form") return [{ key: "children", label: "Children" }];
  if (component.type === "If") return [{ key: "then", label: "Then" }, { key: "else", label: "Else" }];
  if (component.type === "Switch") {
    const cases = component.cases && typeof component.cases === "object" ? (component.cases as Record<string, unknown>) : {};
    return [...Object.keys(cases).map((key) => ({ key: `case:${key}` as ContainerKey, label: key })), { key: "default", label: "Default" }];
  }
  return [];
}

export function caseKeyOf(containerKey: ContainerKey): string | null {
  return containerKey.startsWith("case:") ? containerKey.slice(5) : null;
}

function getContainerArray(node: FlowComponent, key: ContainerKey): FlowComponent[] {
  if (key === "children") return Array.isArray(node.children) ? node.children : [];
  if (key === "then") return Array.isArray(node.then) ? (node.then as FlowComponent[]) : [];
  if (key === "else") return Array.isArray(node.else) ? (node.else as FlowComponent[]) : [];
  if (key === "default") return Array.isArray(node.default) ? (node.default as FlowComponent[]) : [];
  const caseKey = caseKeyOf(key);
  if (caseKey !== null) {
    const cases = node.cases;
    const arr = cases && typeof cases === "object" ? (cases as Record<string, unknown>)[caseKey] : undefined;
    return Array.isArray(arr) ? (arr as FlowComponent[]) : [];
  }
  return [];
}

function setContainerArray(node: FlowComponent, key: ContainerKey, next: FlowComponent[]): FlowComponent {
  if (key === "children") return { ...node, children: next };
  if (key === "then") return { ...node, then: next };
  if (key === "else") return { ...node, else: next };
  if (key === "default") return { ...node, default: next };
  const caseKey = caseKeyOf(key);
  if (caseKey !== null) {
    const cases = (node.cases && typeof node.cases === "object" ? node.cases : {}) as Record<string, unknown>;
    return { ...node, cases: { ...cases, [caseKey]: next } };
  }
  return node;
}

export function getNodeAtPath(root: FlowComponent[], path: NodePath): FlowComponent | undefined {
  if (!path.length) return undefined;
  let arr = root;
  let node: FlowComponent | undefined;
  for (let i = 0; i < path.length; i++) {
    node = arr[path[i].index];
    if (!node) return undefined;
    const next = path[i + 1];
    if (next) arr = getContainerArray(node, next.containerKey);
  }
  return node;
}

export function setNodeAtPath(root: FlowComponent[], path: NodePath, updater: (node: FlowComponent) => FlowComponent): FlowComponent[] {
  if (!path.length) return root;
  const [step, ...rest] = path;
  return root.map((node, index) => {
    if (index !== step.index) return node;
    if (rest.length === 0) return updater(node);
    const childArr = getContainerArray(node, rest[0].containerKey);
    const nextArr = setNodeAtPath(childArr, rest, updater);
    return setContainerArray(node, rest[0].containerKey, nextArr);
  });
}

export function removeAtPath(root: FlowComponent[], path: NodePath): { root: FlowComponent[]; removed?: FlowComponent } {
  if (!path.length) return { root };
  const [step, ...rest] = path;
  if (rest.length === 0) {
    const removed = root[step.index];
    return { root: root.filter((_, index) => index !== step.index), removed };
  }
  let removed: FlowComponent | undefined;
  const next = root.map((node, index) => {
    if (index !== step.index) return node;
    const childArr = getContainerArray(node, rest[0].containerKey);
    const result = removeAtPath(childArr, rest);
    removed = result.removed;
    return setContainerArray(node, rest[0].containerKey, result.root);
  });
  return { root: next, removed };
}

export function getContainerChildren(root: FlowComponent[], address: ContainerAddress): FlowComponent[] {
  if (!address.parentPath.length) return root;
  const parent = getNodeAtPath(root, address.parentPath);
  if (!parent) return [];
  return getContainerArray(parent, address.containerKey);
}

export function setContainerChildren(root: FlowComponent[], address: ContainerAddress, next: FlowComponent[]): FlowComponent[] {
  if (!address.parentPath.length) return next;
  return setNodeAtPath(root, address.parentPath, (node) => setContainerArray(node, address.containerKey, next));
}

export function insertAt(root: FlowComponent[], address: ContainerAddress, index: number, node: FlowComponent): FlowComponent[] {
  const children = getContainerChildren(root, address);
  const next = [...children];
  next.splice(index, 0, node);
  return setContainerChildren(root, address, next);
}

function pathsEqual(a: NodePath, b: NodePath): boolean {
  return a.length === b.length && a.every((step, i) => step.index === b[i].index && step.containerKey === b[i].containerKey);
}

function isAncestorOrSelf(ancestorPath: NodePath, path: NodePath): boolean {
  if (path.length < ancestorPath.length) return false;
  return ancestorPath.every((step, i) => step.index === path[i].index && step.containerKey === path[i].containerKey);
}

function adjustPathForRemoval(path: NodePath, removedParentPath: NodePath, removedContainerKey: ContainerKey, removedIndex: number): NodePath {
  return path.map((step, i) => {
    const parentSoFar = path.slice(0, i);
    if (step.containerKey === removedContainerKey && pathsEqual(parentSoFar, removedParentPath) && step.index > removedIndex) {
      return { containerKey: step.containerKey, index: step.index - 1 };
    }
    return step;
  });
}

/** Moves the node at `fromPath` into `toAddress` at `toIndex`, adjusting for index shifts caused by the removal. Returns `root` unchanged if the move would drop a node inside its own subtree. */
export function moveNode(root: FlowComponent[], fromPath: NodePath, toAddress: ContainerAddress, toIndex: number): FlowComponent[] {
  if (!fromPath.length) return root;
  const fromParentPath = fromPath.slice(0, -1);
  const fromContainerKey = fromPath[fromPath.length - 1].containerKey;
  const fromIndex = fromPath[fromPath.length - 1].index;

  if (isAncestorOrSelf(fromPath, toAddress.parentPath)) return root;

  const { root: afterRemove, removed } = removeAtPath(root, fromPath);
  if (!removed) return root;

  const adjustedParentPath = adjustPathForRemoval(toAddress.parentPath, fromParentPath, fromContainerKey, fromIndex);
  let destinationIndex = toIndex;
  if (pathsEqual(toAddress.parentPath, fromParentPath) && toAddress.containerKey === fromContainerKey && toIndex > fromIndex) {
    destinationIndex -= 1;
  }
  return insertAt(afterRemove, { parentPath: adjustedParentPath, containerKey: toAddress.containerKey }, destinationIndex, removed);
}

export function childPath(parentPath: NodePath, containerKey: ContainerKey, index: number): NodePath {
  return [...parentPath, { containerKey, index }];
}

export function serializePath(path: NodePath): string {
  return JSON.stringify(path);
}

export function parsePath(value: string): NodePath | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed as NodePath;
  } catch {
    return null;
  }
}
