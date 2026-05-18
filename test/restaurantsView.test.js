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
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  focus() {}
  remove() {}
  querySelector(selector) {
    const tags = selector.split(",").map(part => part.trim());
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.shift();
      if (tags.includes(node.tag)) return node;
      stack.push(...(node.children || []));
    }
    return null;
  }
}

test("restaurants view renders even when the restaurant store is missing", async () => {
  const settings = new Map();
  const repo = {
    async getAll(name) {
      if (name === "restaurants") throw new Error("missing store");
      return [];
    },
    async get(name, id) {
      return settings.get(`${name}:${id}`);
    },
    async put(name, obj) {
      settings.set(`${name}:${obj.id}`, { ...obj });
      return { ...obj };
    },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    let title = "";
    let actions = [];
    await render(root, {
      setTitle: value => { title = value; },
      setActions: nodes => { actions = nodes; }
    }, repo);

    assert.equal(title, "Restaurants");
    assert.equal(actions.length, 1);
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].className, "empty empty-action");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("restaurants add sheet uses cuisine and Osaka area dropdowns", async () => {
  const repo = {
    async getAll() { return []; },
    async get() { return null; },
    async put(_name, obj) { return { ...obj }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  try {
    const root = new FakeNode("main");
    let actions = [];
    await render(root, {
      setTitle: () => {},
      setActions: nodes => { actions = nodes; }
    }, repo);

    actions[0].listeners.click();
    const sheet = body.children[0].children[0];
    const selects = collect(sheet, "select");
    const selectTexts = selects.map(select => textOf(select));

    assert.equal(selects.length, 3);
    assert.match(selectTexts[0], /Ramen/);
    assert.match(selectTexts[0], /Yakiniku/);
    assert.match(selectTexts[1], /Umeda/);
    assert.match(selectTexts[1], /Namba/);
    assert.match(textOf(sheet), /Name of the Restaurant/);
    assert.match(textOf(sheet), /Reservation Date & Time/);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("restaurants cards localize cuisine and area labels", async () => {
  const repo = {
    async getAll() {
      return [{
        id: "restaurant-1",
        name: "Ichiran",
        cuisine: "Ramen",
        area: "Umeda",
        mapUrl: "",
        reservationEpoch: null,
        status: "Want to go",
        notes: ""
      }];
    },
    async get() { return null; },
    async put(_name, obj) { return { ...obj }; },
    async remove() {}
  };
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const body = new FakeNode("body");
  globalThis.document = fakeDocument(body);
  globalThis.localStorage = {
    getItem: key => key === "jp-trip-language-v1" ? "zh" : null,
    setItem() {}
  };
  try {
    const root = new FakeNode("main");
    let title = "";
    await render(root, {
      setTitle: value => { title = value; },
      setActions: () => {}
    }, repo);

    const text = textOf(root);
    assert.equal(title, "餐廳");
    assert.match(text, /拉麵/);
    assert.match(text, /梅田/);
    assert.doesNotMatch(text, /Ramen/);
    assert.doesNotMatch(text, /Umeda/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
  }
});

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
