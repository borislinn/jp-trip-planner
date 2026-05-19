// Force a non-Japan device timezone so the bug (parsing the datetime-local
// value in the device zone instead of Japan time) is deterministic.
process.env.TZ = "America/Los_Angeles";

import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/views/restaurantsView.js";
import { zonedWallClockToEpoch } from "../src/domain/datetime.js";

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
    const current = stack.shift();
    if (current.tag === tag) out.push(current);
    stack.push(...(current.children || []));
  }
  return out;
}

function textOf(node) {
  if (!node) return "";
  if ("text" in node) return node.text;
  return [node.textContent, ...(node.children || []).map(textOf)].join("");
}

test("reservation entered as a wall-clock time is stored as Japan time", async () => {
  let saved = null;
  const repo = {
    async getAll() { return []; },
    async get() { return null; },
    async put(name, obj) { if (name === "restaurants") saved = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    let actions = [];
    await render(root, { setTitle() {}, setActions: n => { actions = n; } }, repo);

    actions[0].listeners.click(); // open the add sheet
    const sheet = body.children[0].children[0];
    const inputs = collect(sheet, "input");
    const nameInput = inputs.find(i => i.attributes.type === "text");
    const reservationInput = inputs.find(i => i.attributes.type === "datetime-local");
    nameInput.value = "Sushi Counter";
    reservationInput.value = "2026-05-24T19:00";

    const saveBtn = collect(sheet, "button").find(b => textOf(b) === "Save");
    await saveBtn.listeners.click();

    const expected = zonedWallClockToEpoch("2026-05-24T19:00", "Asia/Tokyo");
    assert.equal(saved.reservationEpoch, expected);
    // Guard against the regression: must NOT be the naive device-zone parse.
    assert.notEqual(
      saved.reservationEpoch,
      new Date("2026-05-24T19:00").getTime()
    );
  } finally {
    globalThis.document = previousDocument;
  }
});
