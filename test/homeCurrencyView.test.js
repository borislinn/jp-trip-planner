import { test } from "node:test";
import assert from "node:assert/strict";
import { render as renderBudget } from "../src/views/budgetView.js";
import { render as renderFood } from "../src/views/foodView.js";

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
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: text => ({ text }),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; }
  };
}
function textOf(node) {
  if (!node) return "";
  if ("text" in node) return node.text;
  return [node.textContent, ...(node.children || []).map(textOf)].join("");
}
function withDom(fn) {
  return async () => {
    const prev = globalThis.document;
    const body = new FakeNode("body");
    globalThis.document = fakeDocument(body);
    try { await fn(body); } finally { globalThis.document = prev; }
  };
}

const settingsRepo = extra => ({
  async getAll() { return []; },
  async get(name, id) {
    if (name === "settings" && id === "singleton") {
      return { id: "singleton", currencyCode: "JPY", totalBudget: 100000,
        categoryBudgets: {}, homeCurrency: "USD", homeRate: 155, ...extra };
    }
    return null;
  },
  async put(_n, o) { return { ...o }; },
  async remove() {}
});

test("budget overview shows a home-currency approximation", withDom(async () => {
  const root = new FakeNode("main");
  await renderBudget(root, { setTitle() {}, setActions() {} }, settingsRepo());
  const text = textOf(root);
  assert.match(text, /≈/, "should show an approximate home-currency figure");
  assert.match(text, /\$/, "approximation should be in the home currency");
}));

test("budget settings sheet exposes home currency and rate fields", withDom(async body => {
  const root = new FakeNode("main");
  let actions = [];
  await renderBudget(root, { setTitle() {}, setActions: n => { actions = n; } },
    settingsRepo());
  actions.find(b => b.attributes["aria-label"] === "Budget settings").listeners.click();
  const sheet = body.children[body.children.length - 1].children[0];
  assert.match(textOf(sheet), /Home currency/i);
  assert.match(textOf(sheet), /rate/i);
}));

test("expense summary shows a home-currency approximation", withDom(async () => {
  const repo = {
    async getAll(name) {
      if (name === "meals") return [{ id: "m1", name: "Lunch", restaurant: "Lunch",
        amount: 1550, expenseType: "food", mealType: "food", comment: "",
        date: Date.now(), receipt: null }];
      return [];
    },
    async get(name, id) {
      if (name === "settings" && id === "singleton") {
        return { id: "singleton", currencyCode: "JPY",
          homeCurrency: "USD", homeRate: 155 };
      }
      return null;
    },
    async put(_n, o) { return { ...o }; },
    async remove() {}
  };
  const root = new FakeNode("main");
  await renderFood(root, { setTitle() {}, setActions() {} }, repo);
  assert.match(textOf(root), /≈/, "expense total should show a home approximation");
}));
