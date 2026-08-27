const STORAGE_KEY = "donutSmpMarketItemsFromVideoV1";
const LEDGER_KEY = "donutSmpFlipLedger";

const CATEGORY_ORDER = ["Popular", "Ores", "Netherite", "Kit", "Misc", "Redstone", "Other"];

let items = [];
let ledger = [];

function parsePrice(value) {
  const match = value.replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return 0;
  return Number(match[1]) * ({ K: 1000, M: 1000000, B: 1000000000 }[match[2]?.toUpperCase()] || 1);
}

function parseAuctionObservations(observations) {
  return observations.filter((observation) => observation.page && observation.detected_prices.length)
    .map((observation, index) => {
      const pageText = observation.ocr_text.split("|").map((part) => part.trim());
      const pageIndex = pageText.findIndex((part) => /(?:page|hage)\s*\d+/i.test(part));
      const candidates = pageText.slice(pageIndex + 1).filter((part) => part && !/^\$?\s*[\d.,]+\s*[KMB]?$/i.test(part));
      const name = (candidates[0] || "Unknown auction item").replace(/^(?:auction|ruction)\s*$/i, "Unknown auction item");
      const priceText = pageText.slice(pageIndex + 1).find((part) => /\$\s*[\d.,]+\s*[KMB]?|\b[\d.,]+\s*[KMB]\b/i.test(part));
      const price = priceText ? parsePrice(priceText) : Number(observation.detected_prices[0]) || 0;
      return { name, category: "Auction items", buyStack: price || 0, sellStack: price || 0, page: observation.page, timestamp: observation.timestamp_seconds, id: `${observation.timestamp_seconds}-${index}` };
    }).filter((item) => item.buyStack > 0);
}

async function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    items = JSON.parse(raw);
  } else {
    try {
      const response = await fetch("auction-database.json");
      const database = await response.json();
      items = parseAuctionObservations(database.observations || []);
      saveItems();
    } catch (error) {
      items = [];
      console.error("Could not load auction-database.json", error);
    }
  }
  ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) || "[]");
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

function computeMetrics(item) {
  const buyStack = Number(item.buyStack) || 0;
  const sellStack = Number(item.sellStack ?? item.stackValue) || 0;
  const profit = sellStack - buyStack;
  return { buyStack, sellStack, profit, roi: buyStack ? (profit / buyStack) * 100 : 0 };
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
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const budget = Number(document.getElementById("budgetInput").value) || Infinity;
  const visibleItems = items.filter((item) => item.name.toLowerCase().includes(query) && computeMetrics(item).buyStack <= budget);

  container.innerHTML = "";
  emptyState.style.display = visibleItems.length === 0 ? "block" : "none";

  if (visibleItems.length === 0) {
    updateSummary();
    renderLedger();
    return;
  }

  const bestItem = [...visibleItems].sort(
    (a, b) => computeMetrics(b).profit - computeMetrics(a).profit
  )[0];

  const groups = groupByCategory(visibleItems);
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
      const { buyStack, sellStack, profit, roi } = computeMetrics(item);
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
            <label>Buy / stack</label>
            <input type="number" min="0" value="${buyStack}" data-field="buyStack" data-index="${realIndex}">
          </div>
          <div>
            <label>Target sell</label>
            <input type="number" min="0" value="${sellStack}" data-field="sellStack" data-index="${realIndex}">
          </div>
        </div>
        <div class="card-result">
          <span>ROI: <strong class="${roi >= 0 ? "profit-positive" : "profit-negative"}">${roi.toFixed(1)}%</strong></span>
          <span class="profit-value ${profit >= 0 ? "profit-positive" : "profit-negative"}">${formatNumber(profit)}</span>
        </div>
        <button class="btn buy-btn" data-buy="${realIndex}" ${buyStack <= 0 ? "disabled" : ""}>Buy & track flip</button>
      `;
      grid.appendChild(card);
    });

    container.appendChild(section);
  });

  updateSummary(bestItem);
  renderLedger();
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

  const total = items.reduce((sum, item) => sum + Math.max(0, computeMetrics(item).profit), 0);

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

  document.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", (e) => {
    const item = items[Number(e.currentTarget.dataset.buy)];
    if (!item) return;
    ledger.push({ ...item, id: Date.now() });
    saveItems();
    render();
  }));
}

function renderLedger() {
  const container = document.getElementById("ledgerContainer");
  const total = ledger.reduce((sum, item) => sum + Math.max(0, computeMetrics(item).profit), 0);
  document.getElementById("ledgerTotal").textContent = `${formatNumber(total)} potential`;
  container.innerHTML = ledger.length
    ? ledger.map((item) => `<div class="ledger-row"><strong>${escapeHtml(item.name)}</strong><span>Buy ${formatNumber(computeMetrics(item).buyStack)}</span><span class="profit-positive">Flip +${formatNumber(computeMetrics(item).profit)}</span><button class="remove-btn" data-ledger-remove="${item.id}" title="Remove from ledger">✕</button></div>`).join("")
    : "Buy a listing above to track it here.";
  container.querySelectorAll("[data-ledger-remove]").forEach((button) => button.addEventListener("click", () => {
    ledger = ledger.filter((item) => item.id !== Number(button.dataset.ledgerRemove));
    saveItems();
    renderLedger();
  }));
}

document.getElementById("addItemBtn").addEventListener("click", () => {
  items.push({ name: "New Listing", category: "Other", buyStack: 0, sellStack: 0 });
  saveItems();
  render();
});

document.getElementById("reloadDatabaseBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
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
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("budgetInput").addEventListener("input", render);

loadItems().then(render);
