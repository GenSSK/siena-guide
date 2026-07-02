/* ===== シエナ・ガイド アプリ ===== */
(function () {
  "use strict";
  var DATA = window.SIENA_DATA || { restaurants: [], foods: [], attractions: [] };

  // 相互参照用の索引
  var foodById = index(DATA.foods);
  var restById = index(DATA.restaurants);
  var attrById = index(DATA.attractions);

  function index(arr) {
    var m = {};
    (arr || []).forEach(function (x) { m[x.id] = x; });
    return m;
  }

  var TABS = ["restaurants", "foods", "attractions"];
  var state = { tab: "restaurants", q: "", tag: null };

  var els = {
    search: document.getElementById("search"),
    searchClear: document.getElementById("search-clear"),
    tagbar: document.getElementById("tagbar"),
    resultCount: document.getElementById("result-count"),
    resetBtn: document.getElementById("reset-filters"),
    emptyState: document.getElementById("empty-state"),
    modal: document.getElementById("modal"),
    modalBody: document.getElementById("modal-body")
  };

  /* ---------- Google Maps ---------- */
  function mapUrl(q) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
  function imgSearchUrl(q) {
    return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(q);
  }

  /* ---------- 画像（失敗時はプレースホルダ） ---------- */
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

  /* ---------- カード生成 ---------- */
  function cardHtml(item, type) {
    var badges = (item.badges || []).slice(0, 2).map(function (b, i) {
      return '<span class="badge' + (i === 0 ? " gold" : "") + '">' + escapeHtml(b) + "</span>";
    }).join("");
    var cats = (item.categories || []).map(function (c) {
      return '<span class="cat-pill">' + escapeHtml(c) + "</span>";
    }).join("");
    if (type === "foods") {
      cats = '<span class="cat-pill">' + escapeHtml(item.type || "") + "</span>";
    }
    var metaBits = [];
    if (item.price) metaBits.push('<span>💰 ' + escapeHtml(item.price) + "</span>");
    if (item.area) metaBits.push('<span>📍 ' + escapeHtml(item.area) + "</span>");
    if (type === "foods" && item.restaurants) {
      metaBits.push('<span>🍽️ ' + item.restaurants.length + "軒で提供</span>");
    }
    var tags = (item.tags || []).slice(0, 4).map(function (t) {
      return '<span class="mini-tag">' + escapeHtml(t) + "</span>";
    }).join("");

    return '<article class="card" data-id="' + item.id + '" data-type="' + type + '">' +
      '<div class="card-media-wrap">' +
        media(item, false).replace('class="card-media">',
          'class="card-media">' + (badges ? '<div class="card-badges">' + badges + "</div>" : "") +
          (cats ? '<div class="card-cats">' + cats + "</div>" : "")) +
      "</div>" +
      '<div class="card-body">' +
        '<h2 class="card-title">' + escapeHtml(item.name) + "</h2>" +
        (item.nameOrig ? '<div class="card-orig">' + escapeHtml(item.nameOrig) + "</div>" : "") +
        '<p class="card-summary">' + escapeHtml(item.summary || item.highlights || "") + "</p>" +
        (metaBits.length ? '<div class="card-meta">' + metaBits.join("") + "</div>" : "") +
        (tags ? '<div class="card-tags">' + tags + "</div>" : "") +
      "</div>" +
    "</article>";
  }

  /* ---------- フィルタ ---------- */
  function currentList() {
    if (state.tab === "restaurants") return DATA.restaurants;
    if (state.tab === "foods") return DATA.foods;
    return DATA.attractions;
  }

  function searchText(item) {
    return [
      item.name, item.nameOrig, item.summary, item.highlights, item.history,
      item.howToEat, item.area, item.address, item.price, item.reviews,
      (item.tags || []).join(" "), (item.categories || []).join(" "),
      (item.badges || []).join(" "), (item.specialties || []).join(" "),
      item.type
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

  /* ---------- タグ集計 ---------- */
  var tagsExpanded = false;
  var TAG_LIMIT = 12;
  function buildTagbar() {
    var counts = {};
    currentList().forEach(function (item) {
      (item.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    // アクティブなタグは常に表示に含める
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

  /* ---------- 描画 ---------- */
  function render() {
    TABS.forEach(function (t) {
      document.getElementById("panel-" + t).classList.toggle("is-active", t === state.tab);
    });
    var list = filtered();
    var panel = document.getElementById("panel-" + state.tab);
    panel.innerHTML = list.map(function (item) { return cardHtml(item, state.tab); }).join("");

    els.emptyState.hidden = list.length !== 0;
    els.resultCount.textContent = list.length + " 件";
    var hasFilter = state.q || state.tag;
    els.resetBtn.hidden = !hasFilter;
    els.searchClear.hidden = !state.q;
  }

  function updateCounts() {
    document.getElementById("count-restaurants").textContent = DATA.restaurants.length;
    document.getElementById("count-foods").textContent = DATA.foods.length;
    document.getElementById("count-attractions").textContent = DATA.attractions.length;
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
  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function catsHtml(item, type) {
    var cats = (item.categories || []).slice();
    if (type === "foods" && item.type) cats = [item.type];
    var c = cats.map(function (x) { return '<span class="cat-pill">' + escapeHtml(x) + "</span>"; }).join("");
    var b = (item.badges || []).map(function (x) { return '<span class="badge gold" style="position:static">' + escapeHtml(x) + "</span>"; }).join("");
    return '<div class="m-cats">' + c + b + "</div>";
  }

  function sectionText(title, body) {
    if (!body) return "";
    return '<div class="m-section"><h3>' + title + '</h3><p>' + escapeHtml(body) + "</p></div>";
  }
  function sectionList(title, arr) {
    if (!arr || !arr.length) return "";
    return '<div class="m-section"><h3>' + title + '</h3><ul class="m-list">' +
      arr.map(function (x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("") + "</ul></div>";
  }

  function mapChip(item) {
    var link = '<a class="link-chip map" href="' + mapUrl(item.mapQuery || item.name + " Siena Italy") +
      '" target="_blank" rel="noopener">🗺️ Googleマップで開く</a>';
    var imgs = '<a class="link-chip" href="' + imgSearchUrl((item.nameOrig || item.name) + " Siena") +
      '" target="_blank" rel="noopener">📷 写真を検索</a>';
    var site = item.site ? '<a class="link-chip primary" href="' + escapeAttr(item.site) +
      '" target="_blank" rel="noopener">🔗 公式サイト</a>' : "";
    return '<div class="m-section"><h3>リンク</h3><div class="link-chips">' + link + imgs + site + "</div></div>";
  }

  // レストラン → 提供料理への相互リンク
  function dishXref(item) {
    var ids = (item.dishes || []).filter(function (d) { return foodById[d]; });
    if (!ids.length) return "";
    var chips = ids.map(function (d) {
      var f = foodById[d];
      return '<span class="xref-item" data-goto="foods:' + f.id + '"><span class="x-ico">🍝</span>' + escapeHtml(f.name) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>食べられる郷土料理</h3><div class="xref">' + chips + "</div></div>";
  }

  // 食べ物 → 提供レストランへの相互リンク
  function restXref(item, label) {
    var ids = (item.restaurants || item.nearRestaurants || []).filter(function (r) { return restById[r]; });
    if (!ids.length) return "";
    var chips = ids.map(function (r) {
      var res = restById[r];
      return '<span class="xref-item" data-goto="restaurants:' + res.id + '"><span class="x-ico">🍽️</span>' + escapeHtml(res.name) + "</span>";
    }).join("");
    return '<div class="m-section"><h3>' + (label || "提供しているレストラン") + '</h3><div class="xref">' + chips + "</div></div>";
  }

  function foodXref(item) {
    var ids = (item.nearFood || []).filter(function (f) { return foodById[f]; });
    if (!ids.length) return "";
    var chips = ids.map(function (f) {
      var fo = foodById[f];
      return '<span class="xref-item" data-goto="foods:' + fo.id + '"><span class="x-ico">🍝</span>' + escapeHtml(fo.name) + "</span>";
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

  function restaurantModal(item) {
    var info = '<dl class="m-info">' +
      row("カテゴリー", (item.categories || []).join(" / ")) +
      row("価格帯", item.price) +
      row("営業時間", item.hours) +
      row("定休", item.closed) +
      row("住所", item.address) +
      row("エリア", item.area) +
      "</dl>";
    return media(item, true) +
      '<div class="m-content">' +
        '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
        '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + "</div>" +
        catsHtml(item, "restaurants") +
        info +
        sectionText("特徴・いいところ", item.highlights) +
        sectionList("名物・おすすめ", item.specialties) +
        dishXref(item) +
        sectionText("レビュー", item.reviews) +
        mapChip(item) +
        tagsHtml(item) +
      "</div>";
  }

  function foodModal(item) {
    return media(item, true) +
      '<div class="m-content">' +
        '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
        '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + " ・ " + escapeHtml(item.type || "") + "</div>" +
        catsHtml(item, "foods") +
        sectionText("概要", item.summary) +
        sectionText("歴史・詳細", item.history) +
        sectionText("食べ方・ペアリング", item.howToEat) +
        restXref(item, "どこで食べられる？") +
        '<div class="m-section"><h3>リンク</h3><div class="link-chips">' +
          '<a class="link-chip" href="' + imgSearchUrl(item.nameOrig + " food") + '" target="_blank" rel="noopener">📷 写真を検索</a>' +
        "</div></div>" +
        tagsHtml(item) +
      "</div>";
  }

  function attractionModal(item) {
    var info = '<dl class="m-info">' +
      row("カテゴリー", (item.categories || []).join(" / ")) +
      row("料金", item.price) +
      row("営業時間", item.hours) +
      row("住所", item.address) +
      row("エリア", item.area) +
      "</dl>";
    return media(item, true) +
      '<div class="m-content">' +
        '<h2 class="m-title">' + escapeHtml(item.name) + "</h2>" +
        '<div class="m-orig">' + escapeHtml(item.nameOrig || "") + "</div>" +
        catsHtml(item, "attractions") +
        info +
        sectionText("見どころ", item.highlights) +
        sectionText("レビュー", item.reviews) +
        foodXref(item) +
        restXref(item, "近くのおすすめレストラン") +
        mapChip(item) +
        tagsHtml(item) +
      "</div>";
  }

  function row(dt, dd) {
    if (!dd) return "";
    return "<dt>" + dt + "</dt><dd>" + escapeHtml(dd) + "</dd>";
  }

  /* ---------- ユーティリティ ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- イベント ---------- */
  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.tag = null;
    tagsExpanded = false;
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t === btn;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    buildTagbar();
    render();
    if (history.replaceState) history.replaceState(null, "", "#" + state.tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.search.addEventListener("input", function () {
    state.q = els.search.value;
    render();
  });
  els.searchClear.addEventListener("click", function () {
    els.search.value = ""; state.q = ""; els.search.focus(); render();
  });
  els.tagbar.addEventListener("click", function (e) {
    var toggle = e.target.closest("[data-toggle-tags]");
    if (toggle) { tagsExpanded = !tagsExpanded; buildTagbar(); return; }
    var chip = e.target.closest(".tag-chip");
    if (!chip || !chip.dataset.tag) return;
    var t = chip.dataset.tag;
    state.tag = state.tag === t ? null : t;
    buildTagbar();
    render();
  });
  els.resetBtn.addEventListener("click", function () {
    state.q = ""; state.tag = null; els.search.value = "";
    buildTagbar(); render();
  });

  // カード → モーダル
  document.querySelector(".content").addEventListener("click", function (e) {
    var card = e.target.closest(".card");
    if (!card) return;
    openModal(card.dataset.type, card.dataset.id);
  });

  // モーダル内の操作
  els.modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    var goto = e.target.closest("[data-goto]");
    if (goto) {
      var parts = goto.dataset.goto.split(":");
      switchTab(parts[0]);
      openModal(parts[0], parts[1]);
      return;
    }
    var tagJump = e.target.closest("[data-tag-jump]");
    if (tagJump) {
      var tag = tagJump.dataset.tagJump;
      // 現在のタブにそのタグがあればフィルタ、なければタブ内検索
      closeModal();
      state.tag = tag; state.q = ""; els.search.value = "";
      buildTagbar(); render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  function switchTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab; state.tag = null; state.q = ""; els.search.value = "";
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    buildTagbar();
    render();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.modal.hidden) closeModal();
  });

  /* ---------- 初期化 ---------- */
  function applyHash() {
    var h = (location.hash || "").replace("#", "");
    if (TABS.indexOf(h) !== -1 && h !== state.tab) {
      state.tab = h; state.tag = null; tagsExpanded = false;
      document.querySelectorAll(".tab").forEach(function (t) {
        var on = t.dataset.tab === h;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      buildTagbar();
      render();
    }
  }
  window.addEventListener("hashchange", applyHash);

  updateCounts();
  buildTagbar();
  render();
  applyHash();
})();
