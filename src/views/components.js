import { formatCurrency, parseCurrencyInput } from "../domain/money.js";
import { t } from "../domain/i18n.js";

export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}

// Environment-safe shims so these helpers also run under the test DOM,
// which has no requestAnimationFrame, window, or body.classList.
const raf = cb =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : setTimeout(cb, 0);
function bodyClass(name, on) {
  const cl = typeof document !== "undefined"
    && document.body && document.body.classList;
  if (cl) cl[on ? "add" : "remove"](name);
}
function setOpen(node, on) {
  if (node && node.classList) node.classList[on ? "add" : "remove"]("is-open");
}

export function empty(message) {
  return el("div", { class: "empty" }, message);
}

// Empty state with a single primary call to action. One shape everywhere
// so a brand-new user never hits a dead-end screen.
export function emptyAction(message, actionLabel, onClick) {
  return el("div", { class: "empty empty-action" }, [
    el("strong", {}, message),
    el("button", {
      class: "btn-primary", type: "button", onclick: onClick
    }, actionLabel)
  ]);
}

export function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = el("div", { class: "toast", role: "status", "aria-live": "polite" }, message);
  document.body.appendChild(node);
  raf(() => setOpen(node, true));
  setTimeout(() => {
    setOpen(node, false);
    setTimeout(() => node.remove(), 280);
  }, 1800);
}

// Locks the scrolling view behind a modal so iOS doesn't rubber-band the
// page underneath. Reference-counted so stacked modals stay locked.
let scrollLockCount = 0;
function lockScroll() {
  if (scrollLockCount++ === 0) bodyClass("modal-open", true);
}
function unlockScroll() {
  if (--scrollLockCount <= 0) {
    scrollLockCount = 0;
    bodyClass("modal-open", false);
  }
}

// Bottom-sheet modal. `build(close)` returns the body element.
export function openSheet(build) {
  const backdrop = el("div", { class: "sheet-backdrop" });
  const sheet = el("div", {
    class: "sheet", role: "dialog", "aria-modal": "true", tabindex: "-1"
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    unlockScroll();
    setOpen(backdrop, false);
    const done = () => backdrop.remove();
    backdrop.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 320);
  };
  const onKeydown = e => { if (e.key === "Escape") close(); };
  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });
  sheet.appendChild(el("button", {
    class: "sheet-close",
    type: "button",
    "aria-label": t("Close"),
    onclick: close
  }, "×"));
  sheet.appendChild(build(close));
  // Keep the focused field above the iOS keyboard inside a fixed container.
  sheet.addEventListener("focusin", e => {
    setTimeout(() => e.target?.scrollIntoView?.({
      block: "center", behavior: "smooth"
    }), 250);
  });
  backdrop.appendChild(sheet);
  lockScroll();
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", onKeydown);
  raf(() => setOpen(backdrop, true));
  // Focus the sheet itself, not the first field — focusing an input here
  // would immediately raise the iOS keyboard and cover the form.
  sheet.focus({ preventScroll: true });
}

// One way to open a map everywhere. The universal https URL opens the
// Google Maps app when installed and the web map otherwise — no custom
// URL scheme, so iOS never throws an "address is invalid" dialog.
export function mapsUrl(query) {
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query);
}
export function openMaps(query) {
  window.location.href = mapsUrl(query);
}

// In-app replacement for window.confirm — keeps destructive choices inside
// the app's own styling instead of an unstyleable iOS system dialog.
export function confirmDialog({
  title, message = "", confirmLabel = t("Delete"),
  cancelLabel = t("Cancel"), danger = true
}) {
  return new Promise(resolve => {
    const backdrop = el("div", { class: "sheet-backdrop confirm-backdrop" });
    const card = el("div", {
      class: "confirm-card", role: "alertdialog",
      "aria-modal": "true", tabindex: "-1"
    });
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      setOpen(backdrop, false);
      const rm = () => backdrop.remove();
      backdrop.addEventListener("transitionend", rm, { once: true });
      setTimeout(rm, 320);
      resolve(value);
    };
    const onKey = e => { if (e.key === "Escape") finish(false); };
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) finish(false);
    });
    card.appendChild(el("h3", {}, title));
    if (message) card.appendChild(el("p", { class: "confirm-message" }, message));
    card.appendChild(el("div", { class: "confirm-actions" }, [
      el("button", {
        class: "btn-secondary", type: "button",
        onclick: () => finish(false)
      }, cancelLabel),
      el("button", {
        class: danger ? "btn-primary confirm-danger" : "btn-primary",
        type: "button", onclick: () => finish(true)
      }, confirmLabel)
    ]));
    backdrop.appendChild(card);
    lockScroll();
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", onKey);
    raf(() => setOpen(backdrop, true));
    card.focus({ preventScroll: true });
  });
}

