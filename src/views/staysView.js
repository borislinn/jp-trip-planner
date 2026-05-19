import { StaysViewModel } from "../viewmodels/StaysViewModel.js";
import { dayLabel } from "../domain/datetime.js";
import { t } from "../domain/i18n.js";
import {
  el, emptyAction, openSheet, field, pickerInput, toast, mapsUrl, confirmDialog
} from "./components.js";

export async function render(root, header, repo) {
  const vm = new StaysViewModel(repo);
  let selectedStayId = null;
  await vm.load();

  function selectedStay() {
    return vm.stays.find(s => s.id === selectedStayId) || null;
  }

  function setListHeader() {
    header.setTitle(t("Stays"));
    header.setActions([
      el("button", { class: "btn-text", "aria-label": t("Add stay"),
        onclick: () => addSheet() }, "＋")
    ]);
  }

  function setDetailHeader(stay) {
    header.setTitle(stay.hotelName);
    header.setActions([
      el("button", { class: "btn-text", type: "button", "aria-label": t("Back to stays"),
        onclick: () => { selectedStayId = null; paint(); } }, "‹"),
      el("button", { class: "btn-text", type: "button", "aria-label": t("Edit stay"),
        onclick: () => addSheet(stay) }, "✎"),
      el("button", { class: "btn-text danger", type: "button",
        "aria-label": `Delete stay at ${stay.hotelName}`, title: "Delete stay",
        onclick: async () => {
          const ok = await confirmDialog({
            title: t("Delete stay?"),
            message: stay.hotelName
          });
          if (!ok) return;
          await vm.deleteStay(stay.id);
          selectedStayId = null;
          paint();
        } }, "×")
    ]);
  }

  function stayCard(stay) {
    return el("button", {
      class: "card stay-card",
      type: "button",
      "aria-label": `View details for ${stay.hotelName}`,
      onclick: () => { selectedStayId = stay.id; paint(); }
    }, [
      el("strong", {}, stay.hotelName),
      el("div", { class: "muted" }, `${t("Check-in")}: ${dayLabel(stay.checkIn)}`),
      el("div", { class: "muted" }, `${t("Check-out")}: ${dayLabel(stay.checkOut)}`)
    ]);
  }

  function detailRow(label, value) {
    if (!value) return null;
    return el("div", { class: "detail-row" }, [
      el("span", {}, label),
      el("strong", {}, value)
    ]);
  }

  function stayDetail(stay) {
    return el("div", { class: "card stay-detail" }, [
      el("h2", {}, stay.hotelName),
      detailRow(t("Check-in"), dayLabel(stay.checkIn)),
      detailRow(t("Check-out"), dayLabel(stay.checkOut)),
      detailRow(t("Nights"), String(vm.nights(stay))),
      stay.address ? el("div", { class: "detail-row" }, [
        el("span", {}, t("Address")),
        el("a", {
          href: mapsUrl(stay.address),
          target: "_blank",
          rel: "noopener"
        }, stay.address)
      ]) : null,
      detailRow(t("Booking"), stay.bookingReference),
      stay.note ? el("div", { class: "detail-note" }, [
        el("span", {}, t("Note")),
        el("p", {}, stay.note)
      ]) : null
    ]);
  }

  function paint() {
    root.replaceChildren();
    const detail = selectedStay();
    if (detail) {
      setDetailHeader(detail);
      root.appendChild(stayDetail(detail));
      return;
    }

    setListHeader();
    if (!vm.stays.length) {
      root.appendChild(emptyAction(t("No stays yet — add the first hotel."),
        t("Add Stay"), () => addSheet()));
      return;
    }
    for (const s of vm.stays) {
      root.appendChild(stayCard(s));
    }
  }

  function dateValue(epoch) {
    const d = new Date(epoch);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function addSheet(existing = null) {
    openSheet(close => {
      const hotel = el("input", { type: "text",
        autocomplete: "organization", autocapitalize: "words" });
      const addr = el("input", { type: "text",
        autocomplete: "street-address", autocapitalize: "words" });
      const ref = el("input", { type: "text",
        autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
      const ci = pickerInput("date", {
        value: existing ? dateValue(existing.checkIn)
          : new Date().toISOString().slice(0, 10)
      });
      const co = pickerInput("date", {
        value: existing ? dateValue(existing.checkOut)
          : new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      });
      const note = el("textarea", { rows: "2", autocapitalize: "sentences" });
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });
      if (existing) {
        hotel.value = existing.hotelName || "";
        addr.value = existing.address || "";
        ref.value = existing.bookingReference || "";
        note.value = existing.note || "";
      }
      return el("div", {}, [
        el("h3", {}, existing ? t("Edit Stay") : t("New Stay")),
        field(t("Hotel name"), hotel), field(t("Address"), addr),
        field(t("Booking reference"), ref),
        field(t("Check-in"), ci.element), field(t("Check-out"), co.element),
        field(t("Note"), note),
        error,
        el("button", { class: "btn-primary", onclick: async () => {
          error.hidden = true;
          const ok = await vm.addStay({
            id: existing?.id,
            hotelName: hotel.value, address: addr.value,
            bookingReference: ref.value,
            checkIn: new Date(ci.input.value + "T12:00").getTime(),
            checkOut: new Date(co.input.value + "T12:00").getTime(),
            note: note.value });
          if (ok) { close(); paint(); toast(t("Stay saved")); }
          else {
            error.textContent = t(vm.lastError || "Enter a hotel name.");
            error.hidden = false;
            hotel.focus();
          }
        } }, t("Save"))
      ]);
    });
  }

  paint();
}
