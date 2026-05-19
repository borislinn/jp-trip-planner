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

const lastBackdrop = body => body.children[body.children.length - 1].children[0];

test("editing a restaurant prefills the sheet and saves with the same id", async () => {
  let saved = null;
  const repo = {
    async getAll() {
      return [{
        id: "restaurant-1", name: "Old Sushi", cuisine: "Sushi",
        area: "Umeda", mapUrl: "", reservationEpoch: null,
        status: "Want to go", notes: "counter"
      }];
    },
    async get() { return null; },
    async put(name, obj) { if (name === "restaurants") saved = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    await render(root, { setTitle() {}, setActions() {} }, repo);

    const detailsBtn = collect(root, "button").find(b => textOf(b) === "Details");
    detailsBtn.listeners.click();
    const editBtn = collect(lastBackdrop(body), "button").find(b => textOf(b) === "Edit");
    assert.ok(editBtn, "detail sheet should offer an Edit action");
    editBtn.listeners.click();

    const sheet = lastBackdrop(body);
    const nameInput = collect(sheet, "input").find(i => i.attributes.type === "text");
    assert.equal(nameInput.value, "Old Sushi", "name should be prefilled for editing");

    nameInput.value = "Renamed Sushi";
    const saveBtn = collect(sheet, "button").find(b => textOf(b) === "Save");
    await saveBtn.listeners.click();

    assert.equal(saved.id, "restaurant-1");
    assert.equal(saved.name, "Renamed Sushi");
  } finally {
    globalThis.document = previousDocument;
  }
});