// Saves an object as a downloaded .json file. On iOS this opens the
// share sheet so the user can store it in Files / iCloud / Mail.
export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
}

// Opens the native file picker and resolves with the parsed JSON, or
// null if the user cancels. Rejects if the file isn't valid JSON.
export function pickJSONFile() {
  return new Promise((resolve, reject) => {
    const input = el("input", {
      type: "file", accept: "application/json,.json"
    });
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch { reject(new Error("That file isn't valid JSON.")); }
      };
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsText(file);
    });
    input.click();
  });
}

export function field(labelText, inputEl) {
  return el("div", { class: "field" }, [el("label", {}, labelText), inputEl]);
}

function openNativePicker(input) {
  try {
    if (typeof input.showPicker === "function") input.showPicker();
  } catch {
    // Some browsers only allow showPicker during direct pointer/keyboard events.
  }
}

// On iOS, tapping a date/datetime input already opens the native wheel
// picker, so no extra trigger button is needed. showPicker() is called
// where supported for browsers that don't open on tap alone.
export function pickerInput(type, attrs = {}) {
  const input = el("input", { type, ...attrs });
  input.addEventListener("click", () => openNativePicker(input));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") openNativePicker(input);
  });
  return { input, element: input };
}

export function moneyInput(attrs = {}, currencyCode = "JPY") {
  const input = el("input", {
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "¥",
    ...attrs
  });
  input.addEventListener("focus", () => {
    const value = parseCurrencyInput(input.value);
    input.value = value > 0 ? String(value) : "";
  });
  input.addEventListener("blur", () => {
    const value = parseCurrencyInput(input.value);
    input.value = value > 0 ? formatCurrency(value, currencyCode) : "";
  });
  return input;
}

export function helpText(text) {
  return el("div", { class: "help-text" }, text);
}

export function sectionTitle(title, detail = null) {
  return el("div", { class: "section-title" }, [
    el("h3", {}, title),
    detail ? el("span", {}, detail) : null
  ]);
}

export function progressBar(value, max, label = "", color = null) {
  const safeMax = Math.max(Number(max) || 0, 0);
  const safeValue = Math.max(Number(value) || 0, 0);
  const percent = safeMax > 0 ? Math.min(100, (safeValue / safeMax) * 100) : 0;
  return el("div", {
    class: safeValue > safeMax && safeMax > 0 ? "progress over" : "progress",
    role: "progressbar",
    "aria-valuemin": "0",
    "aria-valuemax": String(safeMax),
    "aria-valuenow": String(Math.min(safeValue, safeMax)),
    "aria-label": label,
    style: color ? `--progress-color:${color}` : null
  }, el("span", { style: `width:${percent}%` }));
}

// Full-screen image viewer. Tap anywhere to dismiss.
export function lightbox(src) {
  const overlay = el("div", { class: "lightbox",
    role: "dialog", "aria-label": "Receipt photo" });
  overlay.appendChild(el("img", { src, alt: "Receipt" }));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unlockScroll();
    setOpen(overlay, false);
    const done = () => overlay.remove();
    overlay.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 320);
  };
  overlay.addEventListener("click", close);
  lockScroll();
  document.body.appendChild(overlay);
  raf(() => setOpen(overlay, true));
}

// Receipt photo picker. Imports the downscaler lazily so this module stays
// importable where the browser image APIs are absent. Returns
// { element, get } where get() yields the data URL or null.
export function receiptPicker(initial = null) {
  let value = null;
  const input = el("input", {
    type: "file", accept: "image/*", capture: "environment"
  });
  const thumb = el("img", { class: "receipt-thumb", alt: "Receipt preview" });
  thumb.style.display = "none";
  const status = el("div", { class: "muted" });
  const removeBtn = el("button", { class: "btn-text danger", type: "button" }, "Remove");
  removeBtn.style.display = "none";

  function show(src) {
    value = src;
    if (src) {
      thumb.src = src;
      thumb.style.display = "";
      removeBtn.style.display = "";
      status.textContent = "";
    } else {
      thumb.removeAttribute("src");
      thumb.style.display = "none";
      removeBtn.style.display = "none";
      input.value = "";
    }
  }
  removeBtn.addEventListener("click", () => show(null));
  thumb.addEventListener("click", () => value && lightbox(value));
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = "Processing photo…";
    try {
      const { fileToScaledDataURL } = await import("../domain/image.js");
      show(await fileToScaledDataURL(file));
    } catch (e) {
      status.textContent = e.message || "Could not load the photo.";
    }
  });

  if (initial) show(initial);

  const element = el("div", { class: "field" }, [
    el("label", {}, t("Receipt photo")),
    input, thumb, removeBtn, status
  ]);
  return { element, get: () => value };
}
