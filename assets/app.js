/* Ridgeway Market — shop, basket and checkout. No dependencies. */
(function () {
  "use strict";

  var STORE_KEY = "ridgeway.basket.v1";
  var FREE_DELIVERY_OVER = 40;
  var SAMPLE = { p01: 1, p10: 2, p07: 1, p11: 1 };

  var state = {
    basket: load(),
    sample: false,
    aisle: null,
    query: "",
    slot: "s3",
    order: null
  };

  if (!state.basket) { state.basket = Object.assign({}, SAMPLE); state.sample = true; }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state.basket)); } catch (e) { /* private mode */ }
  }

  /* ---------- money ---------- */
  function money(n) {
    return (n < 0 ? "-£" : "£") + Math.abs(n).toFixed(2);
  }
  function product(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) return PRODUCTS[i]; }
    return null;
  }
  function slot(id) {
    for (var i = 0; i < SLOTS.length; i++) { if (SLOTS[i].id === id) return SLOTS[i]; }
    return SLOTS[0];
  }

  function totals() {
    var subtotal = 0, saved = 0, count = 0;
    Object.keys(state.basket).forEach(function (id) {
      var p = product(id), q = state.basket[id];
      if (!p || !q) return;
      subtotal += p.price * q;
      if (p.was) saved += (p.was - p.price) * q;
      count += q;
    });
    var fee = subtotal >= FREE_DELIVERY_OVER || subtotal === 0 ? 0 : slot(state.slot).fee;
    return { subtotal: subtotal, saved: saved, count: count, fee: fee, total: subtotal + fee };
  }

  /* ---------- basket actions ---------- */
  function setQty(id, qty) {
    if (qty > 0) { state.basket[id] = Math.min(qty, 99); } else { delete state.basket[id]; }
    state.sample = false;
    state.order = null;
    save();
    render();
    announce();
  }
  function announce() {
    var t = totals();
    document.getElementById("live").textContent =
      t.count + (t.count === 1 ? " item" : " items") + " in basket, " + money(t.total) + " to pay.";
  }

  /* ---------- rendering ---------- */
  function matches(p) {
    if (state.aisle && p.aisle !== state.aisle) return false;
    if (!state.query) return true;
    var q = state.query.toLowerCase();
    var aisleName = AISLES.filter(function (a) { return a.id === p.aisle; })[0].name;
    return (p.name + " " + p.size + " " + aisleName).toLowerCase().indexOf(q) > -1;
  }

  function renderRail() {
    var rail = document.getElementById("rail");
    var counts = {};
    PRODUCTS.forEach(function (p) { if (!state.query || matches(p) || state.aisle) counts[p.aisle] = (counts[p.aisle] || 0) + 1; });

    var html = '<div class="rail__head label">Aisles</div>';
    html += aisleButton(null, "0", "Whole store", PRODUCTS.length);
    AISLES.forEach(function (a) {
      html += aisleButton(a.id, String(a.no), a.name, counts[a.id] || 0);
    });
    rail.innerHTML = html;
  }
  function aisleButton(id, no, name, ct) {
    var on = state.aisle === id;
    return '<button class="aisle" type="button" aria-pressed="' + on + '" data-aisle="' + (id || "") + '">' +
      '<span class="aisle__no">' + (id ? no.padStart(2, "0") : "—") + '</span>' +
      '<span>' + name + '</span>' +
      '<span class="aisle__ct">' + ct + '</span></button>';
  }

  function renderGrid() {
    var list = PRODUCTS.filter(matches);
    var head = document.getElementById("gridHead");
    var name = state.aisle ? AISLES.filter(function (a) { return a.id === state.aisle; })[0].name : "Whole store";
    head.innerHTML = '<h2>' + name + '</h2><span class="label">' + list.length + ' lines' +
      (state.query ? ' matching “' + escapeHtml(state.query) + '”' : '') + '</span>';

    var grid = document.getElementById("grid");
    if (!list.length) {
      grid.innerHTML = '<li class="empty">Nothing on the shelf for that. Try a different word, or browse the whole store.</li>';
      return;
    }
    grid.innerHTML = list.map(function (p) {
      var qty = state.basket[p.id] || 0;
      var tag = p.badge === "offer" ? '<span class="tag tag--offer">Offer</span>'
        : p.badge === "new" ? '<span class="tag tag--new">New</span>'
        : p.badge === "own" ? '<span class="tag">Own brand</span>' : '';
      return '<li class="item">' +
        '<div class="item__top"><span class="item__pic" aria-hidden="true">' + p.emoji + '</span>' + tag + '</div>' +
        '<div><div class="item__name">' + p.name + '</div>' +
        '<div class="item__size">' + p.size + '</div></div>' +
        '<div><div class="shelf"><span class="shelf__price">' + money(p.price) + '</span>' +
        (p.was ? '<span class="shelf__was">' + money(p.was) + '</span>' : '') + '</div>' +
        '<div class="shelf__unit">' + p.unit + '</div></div>' +
        (qty
          ? '<div class="stepper"><button type="button" data-less="' + p.id + '" aria-label="One fewer ' + p.name + '">−</button>' +
            '<output aria-label="' + p.name + ' in basket">' + qty + '</output>' +
            '<button type="button" data-more="' + p.id + '" aria-label="One more ' + p.name + '">+</button></div>'
          : '<button class="add" type="button" data-more="' + p.id + '">Add to basket</button>') +
        '</li>';
    }).join("");
  }

  function renderBasket() {
    var t = totals();
    document.getElementById("jumpCount").textContent = t.count;
    document.getElementById("jumpTotal").textContent = money(t.total);

    var lines = document.getElementById("lines");
    var ids = Object.keys(state.basket);
    if (!ids.length) {
      lines.innerHTML = '<li class="empty" style="padding:1rem .9rem">Your basket is empty. Add something from the shelves.</li>';
    } else {
      lines.innerHTML = ids.map(function (id) {
        var p = product(id), q = state.basket[id];
        return '<li class="line"><span class="line__name">' + p.name + '</span>' +
          '<span class="line__cost">' + money(p.price * q) + '</span>' +
          '<span class="line__meta">' + q + ' × ' + money(p.price) + ' · ' + p.size +
          ' · <button class="line__drop" type="button" data-drop="' + id + '">remove</button></span></li>';
      }).join("");
    }

    document.getElementById("sumGoods").textContent = money(t.subtotal);
    var savedRow = document.getElementById("sumSavedRow");
    savedRow.hidden = t.saved <= 0;
    document.getElementById("sumSaved").textContent = "−" + money(t.saved);
    document.getElementById("sumFee").textContent = t.fee === 0 ? "Free" : money(t.fee);
    document.getElementById("sumTotal").textContent = money(t.total);

    var toGo = FREE_DELIVERY_OVER - t.subtotal;
    document.getElementById("progFill").style.width =
      Math.min(100, (t.subtotal / FREE_DELIVERY_OVER) * 100) + "%";
    document.getElementById("progNote").textContent = toGo > 0
      ? "Spend " + money(toGo) + " more for free delivery"
      : "Free delivery unlocked";

    document.getElementById("slots").innerHTML = SLOTS.map(function (s) {
      var on = s.id === state.slot;
      return '<li><button class="slot" type="button" aria-pressed="' + on + '" data-slot="' + s.id + '">' +
        '<span class="slot__when">' + s.day + ', ' + s.window + '</span>' +
        '<span class="slot__fee' + (s.fee === 0 ? ' slot__fee--free' : '') + '">' + (s.fee === 0 ? "Free" : money(s.fee)) + '</span>' +
        '<span class="slot__left">' + s.left + ' slots left</span></button></li>';
    }).join("");

    document.getElementById("checkout").disabled = t.count === 0;
    document.getElementById("checkout").textContent = t.count === 0
      ? "Basket empty" : "Place order · " + money(t.total);

    var foot = document.getElementById("paneFoot");
    foot.innerHTML = state.sample
      ? 'Sample basket, so you can see the totals working. <button type="button" id="clear">Empty it</button>'
      : (t.count ? '<button type="button" id="clear">Empty basket</button>' : 'Prices shown include VAT where it applies.');

    var receipt = document.getElementById("receiptCard");
    receipt.hidden = !state.order;
    if (state.order) document.getElementById("receipt").textContent = state.order;
  }

  function placeOrder() {
    var t = totals(), s = slot(state.slot);
    var no = "RM-" + String(Math.floor(Math.random() * 9000) + 1000);
    state.order = [
      "ORDER " + no,
      "Ridgeway Market · Bridge Street",
      "",
      t.count + " items          " + money(t.subtotal),
      "Delivery            " + (t.fee === 0 ? "Free" : money(t.fee)),
      "TOTAL               " + money(t.total),
      "",
      "Arriving " + s.day.toLowerCase() + ", " + s.window,
      t.saved > 0 ? "You saved " + money(t.saved) + " on offers." : "No offers in this basket."
    ].join("\n");
    render();
    document.getElementById("receiptCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function render() { renderRail(); renderGrid(); renderBasket(); }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("button");
    if (!el) return;
    if (el.dataset.more) { setQty(el.dataset.more, (state.basket[el.dataset.more] || 0) + 1); }
    else if (el.dataset.less) { setQty(el.dataset.less, (state.basket[el.dataset.less] || 0) - 1); }
    else if (el.dataset.drop) { setQty(el.dataset.drop, 0); }
    else if (el.dataset.slot) { state.slot = el.dataset.slot; state.order = null; render(); }
    else if (el.hasAttribute("data-aisle")) { state.aisle = el.dataset.aisle || null; render(); }
    else if (el.id === "clear") { state.basket = {}; state.sample = false; state.order = null; save(); render(); announce(); }
    else if (el.id === "checkout") { placeOrder(); }
    else if (el.id === "jump") { document.getElementById("pane").scrollIntoView({ behavior: "smooth", block: "start" }); }
  });

  document.getElementById("q").addEventListener("input", function (e) {
    state.query = e.target.value.trim();
    if (state.query) state.aisle = null;
    render();
  });

  render();
})();
