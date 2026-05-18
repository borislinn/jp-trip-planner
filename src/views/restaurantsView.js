import { formatInstant } from "../domain/datetime.js";
import { CUISINES, OSAKA_AREAS, optionLabel, t } from "../domain/i18n.js";
import {
  RestaurantsViewModel,
  RESTAURANT_STATUSES
} from "../viewmodels/RestaurantsViewModel.js";
import {
  el, emptyAction, field, openSheet, toast, mapsUrl, confirmDialog
} from "./components.js";

const JAPAN_TZ = "Asia/Tokyo";

export async function render(root, header, repo) {
  const vm = new RestaurantsViewModel(repo);
  await vm.load();

  header.setTitle(t("Restaurants"));
  header.setActions([
    el("button", { class: "btn-text", "aria-label": t("Add restaurant"),
      onclick: () => addSheet() }, "＋")
  ]);

  const pad = value => String(value).padStart(2, "0");
  const localDateTimeValue = (date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`;

  function statusClass(status) {
    return status === "Reserved" ? "restaurant-status reserved" :
      status === "Visited" ? "restaurant-status visited" : "restaurant-status";
  }

  function openMap(restaurant) {
    window.location.href = restaurant.mapUrl || mapsUrl(restaurant.name);
  }

  function restaurantCard(restaurant) {
    return el("article", { class: "card restaurant-card" }, [
      el("div", { class: "restaurant-card__head" }, [
        el("div", {}, [
          restaurant.cuisine
            ? el("span", { class: "cuisine-pill" }, optionLabel(restaurant.cuisine))
            : null,
          el("h2", {}, restaurant.name),
          el("div", { class: "restaurant-meta" }, [
            restaurant.area ? el("span", {}, optionLabel(restaurant.area)) : null,
            restaurant.reservationEpoch
              ? el("span", {}, formatInstant(restaurant.reservationEpoch, JAPAN_TZ))
              : null
          ])
        ]),
        el("span", { class: statusClass(restaurant.status) }, t(restaurant.status))
      ]),
      restaurant.notes ? el("p", { class: "restaurant-notes" }, restaurant.notes) : null,
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: () => openMap(restaurant) }, t("Map")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => detailSheet(restaurant) }, t("Details"))
      ])
    ]);
  }

  function detailRow(label, value) {
    if (!value) return null;
    return el("div", { class: "detail-row" }, [
      el("span", {}, label),
      el("strong", {}, value)
    ]);
  }

  function detailSheet(restaurant) {
    openSheet(() => el("div", { class: "restaurant-detail" }, [
      el("h3", {}, restaurant.name),
      detailRow(t("Cuisine"), optionLabel(restaurant.cuisine)),
      detailRow(t("Status"), t(restaurant.status)),
      detailRow(t("Area"), optionLabel(restaurant.area)),
      detailRow(t("Reservation"), restaurant.reservationEpoch
        ? formatInstant(restaurant.reservationEpoch, JAPAN_TZ)
        : t("Not reserved")),
      detailRow(t("Map"), restaurant.mapUrl || mapsUrl(restaurant.name)),
      restaurant.notes ? el("div", { class: "detail-note" }, [
        el("span", {}, t("Notes")),
        el("p", {}, restaurant.notes)
      ]) : null,
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: () => openMap(restaurant) }, t("Open Map")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: async () => {
            const ok = await confirmDialog({
              title: t("Delete restaurant?"),
              message: restaurant.name
            });
            if (!ok) return;
            await vm.deleteRestaurant(restaurant.id);
            document.querySelector(".sheet-backdrop")?.remove();
            paint();
            toast(t("Restaurant deleted"));
          } }, t("Delete"))
      ])
    ]));
  }

  function emptyState() {
    return emptyAction(t("No restaurants saved."), t("Add Restaurant"),
      () => addSheet());
  }

  function paint() {
    root.replaceChildren();
    if (!vm.restaurants.length) {
      root.appendChild(emptyState());
      return;
    }
    root.appendChild(el("section", { class: "restaurant-summary" }, [
      el("span", { class: "eyebrow" }, t("Saved Places")),
      el("h2", {}, t("{count} restaurants", { count: vm.restaurants.length })),
      el("p", {}, t("Reservations, map links, cuisines, and notes."))
    ]));
    for (const restaurant of vm.restaurants) {
      root.appendChild(restaurantCard(restaurant));
    }
  }

  function statusSelect() {
    return el("select", {},
      RESTAURANT_STATUSES.map(status => el("option",
        status === "Want to go" ? { value: status, selected: "selected" } : { value: status },
        t(status))));
  }

  function optionSelect(options, placeholder) {
    return el("select", {}, [
      el("option", { value: "" }, placeholder),
      ...options.map(option => el("option", { value: option }, optionLabel(option)))
    ]);
  }

  function addSheet() {
    openSheet(close => {
      const name = el("input", { type: "text", autocomplete: "off" });
      const cuisine = optionSelect(CUISINES, t("Type of Cuisine"));
      const area = optionSelect(OSAKA_AREAS, t("Area"));
      const mapUrl = el("input", { type: "url", inputmode: "url",
        placeholder: "https://maps.google.com/..." });
      const reservation = el("input", { type: "datetime-local" });
      const status = statusSelect();
      const notes = el("textarea", { rows: "4",
        placeholder: t("Confirmation, must-order dishes, queue rules...") });
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });
      return el("div", {}, [
        el("h3", {}, t("New Restaurant")),
        field(t("Name of the Restaurant"), name),
        field(t("Type of Cuisine"), cuisine),
        field(t("Area"), area),
        field(t("Map / Google Maps Link"), mapUrl),
        field(t("Reservation Date & Time"), reservation),
        field(t("Status"), status),
        field(t("Notes"), notes),
        error,
        el("button", { class: "btn-primary", type: "button", onclick: async () => {
          error.hidden = true;
          const ok = await vm.addRestaurant({
            name: name.value,
            cuisine: cuisine.value,
            area: area.value,
            mapUrl: mapUrl.value,
            reservationEpoch: reservation.value ? new Date(reservation.value).getTime() : null,
            status: status.value,
            notes: notes.value
          });
          if (ok) { close(); paint(); toast(t("Restaurant saved")); }
          else {
            error.textContent = t(vm.lastError || "Enter a restaurant name.");
            error.hidden = false;
            name.focus();
          }
        } }, t("Save"))
      ]);
    });
  }

  paint();
}
