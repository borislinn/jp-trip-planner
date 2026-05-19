import {
  epochToZonedWallClock, formatInstant, zonedWallClockToEpoch
} from "../domain/datetime.js";
import { CUISINES, OSAKA_AREAS, optionLabel, t } from "../domain/i18n.js";
import {
  RestaurantsViewModel,
  RESTAURANT_STATUSES
} from "../viewmodels/RestaurantsViewModel.js";
import {
  el, empty, emptyAction, field, openSheet, toast, mapsUrl, confirmDialog
} from "./components.js";

const JAPAN_TZ = "Asia/Tokyo";

export async function render(root, header, repo) {
  const vm = new RestaurantsViewModel(repo);
  let filter = "All";
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
    openSheet(close => el("div", { class: "restaurant-detail" }, [
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
          onclick: () => { close(); addSheet(restaurant); } }, t("Edit"))
      ]),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-secondary danger", type: "button",
          onclick: async () => {
            const ok = await confirmDialog({
              title: t("Delete restaurant?"),
              message: restaurant.name
            });
            if (!ok) return;
            await vm.deleteRestaurant(restaurant.id);
            close();
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

  function filterBar() {
    const options = ["All", ...RESTAURANT_STATUSES];
    return el("div", { class: "restaurant-filters", role: "tablist",
      "aria-label": t("Filter by status") },
      options.map(option => el("button", {
        class: option === filter
          ? "restaurant-filter is-selected" : "restaurant-filter",
        type: "button",
        role: "tab",
        "aria-selected": String(option === filter),
        onclick: () => { filter = option; paint(); }
      }, t(option))));
  }

  function visibleRestaurants() {
    return filter === "All"
      ? vm.restaurants
      : vm.restaurants.filter(r => r.status === filter);
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
    root.appendChild(filterBar());
    const shown = visibleRestaurants();
    if (!shown.length) {
      root.appendChild(empty(t("No restaurants match this filter.")));
      return;
    }
    for (const restaurant of shown) {
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

  function addSheet(existing = null) {
    openSheet(close => {
      const name = el("input", { type: "text",
        autocomplete: "organization", autocapitalize: "words" });
      const cuisine = optionSelect(CUISINES, t("Type of Cuisine"));
      const area = optionSelect(OSAKA_AREAS, t("Area"));
      const mapUrl = el("input", { type: "url", inputmode: "url",
        autocomplete: "url", autocapitalize: "none", autocorrect: "off",
        spellcheck: "false", placeholder: "https://maps.google.com/..." });
      const reservation = el("input", { type: "datetime-local" });
      const status = statusSelect();
      const notes = el("textarea", { rows: "4", autocapitalize: "sentences",
        placeholder: t("Confirmation, must-order dishes, queue rules...") });
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });
      if (existing) {
        name.value = existing.name || "";
        cuisine.value = existing.cuisine || "";
        area.value = existing.area || "";
        mapUrl.value = existing.mapUrl || "";
        reservation.value = existing.reservationEpoch
          ? epochToZonedWallClock(existing.reservationEpoch, JAPAN_TZ) : "";
        status.value = existing.status || "Want to go";
        notes.value = existing.notes || "";
      }
      return el("div", {}, [
        el("h3", {}, existing ? t("Edit Restaurant") : t("New Restaurant")),
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
            id: existing?.id,
            name: name.value,
            cuisine: cuisine.value,
            area: area.value,
            mapUrl: mapUrl.value,
            reservationEpoch: reservation.value
              ? zonedWallClockToEpoch(reservation.value, JAPAN_TZ)
              : null,
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
