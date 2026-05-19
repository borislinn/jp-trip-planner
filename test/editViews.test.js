import { test } from "node:test";
import assert from "node:assert/strict";
import { render as renderStays } from "../src/views/staysView.js";
import { render as renderFlights } from "../src/views/flightsView.js";
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
    if (name === "value") this.value = value; // mirror like a real <input>
  }
  removeAttribute(name) { delete this.attributes[name]; }
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
const lastBackdrop = body => body.children[body.children.length - 1].children[0];

function withDom(fn) {
  return async () => {
    const prev = globalThis.document;
    const body = new FakeNode("body");
    globalThis.document = fakeDocument(body);
    try { await fn(body); } finally { globalThis.document = prev; }
  };
}

test("editing a stay prefills the sheet and saves with the same id", withDom(async body => {
  let saved = null;
  const repo = {
    async getAll() {
      return [{ id: "stay-1", hotelName: "Old Inn",
        checkIn: Date.now(), checkOut: Date.now() + 86400000,
        address: "1 St", bookingReference: "ABC", note: "" }];
    },
    async get() { return null; },
    async put(name, obj) { if (name === "stays") saved = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const root = new FakeNode("main");
  let actions = [];
  await renderStays(root, { setTitle() {}, setActions: n => { actions = n; } }, repo);
  collect(root, "button").find(b => textOf(b).includes("Old Inn")).listeners.click(); // open detail

  const editBtn = actions.find(b => (b.attributes["aria-label"] || "").match(/Edit/i));
  assert.ok(editBtn, "stay detail should offer an Edit action");
  editBtn.listeners.click();

  const sheet = lastBackdrop(body);
  const hotel = collect(sheet, "input").find(i => i.attributes.type === "text");
  assert.equal(hotel.value, "Old Inn");
  hotel.value = "Renamed Inn";
  await collect(sheet, "button").find(b => textOf(b) === "Save").listeners.click();
  assert.equal(saved.id, "stay-1");
  assert.equal(saved.hotelName, "Renamed Inn");
}));

test("editing a flight prefills the sheet and saves with the same id", withDom(async body => {
  let saved = null;
  const repo = {
    async getAll() {
      return [{ id: "flight-1", flightNumber: "NH7", airline: "ANA",
        from: "SFO", to: "KIX",
        departureEpoch: Date.UTC(2026, 4, 20, 17, 0), departureTZ: "America/Los_Angeles",
        arrivalEpoch: Date.UTC(2026, 4, 21, 5, 0), arrivalTZ: "Asia/Tokyo",
        passengers: 2, note: "" }];
    },
    async get() { return null; },
    async put(name, obj) { if (name === "flights") saved = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const root = new FakeNode("main");
  await renderFlights(root, { setTitle() {}, setActions() {} }, repo);

  const editBtn = collect(root, "button")
    .find(b => /edit flight/i.test(b.attributes["aria-label"] || ""));
  assert.ok(editBtn, "flight card should offer an Edit action");
  editBtn.listeners.click();

  const sheet = lastBackdrop(body);
  const num = collect(sheet, "input").find(i => i.attributes.type === "text");
  assert.equal(num.value, "NH7");
  num.value = "NH99";
  await collect(sheet, "button").find(b => textOf(b) === "Save").listeners.click();
  assert.equal(saved.id, "flight-1");
  assert.equal(saved.flightNumber, "NH99");
}));

test("editing an expense prefills the sheet and saves with the same id", withDom(async body => {
  let savedMeal = null;
  const repo = {
    async getAll(name) {
      if (name === "meals") return [{ id: "meal-1", name: "Lunch",
        restaurant: "Lunch", amount: 1200, expenseType: "food", mealType: "food",
        comment: "", date: Date.now(), receipt: null }];
      return [];
    },
    async get() { return null; },
    async put(name, obj) { if (name === "meals") savedMeal = { ...obj }; return { ...obj }; },
    async remove() {}
  };
  const root = new FakeNode("main");
  await renderFood(root, { setTitle() {}, setActions() {} }, repo);

  const editBtn = collect(root, "button")
    .find(b => /edit expense/i.test(b.attributes["aria-label"] || ""));
  assert.ok(editBtn, "expense card should offer an Edit action");
  editBtn.listeners.click();

  const sheet = lastBackdrop(body);
  const nameInput = collect(sheet, "input")
    .find(i => i.attributes.type === "text" && !i.attributes.inputmode);
  assert.equal(nameInput.value, "Lunch");
  nameInput.value = "Brunch";
  await collect(sheet, "button").find(b => textOf(b) === "Save").listeners.click();
  assert.equal(savedMeal.id, "meal-1");
  assert.equal(savedMeal.name, "Brunch");
}));
