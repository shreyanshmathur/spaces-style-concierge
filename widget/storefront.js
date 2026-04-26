(function () {
  "use strict";

  const API_BASE = "";
  const CART_KEY = "spaces-poc-cart";
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  let catalog = [];
  let filteredCategory = "All";
  let selectedSku = null;
  let cart = loadCart();

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .store-controls {
        display: flex; gap: 12px; align-items: center; justify-content: space-between;
        margin: -16px 0 28px; flex-wrap: wrap;
      }
      .category-pills { display: flex; gap: 8px; flex-wrap: wrap; }
      .category-pill {
        border: 1px solid var(--border-color); background: #fff; color: var(--text-main);
        border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: all .2s ease;
      }
      .category-pill.active, .category-pill:hover { border-color: var(--primary-color); color: var(--primary-color); }
      .store-search {
        min-width: 260px; border: 1px solid var(--border-color); border-radius: 4px;
        padding: 10px 12px; font-size: 13px; outline: none;
      }
      .store-search:focus { border-color: var(--primary-color); }
      .product-card { background: #fff; border: 1px solid var(--border-color); }
      .product-card > .product-title,
      .product-card > .product-meta,
      .product-card > .product-card-fabric,
      .product-card > .product-price,
      .product-card > .product-actions { margin-left: 16px; margin-right: 16px; }
      .product-card > .product-actions { margin-bottom: 18px; }
      .product-meta {
        display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;
        margin: 0 0 10px; font-size: 11px; color: var(--text-light);
      }
      .product-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .btn-secondary {
        display: inline-flex; justify-content: center; align-items: center;
        background: #fff; color: var(--primary-color); border: 1px solid var(--primary-color);
        padding: 8px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;
        cursor: pointer; transition: all .2s ease;
      }
      .btn-secondary:hover { background: #fff5f5; }
      .recommendation-band {
        max-width: 1440px; margin: 0 auto 60px; padding: 34px 40px;
        background: #f7faf7; border-top: 1px solid #e0ebe0; border-bottom: 1px solid #e0ebe0;
      }
      .recommendation-head {
        display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 22px;
      }
      .recommendation-title { font-size: 24px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
      .recommendation-copy { color: var(--text-light); font-size: 14px; max-width: 540px; }
      .recommendation-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
      .mini-card {
        background: #fff; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;
        display: grid; grid-template-columns: 88px 1fr; min-height: 112px;
      }
      .mini-card img { width: 88px; height: 112px; object-fit: cover; }
      .mini-card-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
      .mini-card-title { font-size: 12px; font-weight: 700; line-height: 1.35; }
      .mini-card-reason { color: var(--text-light); font-size: 11px; line-height: 1.35; flex: 1; }
      .mini-card-action { border: 0; background: var(--primary-color); color: #fff; padding: 7px 9px; font-size: 11px; font-weight: 700; cursor: pointer; }
      .cart-button {
        position: relative; background: transparent; border: 0; cursor: pointer; color: var(--text-main);
        display: inline-flex; align-items: center; justify-content: center; padding: 0;
      }
      .cart-count {
        position: absolute; top: -9px; right: -10px; min-width: 18px; height: 18px;
        border-radius: 999px; background: var(--primary-color); color: #fff; font-size: 11px;
        display: flex; align-items: center; justify-content: center; font-weight: 700;
      }
      .cart-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.35); opacity: 0; pointer-events: none;
        transition: opacity .2s ease; z-index: 10000;
      }
      .cart-backdrop.open { opacity: 1; pointer-events: all; }
      .cart-drawer {
        position: fixed; top: 0; right: 0; height: 100vh; width: min(420px, 100vw);
        background: #fff; box-shadow: -18px 0 48px rgba(0,0,0,.18); transform: translateX(100%);
        transition: transform .25s ease; z-index: 10001; display: none; flex-direction: column;
      }
      .cart-drawer.open { display: flex; transform: translateX(0); }
      .cart-head { padding: 22px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
      .cart-title { font-size: 20px; font-weight: 700; }
      .cart-close { border: 0; background: #fff; font-size: 28px; cursor: pointer; line-height: 1; }
      .cart-items { flex: 1; overflow: auto; padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
      .cart-item { display: grid; grid-template-columns: 70px 1fr; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; }
      .cart-item img { width: 70px; height: 82px; object-fit: cover; border-radius: 4px; }
      .cart-item-title { font-size: 13px; font-weight: 700; line-height: 1.35; margin-bottom: 5px; }
      .cart-item-meta { font-size: 12px; color: var(--text-light); margin-bottom: 8px; }
      .qty-row { display: flex; align-items: center; gap: 8px; }
      .qty-btn { width: 26px; height: 26px; border: 1px solid var(--border-color); background: #fff; cursor: pointer; }
      .remove-btn { border: 0; background: transparent; color: var(--primary-color); cursor: pointer; font-size: 12px; margin-left: auto; }
      .cart-recs { padding: 16px 22px; border-top: 1px solid var(--border-color); background: #fafafa; }
      .cart-recs-title { font-size: 13px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px; }
      .cart-foot { padding: 18px 22px; border-top: 1px solid var(--border-color); }
      .subtotal { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; margin-bottom: 14px; }
      .checkout-note { color: var(--text-light); font-size: 12px; margin-top: 8px; }
      @media (max-width: 900px) {
        .recommendation-grid, .grid-4 { grid-template-columns: repeat(2, 1fr); }
        .recommendation-head { align-items: start; flex-direction: column; }
      }
      @media (max-width: 560px) {
        .recommendation-grid, .grid-4 { grid-template-columns: 1fr; }
        .store-search { width: 100%; min-width: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
    updateCartCount();
    refreshRecommendations(selectedSku);
  }

  function productPrice(product) {
    return product.discountedPrice || product.price;
  }

  function imageFor(product) {
    return product.thumbnailUrl || "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80";
  }

  async function loadCatalog() {
    const res = await fetch(`${API_BASE}/api/catalog`);
    const data = await res.json();
    catalog = data.products || [];
    setupStorefront();
  }

  function setupStorefront() {
    const section = document.querySelector(".section");
    const grid = section && section.querySelector(".grid-4");
    if (!section || !grid) return;

    section.querySelector(".section-title").textContent = "AI-curated SPACES catalog";
    grid.id = "product-grid";

    const controls = document.createElement("div");
    controls.className = "store-controls";
    controls.innerHTML = `
      <div class="category-pills" id="category-pills"></div>
      <input id="store-search" class="store-search" type="search" placeholder="Search 30 SKUs across bed, bath, rugs, cushions..." />
    `;
    section.insertBefore(controls, grid);

    const recBand = document.createElement("section");
    recBand.className = "recommendation-band";
    recBand.innerHTML = `
      <div class="recommendation-head">
        <div>
          <div class="recommendation-title">Recommendation Engine</div>
          <p class="recommendation-copy" id="recommendation-copy">Click "Find matches" or add a product to the cart to see cross-sell SKUs.</p>
        </div>
        <button class="btn-secondary" id="refresh-recs">Refresh Picks</button>
      </div>
      <div class="recommendation-grid" id="recommendation-grid"></div>
    `;
    section.insertAdjacentElement("afterend", recBand);

    setupCartChrome();
    renderCategoryPills();
    renderProducts();
    refreshRecommendations();

    document.getElementById("store-search").addEventListener("input", renderProducts);
    document.getElementById("refresh-recs").addEventListener("click", () => refreshRecommendations(selectedSku));
    window.addEventListener("spaces:add-to-cart", (event) => {
      if (event.detail && event.detail.sku) addToCart(event.detail.sku, true);
    });
    window.addEventListener("spaces-widget-product-selected", (event) => {
      if (event.detail && event.detail.sku) {
        selectedSku = event.detail.sku;
        refreshRecommendations(selectedSku);
      }
    });
  }

  function renderCategoryPills() {
    const categories = ["All", ...Array.from(new Set(catalog.map((p) => p.category)))];
    const container = document.getElementById("category-pills");
    container.innerHTML = categories.map((category) => `
      <button class="category-pill ${category === filteredCategory ? "active" : ""}" data-category="${category}">${category}</button>
    `).join("");
    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        filteredCategory = button.dataset.category;
        renderCategoryPills();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    const query = (document.getElementById("store-search")?.value || "").toLowerCase();
    const products = catalog.filter((product) => {
      const categoryOk = filteredCategory === "All" || product.category === filteredCategory;
      const queryOk = !query || `${product.name} ${product.category} ${product.sku}`.toLowerCase().includes(query);
      return categoryOk && queryOk;
    });
    document.getElementById("product-grid").innerHTML = products.map(productCardHtml).join("");
    bindProductActions(document.getElementById("product-grid"));
  }

  function productCardHtml(product) {
    const sale = product.discountedPrice && product.discountedPrice < product.price;
    const features = (product.keyFeatures || []).slice(0, 2).join(" / ");
    return `
      <div class="product-card" data-sku="${product.sku}">
        <div class="product-image-container">
          ${sale ? '<div class="product-badge">Smart Add-on</div>' : ""}
          <img src="${imageFor(product)}" alt="${product.name}" loading="lazy" />
        </div>
        <h3 class="product-title">${product.name}</h3>
        <div class="product-meta"><span>${product.category}</span><span>${product.fabricType}</span></div>
        <div class="product-card-fabric">${features}</div>
        <div class="product-price">
          <span class="current-price">${money.format(productPrice(product))}</span>
          ${sale ? `<span class="original-price">${money.format(product.price)}</span>` : ""}
        </div>
        <div class="product-actions">
          <button class="btn-secondary js-match" data-sku="${product.sku}">Find matches</button>
          <button class="btn-primary js-add" data-sku="${product.sku}" style="padding: 8px 12px; font-size: 12px;">Add</button>
        </div>
      </div>
    `;
  }

  function bindProductActions(scope) {
    scope.querySelectorAll(".js-add").forEach((button) => {
      button.addEventListener("click", () => addToCart(button.dataset.sku, true));
    });
    scope.querySelectorAll(".js-match").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSku = button.dataset.sku;
        refreshRecommendations(selectedSku);
        document.querySelector(".recommendation-band").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function setupCartChrome() {
    const headerIcons = document.querySelector(".header-icons");
    if (headerIcons && !document.getElementById("cart-open")) {
      const svgs = headerIcons.querySelectorAll("svg");
      const cartSvg = svgs[svgs.length - 1];
      const button = document.createElement("button");
      button.id = "cart-open";
      button.className = "cart-button";
      button.setAttribute("aria-label", "Open cart");
      button.innerHTML = `${cartSvg.outerHTML}<span class="cart-count" id="cart-count">0</span>`;
      cartSvg.replaceWith(button);
      button.addEventListener("click", openCart);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "cart-backdrop";
    backdrop.id = "cart-backdrop";
    const drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.id = "cart-drawer";
    drawer.innerHTML = `
      <div class="cart-head">
        <div class="cart-title">Your SPACES Cart</div>
        <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
      </div>
      <div class="cart-items" id="cart-items"></div>
      <div class="cart-recs">
        <div class="cart-recs-title">Complete the set</div>
        <div id="cart-recs"></div>
      </div>
      <div class="cart-foot">
        <div class="subtotal"><span>Subtotal</span><span id="cart-subtotal">${money.format(0)}</span></div>
        <button class="btn-primary" id="checkout-button" style="width:100%;">Checkout Demo</button>
        <div class="checkout-note" id="checkout-note">Cart persists locally for the POC.</div>
      </div>
    `;
    document.body.append(backdrop, drawer);
    backdrop.addEventListener("click", closeCart);
    drawer.querySelector("#cart-close").addEventListener("click", closeCart);
    drawer.querySelector("#checkout-button").addEventListener("click", () => {
      document.getElementById("checkout-note").textContent = "Demo checkout ready: cart, add-ons, and subtotal are working.";
    });
    renderCart();
    updateCartCount();
  }

  function addToCart(sku, shouldOpen) {
    const product = catalog.find((p) => p.sku === sku);
    if (!product) return;
    cart[sku] = (cart[sku] || 0) + 1;
    selectedSku = sku;
    saveCart();
    if (shouldOpen) openCart();
  }

  function changeQty(sku, delta) {
    cart[sku] = (cart[sku] || 0) + delta;
    if (cart[sku] <= 0) delete cart[sku];
    saveCart();
  }

  function cartProducts() {
    return Object.entries(cart)
      .map(([sku, qty]) => ({ product: catalog.find((p) => p.sku === sku), qty }))
      .filter((item) => item.product);
  }

  function renderCart() {
    const itemsEl = document.getElementById("cart-items");
    if (!itemsEl) return;
    const items = cartProducts();
    if (!items.length) {
      itemsEl.innerHTML = '<p style="color:var(--text-light);font-size:14px;">Your cart is empty. Add a bedsheet, towel, pillow, or decor SKU to begin.</p>';
    } else {
      itemsEl.innerHTML = items.map(({ product, qty }) => `
        <div class="cart-item">
          <img src="${imageFor(product)}" alt="${product.name}" />
          <div>
            <div class="cart-item-title">${product.name}</div>
            <div class="cart-item-meta">${product.category} / ${money.format(productPrice(product))}</div>
            <div class="qty-row">
              <button class="qty-btn js-qty" data-sku="${product.sku}" data-delta="-1">-</button>
              <strong>${qty}</strong>
              <button class="qty-btn js-qty" data-sku="${product.sku}" data-delta="1">+</button>
              <button class="remove-btn js-remove" data-sku="${product.sku}">Remove</button>
            </div>
          </div>
        </div>
      `).join("");
    }

    itemsEl.querySelectorAll(".js-qty").forEach((button) => {
      button.addEventListener("click", () => changeQty(button.dataset.sku, Number(button.dataset.delta)));
    });
    itemsEl.querySelectorAll(".js-remove").forEach((button) => {
      button.addEventListener("click", () => {
        delete cart[button.dataset.sku];
        saveCart();
      });
    });

    const subtotal = items.reduce((sum, item) => sum + productPrice(item.product) * item.qty, 0);
    const subtotalEl = document.getElementById("cart-subtotal");
    if (subtotalEl) subtotalEl.textContent = money.format(subtotal);
    renderCartRecommendations();
  }

  async function getRecommendations(sku, limit) {
    const body = { selected_sku: sku || null, cart_skus: Object.keys(cart), limit };
    const res = await fetch(`${API_BASE}/api/related-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function refreshRecommendations(sku) {
    const grid = document.getElementById("recommendation-grid");
    if (!grid) return;
    grid.innerHTML = "<p>Finding strong add-ons...</p>";
    try {
      const data = await getRecommendations(sku, 4);
      document.getElementById("recommendation-copy").textContent = data.intro_message;
      grid.innerHTML = (data.recommendations || []).map(miniCardHtml).join("");
      bindMiniActions(grid);
    } catch (_) {
      grid.innerHTML = "<p>Recommendations are unavailable right now.</p>";
    }
  }

  async function renderCartRecommendations() {
    const container = document.getElementById("cart-recs");
    if (!container) return;
    try {
      const data = await getRecommendations(selectedSku, 2);
      container.innerHTML = (data.recommendations || []).slice(0, 2).map(miniCardHtml).join("");
      bindMiniActions(container);
    } catch (_) {
      container.innerHTML = "";
    }
  }

  function miniCardHtml(card) {
    return `
      <div class="mini-card">
        <img src="${card.thumbnail_url}" alt="${card.name}" />
        <div class="mini-card-body">
          <div class="mini-card-title">${card.name}</div>
          <div class="mini-card-reason">${card.reason}</div>
          <button class="mini-card-action js-add" data-sku="${card.sku}">Add ${money.format(card.discounted_price || card.price)}</button>
        </div>
      </div>
    `;
  }

  function bindMiniActions(scope) {
    scope.querySelectorAll(".js-add").forEach((button) => {
      button.addEventListener("click", () => addToCart(button.dataset.sku, true));
    });
  }

  function updateCartCount() {
    const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    const el = document.getElementById("cart-count");
    if (el) el.textContent = count;
  }

  function openCart() {
    document.getElementById("cart-backdrop")?.classList.add("open");
    document.getElementById("cart-drawer")?.classList.add("open");
  }

  function closeCart() {
    document.getElementById("cart-backdrop")?.classList.remove("open");
    document.getElementById("cart-drawer")?.classList.remove("open");
  }

  injectStyles();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadCatalog);
  else loadCatalog();
})();
