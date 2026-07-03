/* ===== シエナ・ガイド アプリ ===== */
(function () {
  "use strict";
  var DATA = window.SIENA_DATA || { restaurants: [], foods: [], attractions: [] };
  var PROJ = window.SIENA_PROJ || {};
  var BASE_MAP = "images/map/siena-base.jpg";

  var foodById = index(DATA.foods);
  var restById = index(DATA.restaurants);
  var attrById = index(DATA.attractions);

  function index(arr) {
    var m = {};
    (arr || []).forEach(function (x) { m[x.id] = x; });
    return m;
  }

  var ZONE_ORDER = [
    "カンポ広場周辺", "ドゥオモ周辺", "サン・ドメニコ／フォンテブランダ",
    "サン・フランチェスコ／北東部", "メディチ要塞／北西部", "南部・外周部"
  ];

  var TABS = ["restaurants", "foods", "attractions", "map", "districts"];
  var LIST_TABS = { restaurants: 1, foods: 1, attractions: 1 };
  var state = { tab: "restaurants", q: "", tag: null };

  var els = {
    search: document.getElementById("search"),
    searchClear: document.getElementById("search-clear"),
    tagbar: document.getElementById("tagbar"),
    resultCount: document.getElementById("result-count"),
    resetBtn: document.getElementById("reset-filters"),
    emptyState: document.getElementById("empty-state"),
    toolbar: document.getElementById("toolbar"),
    modal: document.getElementById("modal"),
    modalBody: document.getElementById("modal-body")
  };

  /* ---------- リンク ---------- */
  function mapUrl(q) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q); }
  function imgSearchUrl(q) { return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(q); }

  /* ---------- 画像 ---------- */
  function media(item, big) {
    var cls = big ? "m-hero" : "card-media";
    var name = escapeHtml(item.name);
    var ph = '<div class="ph">' + name + "</div>";
    if (!item.image) return '<div class="' + cls + '">' + ph + "</div>";
    var img = '<img src="' + escapeAttr(item.image) + '" alt="' + name +
      '" loading="lazy" onerror="this.parentNode.innerHTML=\'<div class=&quot;ph&quot;>' +
      escapeAttr(name) + '</div>\'">';
    return '<div class="' + cls + '">' + img + "</div>";
  }

  /* ---------- 位置ミニマップ（基準地図＋点） ---------- */
  function locMapHtml(id, type, variant) {
    var p = PROJ[id];
    if (!p) return "";
    var dotCls = "loc-dot" + (type === "attractions" ? " attr" : "");
    return '<div class="loc-map ' + (variant || "card-loc") + '">' +
      '<img src="' + BASE_MAP + '" alt="シエナ地図上の位置" loading="lazy">' +
      '<span class="' + dotCls + '" style="left:' + p.x + '%;top:' + p.y + '%"></span>' +
      "</div>";
  }
  function zoneMiniMap(items) {
    var dots = items.map(function (it) {
      var p = PROJ[it.id]; if (!p) return "";
      var cls = "loc-dot sm" + (it._type === "attractions" ? " attr" : "");
      return '<span class="' + cls + '" style="left:' + p.x + '%;top:' + p.y + '%"></span>';
    }).join("");
    return '<div class="loc-map district-mini" style="height:150px"><img src="' + BASE_MAP +
      '" alt="地区の位置" style="height:150px;width:auto" loading="lazy">' + dots + "</div>";
  }

  /* ---------- カード ---------- */
  function cardHtml(item, type) {
    var badgeArr = (item.badges || []).slice(0, 2).map(function (b, i) {
      return '<span class="badge' + (i === 0 ? " gold" : "") + '">' + escapeHtml(b) + "</span>";
    });
    if (item.candidate) badgeArr.unshift('<span class="badge cand">🍖 ディナー候補</span>');
    var badges = badgeArr.join("");
    var cats = (item.categories || []).map(function (c) {
      return '<span class="cat-pill">' + escapeHtml(c) + "</span>";
    }).join("");
    if (type === "foods") cats = '<span class="cat-pill">' + escapeHtml(item.type || "") + "</span>";

    var metaBits = [];
    if (item.price) metaBits.push('<span>💰 ' + escapeHtml(item.price) + "</span>");
    if (item.reservation) metaBits.push('<span class="resv">🎫 ' + escapeHtml(item.reservation) + "</span>");
    if (item.zone) metaBits.push('<span class="zone-chip-inline">📍 ' + escapeHtml(item.zone) + "</span>");
    else if (item.area) metaBits.push('<span>📍 ' + escapeHtml(item.area) + "</span>");
    if (type === "foods" && item.restaurants) metaBits.push('<span>🍽️ ' + item.restaurants.length + "軒で提供</span>");

    var tags = (item.tags || []).slice(0, 4).map(function (t) {
      return '<span class="mini-tag">' + escapeHtml(t) + "</span>";
    }).join("");

    var loc = "";
    if (type !== "foods" && PROJ[item.id]) {
      loc = '<div class="card-loc-wrap">' + locMapHtml(item.id, type, "card-loc") +
        '<div><div class="zone-chip">📍 ' + escapeHtml(item.zone || "") + "</div>" +
        (item.area ? '<div class="zone-sub">' + escapeHtml(item.area) + "</div>" : "") + "</div></div>";
    }

    return '<article class="card" data-id="' + item.id + '" data-type="' + type + '">' +
      media(item, false).replace('class="card-media">',
        'class="card-media">' + (badges ? '<div class="card-badges">' + badges + "</div>" : "") +
        (cats ? '<div class="card-cats">' + cats + "</div>" : "")) +
      '<div class="card-body">' +
        '<h2 class="card-title">' + escapeHtml(item.name) + "</h2>" +
        (item.nameOrig ? '<div class="card-orig">' + escapeHtml(item.nameOrig) + "</div>" : "") +
        '<p class="card-summary">' + escapeHtml(item.summary || item.highlights || "") + "</p>" +
        (metaBits.length ? '<div class="card-meta">' + metaBits.join("") + "</div>" : "") +
        (tags ? '<div class="card-tags">' + tags + "</div>" : "") +
        loc +
      "</div>" +
    "</article>";
  }

  /* ---------- フィルタ ---------- */
  function currentList() {
    if (state.tab === "restaurants") return DATA.restaurants;
    if (state.tab === "foods") return DATA.foods;
    if (state.tab === "attractions") return DATA.attractions;
    return [];
  }
  function searchText(item) {
    return [item.name, item.nameOrig, item.summary, item.highlights, item.history,
      item.howToEat, item.area, item.zone, item.address, item.price, item.reviews,
      (item.tags || []).join(" "), (item.categories || []).join(" "),
      (item.badges || []).join(" "), (item.specialties || []).join(" "), item.type
    ].join(" ").toLowerCase();
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return currentList().filter(function (item) {
      if (state.tag && (item.tags || []).indexOf(state.tag) === -1) return false;
      if (q && searchText(item).indexOf(q) === -1) return false;
      return true;
    });
  }

  /* ---------- タグ ---------- */
  var tagsExpanded = false, TAG_LIMIT = 12;
  function buildTagbar() {
    if (!LIST_TABS[state.tab]) { els.tagbar.innerHTML = ""; return; }
    var counts = {};
    currentList().forEach(function (item) {
      (item.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var shown = tags;
    if (!tagsExpanded && tags.length > TAG_LIMIT) {
      shown = tags.slice(0, TAG_LIMIT);
      if (state.tag && shown.indexOf(state.tag) === -1) shown = [state.tag].concat(shown);
    }
    var html = shown.map(function (t) {
      var active = state.tag === t ? " is-active" : "";
      return '<button class="tag-chip' + active + '" data-tag="' + escapeAttr(t) + '">' +
        escapeHtml(t) + " <span style=\"opacity:.6\">" + counts[t] + "</span></button>";
    }).join("");
    if (tags.length > TAG_LIMIT) {
      html += '<button class="tag-chip tag-toggle" data-toggle-tags="1">' +
        (tagsExpanded ? "▲ 閉じる" : "＋ タグをすべて表示 (" + tags.length + ")") + "</button>";
    }
    els.tagbar.innerHTML = html;
  }

  /* ---------- 描画ルーティング ---------- */
  function showActivePanel() {
    TABS.forEach(function (t) {
      var el = document.getElementById("panel-" + t);
      if (el) el.classList.toggle("is-active", t === state.tab);
    });
    els.toolbar.style.display = LIST_TABS[state.tab] ? "" : "none";
  }
  function render() {
    showActivePanel();
    if (LIST_TABS[state.tab]) return renderList();
    els.emptyState.hidden = true;
    if (state.tab === "map") renderMap();
    if (state.tab === "districts") renderDistricts();
  }
  function renderList() {
    var list = filtered();
    var panel = document.getElementById("panel-" + state.tab);
    panel.innerHTML = list.map(function (item) { return cardHtml(item, state.tab); }).join("");
    els.emptyState.hidden = list.length !== 0;
    els.resultCount.textContent = list.length + " 件";
    var hasFilter = state.q || state.tag;
    els.resetBtn.hidden = !hasFilter;
    els.searchClear.hidden = !state.q;
  }

  /* ---------- Leaflet 統合マップ ---------- */
  var lmap = null, markerLayer = null, mapReady = false;
  function withType(o, t) { o._type = t; return o; }
  function allPlaces() {
    return DATA.restaurants.map(function (r) { return withType(r, "restaurants"); })
      .concat(DATA.attractions.map(function (a) { return withType(a, "attractions"); }))
      .filter(function (x) { return x.lat && x.lng; });
  }
  function presentZones() {
    var set = {};
    allPlaces().forEach(function (p) { if (p.zone) set[p.zone] = 1; });
    return ZONE_ORDER.filter(function (z) { return set[z]; });
  }
  function ensureMap() {
    if (mapReady || typeof L === "undefined") return;
    lmap = L.map("leaflet-map", { zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(lmap);
    markerLayer = L.layerGroup().addTo(lmap);
    lmap.fitBounds(allPlaces().map(function (p) { return [p.lat, p.lng]; }), { padding: [30, 30] });
    mapReady = true;
    buildZoneSelect();
  }
  function buildZoneSelect() {
    var sel = document.getElementById("mc-zone");
    if (!sel || sel.dataset.built) return;
    sel.innerHTML = '<option value="">すべての地区</option>' +
      presentZones().map(function (z) { return '<option value="' + escapeAttr(z) + '">' + escapeHtml(z) + "</option>"; }).join("");
    sel.dataset.built = "1";
  }
  function refreshMarkers() {
    if (!mapReady) return;
    markerLayer.clearLayers();
    var showRest = document.getElementById("mc-rest").checked;
    var showAttr = document.getElementById("mc-attr").checked;
    var zone = document.getElementById("mc-zone").value;
    var shown = [];
    allPlaces().forEach(function (p) {
      if (p._type === "restaurants" && !showRest) return;
      if (p._type === "attractions" && !showAttr) return;
      if (zone && p.zone !== zone) return;
      var color = p._type === "restaurants" ? "#c0392b" : "#1f5fbf";
      var m = L.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 });
      m.bindPopup(popupHtml(p), { minWidth: 190, closeButton: true });
      markerLayer.addLayer(m);
      shown.push(p);
    });
    if (zone && shown.length) {
      lmap.fitBounds(shown.map(function (p) { return [p.lat, p.lng]; }), { padding: [40, 40], maxZoom: 17 });
    }
  }
  function popupHtml(p) {
    var img = p.image
      ? '<img src="' + escapeAttr(p.image) + '" alt="" onerror="this.outerHTML=\'<div class=&quot;pop-ph&quot;>' + escapeAttr(p.name) + '</div>\'">'
      : '<div class="pop-ph">' + escapeHtml(p.name) + "</div>";
    var cat = (p.categories || []).slice(0, 2).join(" / ");
    var typeLabel = p._type === "restaurants" ? "レストラン" : "観光";
    return '<div class="pop">' + img + "<b>" + escapeHtml(p.name) + "</b>" +
      '<div class="pop-meta">' + escapeHtml(typeLabel + (cat ? " · " + cat : "") + (p.zone ? " · " + p.zone : "")) + "</div>" +
      '<button class="pop-btn" data-goto="' + p._type + ":" + p.id + '">詳細を見る</button></div>';
  }
  function renderMap() {
    ensureMap();
    if (lmap) setTimeout(function () { lmap.invalidateSize(); refreshMarkers(); }, 60);
  }

  /* ---------- 地区パネル ---------- */
  function renderDistricts() {
    var panel = document.getElementById("panel-districts");
    var byZone = {};
    allPlaces().forEach(function (p) { (byZone[p.zone] = byZone[p.zone] || []).push(p); });
    panel.innerHTML = presentZones().map(function (z) {
      var items = byZone[z] || [];
      var rc = items.filter(function (i) { return i._type === "restaurants"; }).length;
      var ac = items.filter(function (i) { return i._type === "attractions"; }).length;
      var list = items.map(function (i) {
        var ico = i._type === "restaurants" ? "rest" : "attr";
        var emo = i._type === "restaurants" ? "🍽" : "🏛";
        var cat = (i.categories || [])[0] || i.type || "";
        return '<div class="dl-item" data-goto="' + i._type + ":" + i.id + '">' +
          '<span class="dl-ico ' + ico + '">' + emo + "</span>" +
          '<span class="dl-name">' + escapeHtml(i.name) + ' <span class="dl-cat">' + escapeHtml(cat) + "</span></span></div>";
      }).join("");
      return '<div class="district">' +
        '<div class="district-head"><h2>' + escapeHtml(z) + "</h2>" +
          '<span class="cnt">🍽 ' + rc + " ・ 🏛 " + ac + "</span>" +
          '<button class="district-map-btn" data-zone-map="' + escapeAttr(z) + '">マップで見る</button></div>' +
        '<div class="district-body"><div class="district-mini-wrap">' + zoneMiniMap(items) + "</div>" +
          '<div class="district-list">' + list + "</div></div></div>";
    }).join("");
  }

  /* ---------- モーダル ---------- */
  function openModal(type, id) {
    var item = (type === "restaurants" ? restById : type === "foods" ? foodById : attrById)[id];
    if (!item) return;
    els.modalBody.innerHTML =
      (type === "restaurants" ? restaurantModal(item) :
       type === "foods" ? foodModal(item) : attractionModal(item));
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    els.modal.querySelector(".modal-dialog").scrollTop = 0;
  }
  function closeModal() { els.modal.hidden = true; document.body.style.overflow = ""; }

  function catsHtml(item, type) {
    var cats = (item.categories || []).slice();
    if (type === "foods" && item.type) cats = [item.type];
    var c = cats.map(function (x) { return '<span class="cat-pill">' + escapeHtml(x) + "</span>"; }).join("");
    var b = (item.badges || []).map(function (x) { return '<span class="badge gold" style="position:static">' + escapeHtml(x) + "</span>"; }).join("");
    return '<div class="m-cats">' + c + b + "</div>";
  }
  function sectionText(title, body) { return body ? '<div class="m-section"><h3>' + title + '</h3><p>' + escapeHtml(body) + "</p></div>" : ""; }
  function sectionList(title, arr) {
    if (!arr || !arr.length) return "";
    return '<div class="m-section"><h3>' + title + '</h3><ul class="m-list">' +
      arr.map(function (x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("") + "</ul></div>";
  }
  function locSection(item, type) {
    if (!PROJ[item.id]) return "";
    return '<div class="m-section"><h3>場所</h3>' +
      (item.zone ? '<p style="margin-bottom:8px"><span class="zone-chip-inline">📍 ' + escapeHtml(item.zone) + "</span>" +
        (item.area ? " " + escapeHtml(item.area) : "") + "</p>" : "") +
      locMapHtml(item.id, type, "modal-loc") + "</div>";
  }
  function mapChip(item) {
    var href = item.gmap ? item.gmap : mapUrl(item.mapQuery || item.name + " Siena Italy");
    var link = '<a class="link-chip map" href="' + escapeAttr(href) +
      '" target="_blank" rel="noopener">🗺️ Googleマップで開く</a>';
    var imgs = '<a class="link-chip" href="' + imgSearchUrl((item.nameOrig || item.name) + " Siena") +
      '" target="_blank" rel="noopener">📷 写真を検索</a>';
    var site = item.site ? '<a class="link-chip primary" href="' + escapeAttr(item.site) +
      '" target="_blank" rel="noopener">🔗 公式サイト</a>' : "";
    return '<div class="m-section"><h3>リンク</h3><div class="link-chips">' + link + imgs + site + "</div></div>";
  }
  function dishXref(item) {
    var ids = (item.dishes || []).filter(function (d) { return foodById[d]; });
    if (!ids.length) return "";
    var chips = ids.map(function (d) {
      return '<span class="xref-item" data-goto="foods:' + foodById[d].id + '"><span class="x-ico">🍝</span>' + escapeHtml(foodById[d].name) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>食べられる郷土料理</h3><div class="xref">' + chips + "</div></div>";
  }
  function restXref(item, label) {
    var ids = (item.restaurants || item.nearRestaurants || []).filter(function (r) { return restById[r]; });
    if (!ids.length) return "";
    var chips = ids.map(function (r) {
      return '<span class="xref-item" data-goto="restaurants:' + restById[r].id + '"><span class="x-ico">🍽️</span>' + escapeHtml(restById[r].name) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>' + (label || "提供しているレストラン") + '</h3><div class="xref">' + chips + "</div></div>";
  }
  function foodXref(item) {
    var ids = (item.nearFood || []).filter(function (f) { return foodById[f]; });
    if (!ids.length) return "";
    var chips = ids.map(function (f) {
      return '<span class="xref-item" data-goto="foods:' + foodById[f].id + '"><span class="x-ico">🍝</span>' + escapeHtml(foodById[f].name) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>近くで味わえる名物</h3><div class="xref">' + chips + "</div></div>";
  }
  function tagsHtml(item) {
    if (!item.tags || !item.tags.length) return "";
    var chips = item.tags.map(function (t) {
      return '<span class="xref-item" data-tag-jump="' + escapeAttr(t) + '">#' + escapeHtml(t) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>タグ</h3><div class="xref">' + chips + "</div></div>";
  }
  function row(dt, dd) { return dd ? "<dt>" + dt + "</dt><dd>" + escapeHtml(dd) + "</dd>" : ""; }

  function restaurantModal(item) {
    var info = '<dl class="m-info">' +
      row("カテゴリー", (item.categories || []).join(" / ")) + row("価格帯", item.price) +
      (item.reservation ? '<dt>予約</dt><dd class="resv-dd">' + escapeHtml(item.reservation) + "</dd>" : "") +
      row("営業時間", item.hours) + row("定休", item.closed) +
      row("地区", item.zone) + row("住所", item.address) + "</dl>";
    return media(item, true) + '<div class="m-content">' +
      '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
      '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + "</div>" +
      catsHtml(item, "restaurants") + info +
      sectionText("特徴・いいところ", item.highlights) + sectionList("名物・おすすめ", item.specialties) +
      dishXref(item) + sectionText("レビュー", item.reviews) +
      locSection(item, "restaurants") + mapChip(item) + tagsHtml(item) + "</div>";
  }
  function foodModal(item) {
    return media(item, true) + '<div class="m-content">' +
      '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
      '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + " ・ " + escapeHtml(item.type || "") + "</div>" +
      catsHtml(item, "foods") +
      sectionText("概要", item.summary) + sectionText("歴史・詳細", item.history) +
      sectionText("食べ方・ペアリング", item.howToEat) + restXref(item, "どこで食べられる？") +
      '<div class="m-section"><h3>リンク</h3><div class="link-chips">' +
        '<a class="link-chip" href="' + imgSearchUrl(item.nameOrig + " food") + '" target="_blank" rel="noopener">📷 写真を検索</a>' +
      "</div></div>" + tagsHtml(item) + "</div>";
  }
  function attractionModal(item) {
    var info = '<dl class="m-info">' +
      row("カテゴリー", (item.categories || []).join(" / ")) + row("料金", item.price) +
      row("営業時間", item.hours) + row("地区", item.zone) + row("住所", item.address) + "</dl>";
    return media(item, true) + '<div class="m-content">' +
      '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
      '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + "</div>" +
      catsHtml(item, "attractions") + info +
      sectionText("見どころ", item.highlights) + sectionText("レビュー", item.reviews) +
      foodXref(item) + restXref(item, "近くのおすすめレストラン") +
      locSection(item, "attractions") + mapChip(item) + tagsHtml(item) + "</div>";
  }

  /* ---------- ユーティリティ ---------- */
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

  /* ---------- タブ切替 ---------- */
  function activateTabButtons(tab) {
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function switchTab(tab, keepFilters) {
    if (TABS.indexOf(tab) === -1) return;
    state.tab = tab;
    if (!keepFilters) { state.tag = null; state.q = ""; els.search.value = ""; }
    tagsExpanded = false;
    activateTabButtons(tab);
    buildTagbar();
    render();
    if (history.replaceState) history.replaceState(null, "", "#" + tab);
  }

  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (!btn) return;
    switchTab(btn.dataset.tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.search.addEventListener("input", function () { state.q = els.search.value; renderList(); });
  els.searchClear.addEventListener("click", function () { els.search.value = ""; state.q = ""; els.search.focus(); renderList(); });
  els.tagbar.addEventListener("click", function (e) {
    var toggle = e.target.closest("[data-toggle-tags]");
    if (toggle) { tagsExpanded = !tagsExpanded; buildTagbar(); return; }
    var chip = e.target.closest(".tag-chip");
    if (!chip || !chip.dataset.tag) return;
    var t = chip.dataset.tag;
    state.tag = state.tag === t ? null : t;
    buildTagbar(); renderList();
  });
  els.resetBtn.addEventListener("click", function () {
    state.q = ""; state.tag = null; els.search.value = ""; buildTagbar(); renderList();
  });

  document.addEventListener("change", function (e) {
    if (e.target && (e.target.id === "mc-rest" || e.target.id === "mc-attr" || e.target.id === "mc-zone")) refreshMarkers();
  });

  document.querySelector(".content").addEventListener("click", function (e) {
    var goto = e.target.closest("[data-goto]");
    if (goto) { var pr = goto.dataset.goto.split(":"); openModal(pr[0], pr[1]); return; }
    var zmap = e.target.closest("[data-zone-map]");
    if (zmap) {
      switchTab("map");
      setTimeout(function () {
        var sel = document.getElementById("mc-zone");
        if (sel) { sel.value = zmap.dataset.zoneMap; refreshMarkers(); }
      }, 140);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    var card = e.target.closest(".card");
    if (card) openModal(card.dataset.type, card.dataset.id);
  });

  els.modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    var goto = e.target.closest("[data-goto]");
    if (goto) { var pr = goto.dataset.goto.split(":"); openModal(pr[0], pr[1]); return; }
    var tagJump = e.target.closest("[data-tag-jump]");
    if (tagJump) {
      closeModal();
      var tag = tagJump.dataset.tagJump;
      if (!LIST_TABS[state.tab]) switchTab("restaurants");
      state.tag = tag; state.q = ""; els.search.value = "";
      buildTagbar(); renderList();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !els.modal.hidden) closeModal(); });

  /* ---------- 初期化 ---------- */
  function applyHash() {
    var h = (location.hash || "").replace("#", "");
    if (TABS.indexOf(h) !== -1 && h !== state.tab) switchTab(h);
    else if (TABS.indexOf(h) !== -1) render();
  }
  window.addEventListener("hashchange", applyHash);

  document.getElementById("count-restaurants").textContent = DATA.restaurants.length;
  document.getElementById("count-foods").textContent = DATA.foods.length;
  document.getElementById("count-attractions").textContent = DATA.attractions.length;
  var dcount = document.getElementById("count-districts");
  if (dcount) dcount.textContent = presentZones().length;

  buildTagbar();
  render();
  applyHash();
})();
