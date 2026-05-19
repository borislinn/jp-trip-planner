import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/views/foodView.js";

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
  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === "value") this.value = value;
  }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  get style() { return this._style || (this._style = {}); }
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

test("quick add saves an expense from just an amount", async () => {
  let savedMeal = null;
  const repo = {
    async getAll(name) {
      if (name === "meals") return [{ id: "m0", name: "Seed", restaurant: "Seed",
        amount: 500, expenseType: "food", mealType: "food", comment: "",
        date: Date.now(), receipt: null }];
      return [];
    },
    async get() { return null; },
    async put(name, obj) { if (name === "meals") savedMeal = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    await render(root, { setTitle() {}, setActions() {} }, repo);

    const quickBtn = collect(root, "button").find(b => textOf(b) === "Quick Add");
    assert.ok(quickBtn, "expense view should offer a Quick Add action");
    quickBtn.listeners.click();

    const sheet = body.children[body.children.length - 1].children[0];
    const amount = collect(sheet, "input")
      .find(i => i.attributes.inputmode === "numeric");
    assert.ok(amount, "quick add should ask for an amount");
    amount.value = "800";

    const saveBtn = collect(sheet, "button").find(b => textOf(b) === "Save");
    await saveBtn.listeners.click();

    assert.equal(savedMeal.amount, 800);
    assert.ok(savedMeal.name && savedMeal.name.trim().length > 0,
      "quick add should store a sensible default name");
  } finally {
    globalThis.document = previousDocument;
  }
});
