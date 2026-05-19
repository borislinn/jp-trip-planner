import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/views/restaurantsView.js";

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.listeners = {};
    this.value = "";
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  focus() {}
  remove() {}
  querySelector() { return null; }
}
function fakeDocument(body) {
  return {
    body,
    createElement: tag => new FakeNode(tag),
    createTextNode: text => ({ text }),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; }
  };
}
function collect(node, tag) {
  const out = [];
  const stack = [node];
  while (stack.length) {
    const c = stack.shift();
    if (c.tag === tag) out.push(c);
    stack.push(...(c.children || []));
  }
  return out;
}
function textOf(node) {
  if (!node) return "";
  if ("text" in node) return node.text;
  return [node.textContent, ...(node.children || []).map(textOf)].join("");
}

test("restaurant list can be filtered by status", async () => {
  const repo = {
    async getAll(name) {
      if (name === "restaurants") {
        return [
          { id: "1", name: "AlphaWant", status: "Want to go", reservationEpoch: null },
          { id: "2", name: "BravoReserved", status: "Reserved", reservationEpoch: null },
          { id: "3", name: "CharlieVisited", status: "Visited", reservationEpoch: null }
        ];
      }
      return [];
    },
    async get() { return null; },
    async put(_n, o) { return { ...o }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    await render(root, { setTitle() {}, setActions() {} }, repo);

    // All three visible by default.
    assert.match(textOf(root), /AlphaWant/);
    assert.match(textOf(root), /BravoReserved/);
    assert.match(textOf(root), /CharlieVisited/);

    const reservedChip = collect(root, "button")
      .find(b => textOf(b) === "Reserved" &&
        /restaurant-filter/.test(b.className || ""));
    assert.ok(reservedChip, "a Reserved status filter chip should exist");
    reservedChip.listeners.click();

    const filtered = textOf(root);
    assert.match(filtered, /BravoReserved/);
    assert.doesNotMatch(filtered, /AlphaWant/);
    assert.doesNotMatch(filtered, /CharlieVisited/);
  } finally {
    globalThis.document = previousDocument;
  }
});
