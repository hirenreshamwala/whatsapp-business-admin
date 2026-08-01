import { describe, expect, it } from "vitest";
import type { FlowComponent } from "../src/lib/whatsapp/flow-types";
import {
  childPath,
  containersFor,
  getContainerChildren,
  getNodeAtPath,
  insertAt,
  moveNode,
  removeAtPath,
  setNodeAtPath,
} from "../src/lib/whatsapp/flow-tree";

function sample(): FlowComponent[] {
  return [
    { type: "TextHeading", text: "Heading" },
    {
      type: "If",
      condition: "${form.agree}",
      then: [{ type: "TextBody", text: "Then A" }, { type: "TextBody", text: "Then B" }],
      else: [{ type: "TextBody", text: "Else A" }],
    },
    { type: "TextBody", text: "Tail" },
  ];
}

describe("flow-tree", () => {
  it("resolves root and nested paths", () => {
    const root = sample();
    expect(getNodeAtPath(root, [{ containerKey: "root", index: 0 }])).toMatchObject({ type: "TextHeading" });
    const thenB = childPath([{ containerKey: "root", index: 1 }], "then", 1);
    expect(getNodeAtPath(root, thenB)).toMatchObject({ text: "Then B" });
  });

  it("lists containers for If/Switch/Form", () => {
    const ifNode: FlowComponent = { type: "If", condition: true, then: [], else: [] };
    expect(containersFor(ifNode).map((c) => c.key)).toEqual(["then", "else"]);
    const switchNode: FlowComponent = { type: "Switch", value: "x", cases: { yes: [], no: [] }, default: [] };
    expect(containersFor(switchNode).map((c) => c.key)).toEqual(["case:yes", "case:no", "default"]);
    const form: FlowComponent = { type: "Form", children: [] };
    expect(containersFor(form).map((c) => c.key)).toEqual(["children"]);
  });

  it("updates a nested node immutably", () => {
    const root = sample();
    const path = childPath([{ containerKey: "root", index: 1 }], "then", 0);
    const next = setNodeAtPath(root, path, (node) => ({ ...node, text: "Changed" }));
    expect(getNodeAtPath(next, path)).toMatchObject({ text: "Changed" });
    expect(getNodeAtPath(root, path)).toMatchObject({ text: "Then A" });
  });

  it("removes a nested node and reports it", () => {
    const root = sample();
    const path = childPath([{ containerKey: "root", index: 1 }], "then", 0);
    const { root: next, removed } = removeAtPath(root, path);
    expect(removed).toMatchObject({ text: "Then A" });
    const ifNode = next[1] as FlowComponent;
    expect(ifNode.then).toEqual([{ type: "TextBody", text: "Then B" }]);
  });

  it("inserts into a nested container", () => {
    const root = sample();
    const address = { parentPath: [{ containerKey: "root" as const, index: 1 }], containerKey: "else" as const };
    const next = insertAt(root, address, 1, { type: "TextBody", text: "Else B" });
    expect(getContainerChildren(next, address)).toEqual([
      { type: "TextBody", text: "Else A" },
      { type: "TextBody", text: "Else B" },
    ]);
  });

  it("moves a node from root into a branch", () => {
    const root = sample();
    const fromPath = [{ containerKey: "root" as const, index: 2 }]; // "Tail"
    const toAddress = { parentPath: [{ containerKey: "root" as const, index: 1 }], containerKey: "else" as const };
    const next = moveNode(root, fromPath, toAddress, 1);
    expect(next).toHaveLength(2); // root shrank by one
    expect(getContainerChildren(next, toAddress)).toEqual([
      { type: "TextBody", text: "Else A" },
      { type: "TextBody", text: "Tail" },
    ]);
  });

  it("moves a node between two branches of the same If", () => {
    const root = sample();
    const fromPath = childPath([{ containerKey: "root", index: 1 }], "then", 0); // "Then A"
    const toAddress = { parentPath: [{ containerKey: "root" as const, index: 1 }], containerKey: "else" as const };
    const next = moveNode(root, fromPath, toAddress, 0);
    const ifNode = next[1] as FlowComponent;
    expect(ifNode.then).toEqual([{ type: "TextBody", text: "Then B" }]);
    expect(ifNode.else).toEqual([{ type: "TextBody", text: "Then A" }, { type: "TextBody", text: "Else A" }]);
  });

  it("reorders within the same container, adjusting for the shift", () => {
    const root = sample();
    const fromPath = childPath([{ containerKey: "root", index: 1 }], "then", 0); // "Then A", index 0
    const toAddress = { parentPath: [{ containerKey: "root" as const, index: 1 }], containerKey: "then" as const };
    // Move "Then A" to after "Then B" (originally index 1); since it's removed first, the
    // effective destination index must be adjusted down by one.
    const next = moveNode(root, fromPath, toAddress, 2);
    const ifNode = next[1] as FlowComponent;
    expect(ifNode.then).toEqual([{ type: "TextBody", text: "Then B" }, { type: "TextBody", text: "Then A" }]);
  });

  it("refuses to move a node into its own subtree", () => {
    const root = sample();
    const fromPath = [{ containerKey: "root" as const, index: 1 }]; // the If node itself
    const toAddress = { parentPath: [{ containerKey: "root" as const, index: 1 }], containerKey: "then" as const };
    const next = moveNode(root, fromPath, toAddress, 0);
    expect(next).toBe(root);
  });
});
