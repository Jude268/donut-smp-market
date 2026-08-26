const STORAGE_KEY = "donutSmpMarketItems";

// Real DonutSMP /ah auction prices reported by the site owner. Stack = 64 items.
const PRESET_ITEMS = [
  { name: "Diamond Ore", category: "Ores", stackValue: 350000 },
  { name: "Redstone Ore", category: "Ores", stackValue: 26800 },
  { name: "Gold Ingot", category: "Ores", stackValue: 192000 },
  { name: "Lapis Lazuli", category: "Ores", stackValue: 149000 },
];

const CATEGORY_ORDER = ["Popular", "Ores", "Netherite", "Kit", "Misc", "Redstone", "Other"];

let items = [];

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  items = raw ? JSON.parse(raw) : [];
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function computeMetrics(item) {
  const unitValue = item.stackValue / 64;
  return { unitValue, stackValue: item.stackValue };
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
    (a, b) => computeMetrics(b).unitValue - computeMetrics(a).unitValue
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
      const { unitValue, stackValue } = computeMetrics(item);
      const isBest = item === bestItem;

      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        ${isBest ? '<span class="best-badge">🏆 Most Valuable</span>' : ""}
        <div class="card-top">
          <input type="text" class="name-input" value="${escapeHtml(item.name)}" data-field="name" data-index="${realIndex}">
          <button class="remove-btn" data-remove="${realIndex}" title="Remove">✕</button>
        </div>
        <div class="card-fields">
          <div>
            <label>Stack (x64) Value</label>
            <input type="number" min="0" value="${item.stackValue}" data-field="stackValue" data-index="${realIndex}">
          </div>
        </div>
        <div class="card-result">
          <span>Per Item: <strong>${formatNumber(unitValue)}</strong></span>
          <span class="profit-value profit-positive">${formatNumber(stackValue)}</span>
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

  const total = items.reduce((sum, item) => sum + computeMetrics(item).stackValue, 0);

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
  items.push({ name: "New Item", category: "Other", stackValue: 0 });
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
