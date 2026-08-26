const STORAGE_KEY = "donutSmpFlipItems";

// Example placeholder items — Donut SMP market prices fluctuate constantly,
// so these are just starting points for the user to edit with real prices.
const PRESET_ITEMS = [
  { name: "Elytra", category: "Popular", buyPrice: 280000000, sellPrice: 301000000, qty: 1 },
  { name: "Netherite Ingot", category: "Netherite", buyPrice: 5600000, sellPrice: 5947977, qty: 1 },
  { name: "Block of Netherite", category: "Netherite", buyPrice: 49000000, sellPrice: 52222300, qty: 1 },
  { name: "Ancient Debris", category: "Netherite", buyPrice: 1550000, sellPrice: 1670829, qty: 1 },
  { name: "Totem of Undying", category: "Misc", buyPrice: 82000, sellPrice: 89049, qty: 1 },
  { name: "Enchanted Golden Apple", category: "Misc", buyPrice: 1000000, sellPrice: 1108698, qty: 1 },
  { name: "Golden Apple", category: "Misc", buyPrice: 13500, sellPrice: 14637, qty: 1 },
  { name: "Netherite Sword", category: "Kit", buyPrice: 6200000, sellPrice: 6671617, qty: 1 },
  { name: "Netherite Helmet", category: "Kit", buyPrice: 5600000, sellPrice: 6010719, qty: 1 },
  { name: "Redstone Dust", category: "Redstone", buyPrice: 870, sellPrice: 939, qty: 1 },
  { name: "Block of Redstone", category: "Redstone", buyPrice: 2700, sellPrice: 2915, qty: 1 },
];

const CATEGORY_ORDER = ["Popular", "Netherite", "Kit", "Misc", "Redstone", "Other"];

let items = [];

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  items = raw ? JSON.parse(raw) : [];
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function computeMetrics(item) {
  const profitPerItem = item.sellPrice - item.buyPrice;
  const totalProfit = profitPerItem * item.qty;
  const marginPercent = item.buyPrice > 0 ? (profitPerItem / item.buyPrice) * 100 : 0;
  return { profitPerItem, totalProfit, marginPercent };
}

function formatNumber(n) {
  return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function groupByCategory(list) {
  const groups = {};
  list.forEach((item) => {
    const cat = item.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  return groups;
}

function render() {
  const container = document.getElementById("categoriesContainer");
  const emptyState = document.getElementById("emptyState");
  const sortKey = document.getElementById("sortSelect").value;

  container.innerHTML = "";
  emptyState.style.display = items.length === 0 ? "block" : "none";

  if (items.length === 0) {
    updateSummary();
    return;
  }

  const bestItem = [...items].sort(
    (a, b) => computeMetrics(b).profitPerItem - computeMetrics(a).profitPerItem
  )[0];

  const groups = groupByCategory(items);
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  orderedCategories.forEach((category) => {
    const groupItems = [...groups[category]].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      const ma = computeMetrics(a);
      const mb = computeMetrics(b);
      return mb[sortKey] - ma[sortKey];
    });

    const section = document.createElement("section");
    section.className = "category-section";
    section.innerHTML = `
      <div class="category-title">${escapeHtml(category)} <span class="count">${groupItems.length}</span></div>
      <div class="card-grid"></div>
    `;

    const grid = section.querySelector(".card-grid");
    groupItems.forEach((item) => {
      const realIndex = items.indexOf(item);
      const { profitPerItem, totalProfit, marginPercent } = computeMetrics(item);
      const profitClass = profitPerItem >= 0 ? "profit-positive" : "profit-negative";
      const isBest = item === bestItem && profitPerItem > 0;

      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        ${isBest ? '<span class="best-badge">🏆 Best Flip</span>' : ""}
        <div class="card-top">
          <input type="text" class="name-input" value="${escapeHtml(item.name)}" data-field="name" data-index="${realIndex}">
          <button class="remove-btn" data-remove="${realIndex}" title="Remove">✕</button>
        </div>
        <div class="card-fields">
          <div>
            <label>Buy Price</label>
            <input type="number" min="0" value="${item.buyPrice}" data-field="buyPrice" data-index="${realIndex}">
          </div>
          <div>
            <label>Sell Price</label>
            <input type="number" min="0" value="${item.sellPrice}" data-field="sellPrice" data-index="${realIndex}">
          </div>
          <div class="qty-field">
            <label>Qty</label>
            <input type="number" min="0" value="${item.qty}" data-field="qty" data-index="${realIndex}">
          </div>
        </div>
        <div class="card-result">
          <span>Margin: <strong class="${profitClass}">${marginPercent.toFixed(1)}%</strong></span>
          <span class="profit-value ${profitClass}">${formatNumber(totalProfit)}</span>
        </div>
      `;
      grid.appendChild(card);
    });

    container.appendChild(section);
  });

  updateSummary(bestItem);
  attachListeners();
}

function updateSummary(bestItem) {
  const bestItemName = document.getElementById("bestItemName");
  const totalPotentialProfit = document.getElementById("totalPotentialProfit");
  const itemCount = document.getElementById("itemCount");

  if (items.length === 0 || !bestItem) {
    bestItemName.textContent = "—";
    totalPotentialProfit.textContent = "$0";
    itemCount.textContent = "0";
    return;
  }

  const total = items.reduce((sum, item) => sum + computeMetrics(item).totalProfit, 0);

  bestItemName.textContent = bestItem.name || "—";
  totalPotentialProfit.textContent = formatNumber(total);
  itemCount.textContent = items.length;
}

function attachListeners() {
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const index = Number(e.target.dataset.index);
      const field = e.target.dataset.field;
      let value = e.target.value;
      if (field !== "name") {
        value = Number(value) || 0;
      }
      items[index][field] = value;
      saveItems();
      render();
    });
  });

  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = Number(e.target.dataset.remove);
      items.splice(index, 1);
      saveItems();
      render();
    });
  });
}

document.getElementById("addItemBtn").addEventListener("click", () => {
  items.push({ name: "New Item", category: "Other", buyPrice: 0, sellPrice: 0, qty: 1 });
  saveItems();
  render();
});

document.getElementById("loadPresetsBtn").addEventListener("click", () => {
  PRESET_ITEMS.forEach((preset) => items.push({ ...preset }));
  saveItems();
  render();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (items.length === 0) return;
  if (confirm("Remove all items?")) {
    items = [];
    saveItems();
    render();
  }
});

document.getElementById("sortSelect").addEventListener("change", render);

loadItems();
render();
