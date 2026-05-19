import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/views/journeyView.js";

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
function textOf(node) {
  if (!node) return "";
  if ("text" in node) return node.text;
  return [node.textContent, ...(node.children || []).map(textOf)].join("");
}

// Far-future trip so the initial selected day is always the first trip day,
// independent of the machine's real clock.
const ci = Date.parse("3000-01-01T12:00:00+09:00");
const co = Date.parse("3000-01-03T12:00:00+09:00");
const reservationEpoch = Date.parse("3000-01-01T19:00:00+09:00");

test("Home Today card lists a restaurant reservation on that day", async () => {
  const repo = {
    async getAll(name) {
      if (name === "stays") {
        return [{ id: "s1", hotelName: "Test Hotel",
          checkIn: ci, checkOut: co, address: "1 Osaka" }];
      }
      if (name === "restaurants") {
        return [{ id: "r1", name: "Ichiran Ramen", cuisine: "Ramen",
          area: "Umeda", status: "Reserved", reservationEpoch, notes: "" }];
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
    assert.match(textOf(root), /Ichiran Ramen/,
      "the selected day's plan should surface restaurant reservations");
  } finally {
    globalThis.document = previousDocument;
  }
});
