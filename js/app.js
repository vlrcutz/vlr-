// app.js — VLR Cutz Manager main logic
const CURRENCY = "₹";

let services = [];
let customers = [];
let saleDraft = { items: [], payment: "Cash", discountType: "none", discountValue: 0 };
let amountReceivedTouched = false;

function fmt(n) {
  const v = Math.round((n + Number.EPSILON) * 100) / 100;
  return CURRENCY + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- date helpers ----------
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function startOfMonth(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return x; }
function startOfYear(d = new Date()) { const x = new Date(d.getFullYear(), 0, 1); return x; }
function dateKey(d) { return new Date(d).toISOString().slice(0,10); }

function inRange(ts, start, end) {
  const t = new Date(ts).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function rangeBounds(range) {
  const now = new Date();
  if (range === "today") return [startOfDay(now), endOfDay(now)];
  if (range === "week") return [startOfWeek(now), endOfDay(now)];
  if (range === "month") return [startOfMonth(now), endOfDay(now)];
  if (range === "year") return [startOfYear(now), endOfDay(now)];
  return [new Date(0), endOfDay(now)];
}

// ---------- navigation ----------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById("screen-" + name);
  if (el) el.classList.add("active");
  document.querySelectorAll("#bottomNav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === name);
  });
  const fab = document.getElementById("fabAddSale");
  fab.style.display = (name === "dashboard" || name === "sales") ? "flex" : "none";
  if (name === "dashboard") renderDashboard();
  if (name === "sales") renderSales();
  if (name === "expenses") renderExpenses();
  if (name === "customers") renderCustomers();
  if (name === "services") renderServicesList();
  if (name === "reports") renderReports();
  if (name === "pending") renderPending();
}

document.getElementById("bottomNav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nav]");
  if (btn) showScreen(btn.dataset.nav);
});

document.querySelectorAll("[data-open]").forEach((el) =>
  el.addEventListener("click", () => showScreen(el.dataset.open))
);
document.querySelectorAll("[data-back]").forEach((el) =>
  el.addEventListener("click", () => showScreen(el.dataset.back))
);

// ---------- data load ----------
async function reloadData() {
  services = await DB.getAll("services");
  customers = await DB.getAll("customers");
}

async function seedDefaultsIfEmpty() {
  const existing = await DB.getAll("services");
  if (existing.length) return;
  const defaults = [
    ["Haircut", "Haircut", 150],
    ["Beard Trim", "Beard", 80],
    ["Haircut + Beard", "Haircut", 200],
    ["Hair Color", "Color", 400],
    ["Highlights", "Highlights", 800],
    ["Keratin Treatment", "Keratin", 1500],
    ["Facial", "Facial", 350],
  ];
  for (const [name, category, price] of defaults) {
    await DB.put("services", { id: DB.uid(), name, category, price, active: true });
  }
}

// ==========================================================================
// DASHBOARD
// ==========================================================================
async function renderDashboard() {
  const now = new Date();
  const sales = await DB.getAll("sales");
  const expenses = await DB.getAll("expenses");

  const [todayStart, todayEnd] = rangeBounds("today");
  const [weekStart] = rangeBounds("week");
  const [monthStart] = rangeBounds("month");
  const [yearStart] = rangeBounds("year");

  const sum = (arr) => arr.reduce((a, s) => a + s.total, 0);
  const todaySales = sales.filter((s) => inRange(s.timestamp, todayStart, todayEnd));
  const weekSales = sales.filter((s) => inRange(s.timestamp, weekStart, todayEnd));
  const monthSales = sales.filter((s) => inRange(s.timestamp, monthStart, todayEnd));
  const yearSales = sales.filter((s) => inRange(s.timestamp, yearStart, todayEnd));
  const monthExpenses = expenses.filter((e) => inRange(e.timestamp, monthStart, todayEnd));

  document.getElementById("dashToday").textContent = fmt(sum(todaySales));
  document.getElementById("dashTodayMeta").textContent = `${todaySales.length} service${todaySales.length === 1 ? "" : "s"} logged`;
  document.getElementById("dashWeek").textContent = fmt(sum(weekSales));
  document.getElementById("dashMonth").textContent = fmt(sum(monthSales));
  document.getElementById("dashYear").textContent = fmt(sum(yearSales));
  const expMonthTotal = monthExpenses.reduce((a, e) => a + e.amount, 0);
  document.getElementById("dashExpMonth").textContent = fmt(expMonthTotal);
  document.getElementById("dashProfit").textContent = fmt(sum(monthSales) - expMonthTotal);

  const totalPending = sales.reduce((a, s) => a + (s.dueAmount || 0), 0);
  document.getElementById("dashPending").textContent = fmt(totalPending);

  // 7-day chart
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const [ds, de] = [startOfDay(d), endOfDay(d)];
    const dayTotal = sales.filter((s) => inRange(s.timestamp, ds, de)).reduce((a, s) => a + s.total, 0);
    labels.push(d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0,2));
    values.push(dayTotal);
  }
  Charts.bar(document.getElementById("dashChart7"), labels, values);

  // best sellers this month
  const tally = {};
  monthSales.forEach((s) => s.items.forEach((it) => {
    tally[it.name] = (tally[it.name] || 0) + 1;
  }));
  const sorted = Object.entries(tally).sort((a,b) => b[1]-a[1]).slice(0,5);
  const bs = document.getElementById("dashBestSellers");
  if (!sorted.length) {
    bs.innerHTML = '<div class="empty-state">No sales yet this month.</div>';
  } else {
    bs.innerHTML = sorted.map(([name, count]) => `
      <div class="list-row"><div class="main"><div class="name">${escapeHtml(name)}</div></div><div class="amt">${count}×</div></div>
    `).join("");
  }
}

// ==========================================================================
// SALES
// ==========================================================================
let currentSalesRange = "today";
document.getElementById("salesRangeTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-range]");
  if (!btn) return;
  document.querySelectorAll("#salesRangeTabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentSalesRange = btn.dataset.range;
  renderSales();
});

async function renderSales() {
  const [start, end] = rangeBounds(currentSalesRange);
  const sales = (await DB.getAll("sales"))
    .filter((s) => inRange(s.timestamp, start, end))
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  const list = document.getElementById("salesList");
  if (!sales.length) {
    list.innerHTML = '<div class="empty-state"><div class="big">💵</div>No sales in this period.</div>';
    return;
  }
  list.innerHTML = sales.map((s) => {
    const time = new Date(s.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
    const itemNames = s.items.map((i) => i.name).join(", ");
    const due = s.dueAmount || 0;
    return `
      <div class="list-row">
        <div class="main">
          <div class="name">${escapeHtml(itemNames)}${s.customerName ? " — " + escapeHtml(s.customerName) : ""}</div>
          <div class="meta">${time} · ${s.paymentMethod}${due > 0 ? ` · <span style="color:var(--bad);">₹${due.toFixed(0)} pending</span>` : ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="amt good">${fmt(s.total)}</div>
          <button class="btn secondary small" data-view-receipt="${s.id}">↗</button>
          <button class="btn danger small" data-del-sale="${s.id}">🗑</button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll("[data-view-receipt]").forEach((b) =>
    b.addEventListener("click", () => showReceipt(b.dataset.viewReceipt))
  );
  list.querySelectorAll("[data-del-sale]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this sale?")) return;
      await DB.delete("sales", b.dataset.delSale);
      toast("Sale deleted");
      renderSales();
      renderDashboard();
    })
  );
}

async function showReceipt(saleId) {
  const sale = await DB.get("sales", saleId);
  if (!sale) return;
  const shopName = (await DB.getSetting("shop_name")) || "VLR Cutz";
  const shopPhone = (await DB.getSetting("shop_phone")) || "";
  const time = new Date(sale.timestamp).toLocaleString("en-IN");
  const itemsHtml = sale.items.map((i) => `<div class="row-between"><span>${escapeHtml(i.name)}</span><span>${fmt(i.price)}</span></div>`).join("");
  document.getElementById("receiptContent").innerHTML = `
    <h3>${escapeHtml(shopName)}</h3>
    ${shopPhone ? `<div>${escapeHtml(shopPhone)}</div>` : ""}
    <div class="muted">${time}</div>
    <div class="hr"></div>
    ${itemsHtml}
    <div class="hr"></div>
    <div class="row-between"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    ${sale.discountAmount ? `<div class="row-between"><span>Discount</span><span>-${fmt(sale.discountAmount)}</span></div>` : ""}
    <div class="row-between" style="font-weight:700;font-size:16px;"><span>Total</span><span>${fmt(sale.total)}</span></div>
    ${sale.dueAmount > 0 ? `
    <div class="row-between"><span>Received</span><span>${fmt(sale.amountReceived)}</span></div>
    <div class="row-between" style="color:#a63d40;font-weight:700;"><span>Pending</span><span>${fmt(sale.dueAmount)}</span></div>` : ""}
    <div class="muted mt-8">${sale.paymentMethod}${sale.customerName ? " · " + escapeHtml(sale.customerName) : ""}</div>
    ${sale.notes ? `<div class="muted mt-8">Note: ${escapeHtml(sale.notes)}</div>` : ""}
  `;
  document.getElementById("receiptModal").dataset.saleId = saleId;
  openModal("receiptModal");
}

document.getElementById("receiptCloseBtn").addEventListener("click", () => closeModal("receiptModal"));
document.getElementById("receiptShareBtn").addEventListener("click", async () => {
  const saleId = document.getElementById("receiptModal").dataset.saleId;
  const sale = await DB.get("sales", saleId);
  if (!sale) return;
  const shopName = (await DB.getSetting("shop_name")) || "VLR Cutz";
  const lines = [
    `*${shopName}*`,
    new Date(sale.timestamp).toLocaleString("en-IN"),
    "",
    ...sale.items.map((i) => `${i.name} - ${fmt(i.price)}`),
    "",
    `Subtotal: ${fmt(sale.subtotal)}`,
  ];
  if (sale.discountAmount) lines.push(`Discount: -${fmt(sale.discountAmount)}`);
  lines.push(`Total: ${fmt(sale.total)}`, `Payment: ${sale.paymentMethod}`);
  const text = encodeURIComponent(lines.join("\n"));
  const phone = sale.customerId ? (customers.find((c) => c.id === sale.customerId) || {}).phone : "";
  const waUrl = phone ? `https://wa.me/${phone.replace(/[^0-9]/g,"")}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(waUrl, "_blank");
});

// ---- record sale modal ----
function resetSaleDraft() {
  saleDraft = { items: [], payment: "Cash", discountType: "none", discountValue: 0 };
  amountReceivedTouched = false;
  document.getElementById("saleCustomerInput").value = "";
  document.getElementById("saleCustomerPhone").value = "";
  document.getElementById("saleNotes").value = "";
  document.getElementById("saleDiscountType").value = "none";
  document.getElementById("saleDiscountValue").value = 0;
  document.getElementById("saleAmountReceived").value = 0;
  document.getElementById("salePendingNote").textContent = "";
  document.querySelectorAll("#salePaymentChips .chip").forEach((c, i) => c.classList.toggle("selected", i === 0));
}

async function openSaleModal() {
  await reloadData();
  resetSaleDraft();
  const chipsEl = document.getElementById("saleServiceChips");
  const active = services.filter((s) => s.active !== false);
  if (!active.length) {
    chipsEl.innerHTML = '<span class="muted">No services yet — add one under More → Services.</span>';
  } else {
    chipsEl.innerHTML = active.map((s) => `<div class="chip" data-svc="${s.id}">${escapeHtml(s.name)} · ${fmt(s.price)}</div>`).join("");
    chipsEl.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
      const svc = services.find((s) => s.id === chip.dataset.svc);
      saleDraft.items.push({ serviceId: svc.id, name: svc.name, price: svc.price });
      renderSaleSelectedItems();
    }));
  }
  const dl = document.getElementById("customerDatalist");
  dl.innerHTML = customers.map((c) => `<option value="${escapeHtml(c.name)}">`).join("");
  renderSaleSelectedItems();
  openModal("saleModal");
}

function renderSaleSelectedItems() {
  const wrap = document.getElementById("saleSelectedItems");
  if (!saleDraft.items.length) {
    wrap.innerHTML = '<div class="muted" style="font-size:13px;">No services added yet — tap chips above.</div>';
  } else {
    wrap.innerHTML = saleDraft.items.map((it, idx) => `
      <div class="selected-item-row">
        <span>${escapeHtml(it.name)} — ${fmt(it.price)}</span>
        <button data-remove-idx="${idx}">✕</button>
      </div>`).join("");
    wrap.querySelectorAll("[data-remove-idx]").forEach((b) => b.addEventListener("click", () => {
      saleDraft.items.splice(Number(b.dataset.removeIdx), 1);
      renderSaleSelectedItems();
    }));
  }
  recalcSaleTotals();
}

function recalcSaleTotals() {
  const subtotal = saleDraft.items.reduce((a, i) => a + i.price, 0);
  const dType = document.getElementById("saleDiscountType").value;
  const dVal = parseFloat(document.getElementById("saleDiscountValue").value) || 0;
  let discountAmt = 0;
  if (dType === "percent") discountAmt = subtotal * (dVal / 100);
  else if (dType === "flat") discountAmt = dVal;
  discountAmt = Math.min(discountAmt, subtotal);
  const total = subtotal - discountAmt;
  document.getElementById("saleSubtotal").textContent = fmt(subtotal);
  document.getElementById("saleDiscountAmt").textContent = fmt(discountAmt);
  document.getElementById("saleTotal").textContent = fmt(total);

  const receivedInput = document.getElementById("saleAmountReceived");
  if (!amountReceivedTouched) receivedInput.value = total || 0;
  updatePendingNote(total);
}

function updatePendingNote(total) {
  const received = parseFloat(document.getElementById("saleAmountReceived").value) || 0;
  const due = Math.max(0, total - received);
  const note = document.getElementById("salePendingNote");
  note.textContent = due > 0
    ? `₹${due.toFixed(0)} will be marked pending — add a customer name so it's tracked.`
    : "";
}

document.getElementById("saleAmountReceived").addEventListener("input", () => {
  amountReceivedTouched = true;
  const totalText = document.getElementById("saleTotal").textContent.replace(/[^0-9.]/g, "");
  updatePendingNote(parseFloat(totalText) || 0);
});

document.getElementById("saleDiscountType").addEventListener("change", recalcSaleTotals);
document.getElementById("saleDiscountValue").addEventListener("input", recalcSaleTotals);
document.getElementById("salePaymentChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#salePaymentChips .chip").forEach((c) => c.classList.remove("selected"));
  chip.classList.add("selected");
});

document.getElementById("fabAddSale").addEventListener("click", openSaleModal);
document.getElementById("saleCancelBtn").addEventListener("click", () => closeModal("saleModal"));

document.getElementById("saleSaveBtn").addEventListener("click", async () => {
  if (!saleDraft.items.length) { toast("Add at least one service"); return; }
  const subtotal = saleDraft.items.reduce((a, i) => a + i.price, 0);
  const dType = document.getElementById("saleDiscountType").value;
  const dVal = parseFloat(document.getElementById("saleDiscountValue").value) || 0;
  let discountAmt = 0;
  if (dType === "percent") discountAmt = subtotal * (dVal / 100);
  else if (dType === "flat") discountAmt = dVal;
  discountAmt = Math.min(discountAmt, subtotal);
  const total = subtotal - discountAmt;
  const payChip = document.querySelector("#salePaymentChips .chip.selected");
  const paymentMethod = payChip ? payChip.dataset.pay : "Cash";
  const custName = document.getElementById("saleCustomerInput").value.trim();
  const custPhone = document.getElementById("saleCustomerPhone").value.trim();
  const notes = document.getElementById("saleNotes").value.trim();

  let amountReceived = parseFloat(document.getElementById("saleAmountReceived").value);
  if (isNaN(amountReceived) || amountReceived < 0) amountReceived = total;
  amountReceived = Math.min(amountReceived, total);
  const dueAmount = Math.round((total - amountReceived) * 100) / 100;

  if (dueAmount > 0 && !custName) {
    toast("Add a customer name to track this pending due");
    return;
  }

  let customerId = null;
  if (custName) {
    let existing = customers.find((c) => c.name.toLowerCase() === custName.toLowerCase());
    if (!existing && custPhone) existing = customers.find((c) => c.phone === custPhone);
    if (existing) {
      customerId = existing.id;
      if (custPhone && !existing.phone) { existing.phone = custPhone; await DB.put("customers", existing); }
    } else {
      const newCust = { id: DB.uid(), name: custName, phone: custPhone, createdAt: new Date().toISOString() };
      await DB.put("customers", newCust);
      customers.push(newCust);
      customerId = newCust.id;
    }
  }

  const sale = {
    id: DB.uid(),
    timestamp: new Date().toISOString(),
    items: saleDraft.items.slice(),
    customerId,
    customerName: custName || null,
    paymentMethod,
    discountType: dType,
    discountValue: dVal,
    subtotal,
    discountAmount: discountAmt,
    total,
    amountReceived,
    dueAmount,
    notes,
  };
  await DB.put("sales", sale);
  closeModal("saleModal");
  toast(dueAmount > 0 ? `Sale saved — ₹${dueAmount.toFixed(0)} pending` : "Sale saved");
  renderDashboard();
  if (document.getElementById("screen-sales").classList.contains("active")) renderSales();
  showReceipt(sale.id);
});

// ==========================================================================
// EXPENSES
// ==========================================================================
let currentExpenseRange = "today";
document.getElementById("expenseRangeTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-range]");
  if (!btn) return;
  document.querySelectorAll("#expenseRangeTabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentExpenseRange = btn.dataset.range;
  renderExpenses();
});

async function renderExpenses() {
  const [start, end] = rangeBounds(currentExpenseRange);
  const expenses = (await DB.getAll("expenses"))
    .filter((e) => inRange(e.timestamp, start, end))
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  const list = document.getElementById("expensesList");
  if (!expenses.length) {
    list.innerHTML = '<div class="empty-state"><div class="big">💸</div>No expenses in this period.</div>';
    return;
  }
  list.innerHTML = expenses.map((e) => {
    const time = new Date(e.timestamp).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    return `
      <div class="list-row">
        <div class="main"><div class="name">${escapeHtml(e.category)}</div><div class="meta">${time}${e.note ? " · " + escapeHtml(e.note) : ""}</div></div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="amt bad">-${fmt(e.amount)}</div>
          <button class="btn danger small" data-del-exp="${e.id}">🗑</button>
        </div>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-del-exp]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this expense?")) return;
    await DB.delete("expenses", b.dataset.delExp);
    toast("Expense deleted");
    renderExpenses();
    renderDashboard();
  }));
}

document.getElementById("expenseDate").addEventListener("focus", function () {
  if (!this.value) this.value = dateKey(new Date());
});

function openExpenseModal() {
  document.getElementById("expenseCategory").value = "Products";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expenseNote").value = "";
  document.getElementById("expenseDate").value = dateKey(new Date());
  openModal("expenseModal");
}
document.getElementById("addExpenseBtn").addEventListener("click", openExpenseModal);
document.getElementById("expenseCancelBtn").addEventListener("click", () => closeModal("expenseModal"));
document.getElementById("expenseSaveBtn").addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  if (!amount || amount <= 0) { toast("Enter a valid amount"); return; }
  const dateVal = document.getElementById("expenseDate").value || dateKey(new Date());
  const expense = {
    id: DB.uid(),
    timestamp: new Date(dateVal + "T12:00:00").toISOString(),
    category: document.getElementById("expenseCategory").value,
    amount,
    note: document.getElementById("expenseNote").value.trim(),
  };
  await DB.put("expenses", expense);
  closeModal("expenseModal");
  toast("Expense saved");
  renderExpenses();
  renderDashboard();
});

// ==========================================================================
// CUSTOMERS
// ==========================================================================
async function renderCustomers() {
  await reloadData();
  const search = document.getElementById("customerSearch").value.trim().toLowerCase();
  const sales = await DB.getAll("sales");
  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search) || (c.phone || "").includes(search)
  );
  const list = document.getElementById("customersList");
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><div class="big">👥</div>No customers yet. They\'re added automatically when you log a sale with a name.</div>';
    return;
  }
  const rows = filtered.map((c) => {
    const custSales = sales.filter((s) => s.customerId === c.id);
    const totalSpent = custSales.reduce((a, s) => a + s.total, 0);
    const pending = custSales.reduce((a, s) => a + (s.dueAmount || 0), 0);
    return { c, visits: custSales.length, totalSpent, pending };
  }).sort((a,b) => b.totalSpent - a.totalSpent);

  list.innerHTML = rows.map(({c, visits, totalSpent, pending}) => `
    <div class="list-row" style="cursor:pointer;" data-cust="${c.id}">
      <div class="main"><div class="name">${escapeHtml(c.name)}</div><div class="meta">${c.phone ? escapeHtml(c.phone) + " · " : ""}${visits} visit${visits===1?"":"s"}${pending > 0 ? ` · <span style="color:var(--bad);">₹${pending.toFixed(0)} due</span>` : ""}</div></div>
      <div class="amt">${fmt(totalSpent)}</div>
    </div>`).join("");
  list.querySelectorAll("[data-cust]").forEach((row) => row.addEventListener("click", () => showCustomerDetail(row.dataset.cust)));
}
document.getElementById("customerSearch").addEventListener("input", renderCustomers);

async function showCustomerDetail(custId) {
  const cust = customers.find((c) => c.id === custId) || (await DB.get("customers", custId));
  const sales = (await DB.getAll("sales")).filter((s) => s.customerId === custId).sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
  const totalSpent = sales.reduce((a,s) => a+s.total, 0);
  const pendingTotal = sales.reduce((a,s) => a+(s.dueAmount||0), 0);
  document.getElementById("customerModalName").textContent = cust.name;
  document.getElementById("custTotalSpent").textContent = fmt(totalSpent);
  document.getElementById("custVisits").textContent = sales.length;
  document.getElementById("custPendingDue").textContent = fmt(pendingTotal);

  const tally = {};
  sales.forEach((s) => s.items.forEach((i) => { tally[i.name] = (tally[i.name]||0)+1; }));
  const fav = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById("custFavService").textContent = fav ? `Favorite service: ${fav[0]} (${fav[1]}×)` : "No visits yet.";

  const hist = document.getElementById("custHistory");
  if (!sales.length) {
    hist.innerHTML = '<div class="empty-state">No visits yet.</div>';
  } else {
    hist.innerHTML = sales.map((s) => {
      const time = new Date(s.timestamp).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
      const due = s.dueAmount || 0;
      return `<div class="list-row">
        <div class="main"><div class="name">${escapeHtml(s.items.map(i=>i.name).join(", "))}</div><div class="meta">${time}${due>0 ? ` · <span style="color:var(--bad);">₹${due.toFixed(0)} due</span>` : ""}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="amt">${fmt(s.total)}</div>
          ${due > 0 ? `<button class="btn small" data-settle="${s.id}">Mark paid</button>` : ""}
        </div>
      </div>`;
    }).join("");
    hist.querySelectorAll("[data-settle]").forEach((b) => b.addEventListener("click", async () => {
      await markSaleSettled(b.dataset.settle);
      showCustomerDetail(custId);
    }));
  }
  openModal("customerModal");
}

async function markSaleSettled(saleId) {
  const sale = await DB.get("sales", saleId);
  if (!sale) return;
  sale.amountReceived = sale.total;
  sale.dueAmount = 0;
  await DB.put("sales", sale);
  toast("Marked as paid");
  renderDashboard();
}
document.getElementById("customerCloseBtn").addEventListener("click", () => closeModal("customerModal"));

// ==========================================================================
// SERVICES
// ==========================================================================
async function renderServicesList() {
  await reloadData();
  const list = document.getElementById("servicesList");
  if (!services.length) {
    list.innerHTML = '<div class="empty-state">No services yet. Add your first one.</div>';
    return;
  }
  const byCat = {};
  services.forEach((s) => { (byCat[s.category] = byCat[s.category] || []).push(s); });
  list.innerHTML = Object.entries(byCat).map(([cat, items]) => `
    <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 2px;">${escapeHtml(cat)}</div>
    ${items.map((s) => `
      <div class="list-row" style="cursor:pointer;" data-svc-edit="${s.id}">
        <div class="main"><div class="name">${escapeHtml(s.name)}</div></div>
        <div class="amt">${fmt(s.price)}</div>
      </div>`).join("")}
  `).join("");
  list.querySelectorAll("[data-svc-edit]").forEach((row) => row.addEventListener("click", () => openServiceModal(row.dataset.svcEdit)));
}

function openServiceModal(editId = null) {
  const deleteBtn = document.getElementById("serviceDeleteBtn");
  if (editId) {
    const s = services.find((x) => x.id === editId);
    document.getElementById("serviceModalTitle").textContent = "Edit service";
    document.getElementById("serviceEditId").value = editId;
    document.getElementById("serviceName").value = s.name;
    document.getElementById("serviceCategory").value = s.category;
    document.getElementById("servicePrice").value = s.price;
    deleteBtn.classList.remove("hidden");
  } else {
    document.getElementById("serviceModalTitle").textContent = "Add service";
    document.getElementById("serviceEditId").value = "";
    document.getElementById("serviceName").value = "";
    document.getElementById("serviceCategory").value = "Haircut";
    document.getElementById("servicePrice").value = "";
    deleteBtn.classList.add("hidden");
  }
  openModal("serviceModal");
}
document.getElementById("addServiceBtn").addEventListener("click", () => openServiceModal());
document.getElementById("serviceCancelBtn").addEventListener("click", () => closeModal("serviceModal"));
document.getElementById("serviceSaveBtn").addEventListener("click", async () => {
  const name = document.getElementById("serviceName").value.trim();
  const price = parseFloat(document.getElementById("servicePrice").value);
  if (!name || !(price >= 0)) { toast("Enter a name and valid price"); return; }
  const editId = document.getElementById("serviceEditId").value;
  const service = {
    id: editId || DB.uid(),
    name,
    category: document.getElementById("serviceCategory").value,
    price,
    active: true,
  };
  await DB.put("services", service);
  closeModal("serviceModal");
  toast("Service saved");
  renderServicesList();
});
document.getElementById("serviceDeleteBtn").addEventListener("click", async () => {
  const editId = document.getElementById("serviceEditId").value;
  if (!editId || !confirm("Delete this service? Past sales keep their recorded price.")) return;
  await DB.delete("services", editId);
  closeModal("serviceModal");
  toast("Service deleted");
  renderServicesList();
});

// ==========================================================================
// REPORTS
// ==========================================================================
let currentReportPeriod = "daily";
document.getElementById("reportTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-period]");
  if (!btn) return;
  document.querySelectorAll("#reportTabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentReportPeriod = btn.dataset.period;
  renderReports();
});

async function renderReports() {
  const sales = await DB.getAll("sales");
  const expenses = await DB.getAll("expenses");
  const now = new Date();
  let start, end, labels = [], buckets = [];

  if (currentReportPeriod === "daily") {
    // last 14 days
    start = startOfDay(new Date(now.getTime() - 13*86400000));
    end = endOfDay(now);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      buckets.push([startOfDay(d), endOfDay(d)]);
      labels.push(d.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit" }));
    }
  } else if (currentReportPeriod === "weekly") {
    // last 8 weeks
    const wkStart = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const s = new Date(wkStart); s.setDate(s.getDate() - i*7);
      const e = new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999);
      buckets.push([s, e]);
      labels.push(s.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit" }));
    }
    start = buckets[0][0]; end = buckets[buckets.length-1][1];
  } else if (currentReportPeriod === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const s = startOfMonth(d);
      const e = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
      buckets.push([s, e]);
      labels.push(d.toLocaleDateString("en-IN", { month:"short" }));
    }
    start = buckets[0][0]; end = buckets[buckets.length-1][1];
  } else {
    const thisYear = now.getFullYear();
    for (let y = thisYear-4; y <= thisYear; y++) {
      buckets.push([new Date(y,0,1), new Date(y,11,31,23,59,59,999)]);
      labels.push(String(y));
    }
    start = buckets[0][0]; end = buckets[buckets.length-1][1];
  }

  const values = buckets.map(([s,e]) => sales.filter((sl)=>inRange(sl.timestamp,s,e)).reduce((a,sl)=>a+sl.total,0));
  Charts.bar(document.getElementById("reportChart"), labels, values);

  const periodSales = sales.filter((s) => inRange(s.timestamp, start, end));
  const periodExpenses = expenses.filter((e) => inRange(e.timestamp, start, end));
  const income = periodSales.reduce((a,s)=>a+s.total,0);
  const expTotal = periodExpenses.reduce((a,e)=>a+e.amount,0);
  document.getElementById("repIncome").textContent = fmt(income);
  document.getElementById("repExpenses").textContent = fmt(expTotal);
  document.getElementById("repProfit").textContent = fmt(income - expTotal);
  document.getElementById("repCount").textContent = periodSales.reduce((a,s)=>a+s.items.length,0);

  const tally = {};
  periodSales.forEach((s) => s.items.forEach((i) => { tally[i.name] = (tally[i.name]||0)+1; }));
  const sorted = Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const bs = document.getElementById("repBestSellers");
  bs.innerHTML = sorted.length
    ? sorted.map(([name,count]) => `<div class="list-row"><div class="main"><div class="name">${escapeHtml(name)}</div></div><div class="amt">${count}×</div></div>`).join("")
    : '<div class="empty-state">No data for this period.</div>';
}

// ==========================================================================
// PENDING DUES
// ==========================================================================
async function renderPending() {
  const sales = (await DB.getAll("sales")).filter((s) => (s.dueAmount || 0) > 0)
    .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const total = sales.reduce((a, s) => a + s.dueAmount, 0);
  document.getElementById("pendingTotal").textContent = fmt(total);

  const list = document.getElementById("pendingList");
  if (!sales.length) {
    list.innerHTML = '<div class="empty-state"><div class="big">🧾</div>No pending dues. Everyone\'s paid up.</div>';
    return;
  }
  list.innerHTML = sales.map((s) => {
    const time = new Date(s.timestamp).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const name = s.customerName || "Unnamed customer";
    return `
      <div class="list-row">
        <div class="main">
          <div class="name">${escapeHtml(name)}</div>
          <div class="meta">${escapeHtml(s.items.map(i=>i.name).join(", "))} · ${time}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="amt bad">₹${s.dueAmount.toFixed(0)}</div>
          <button class="btn small" data-settle-pending="${s.id}">Mark paid</button>
        </div>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-settle-pending]").forEach((b) => b.addEventListener("click", async () => {
    await markSaleSettled(b.dataset.settlePending);
    renderPending();
  }));
}

// ==========================================================================
// SETTINGS / BACKUP
// ==========================================================================
async function loadSettingsScreen() {
  document.getElementById("setShopName").value = (await DB.getSetting("shop_name")) || "";
  document.getElementById("setShopPhone").value = (await DB.getSetting("shop_phone")) || "";
  const cfg = await Cloud.getConfig();
  document.getElementById("setSbUrl").value = cfg.url || "";
  document.getElementById("setSbKey").value = cfg.key || "";
  document.getElementById("setSbBackupId").value = cfg.backupId || "";
  const lastBackup = await DB.getSetting("last_backup_at");
  document.getElementById("lastBackupInfo").textContent = lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleString("en-IN")}` : "No backup yet.";
}

document.getElementById("saveShopInfoBtn").addEventListener("click", async () => {
  await DB.setSetting("shop_name", document.getElementById("setShopName").value.trim());
  await DB.setSetting("shop_phone", document.getElementById("setShopPhone").value.trim());
  toast("Shop info saved");
});

document.getElementById("saveSbBtn").addEventListener("click", async () => {
  await Cloud.saveConfig({
    url: document.getElementById("setSbUrl").value,
    key: document.getElementById("setSbKey").value,
    backupId: document.getElementById("setSbBackupId").value,
  });
  toast("Backup settings saved");
});

document.getElementById("backupNowBtn").addEventListener("click", async () => {
  try {
    const [localSales, localExpenses, localCustomers] = await Promise.all([
      DB.getAll("sales"), DB.getAll("expenses"), DB.getAll("customers"),
    ]);
    const localCount = localSales.length + localExpenses.length + localCustomers.length;
    const remote = await Cloud.peekRemote();
    if (remote && remote.count > localCount + 3) {
      const proceed = confirm(
        `Your cloud backup has more data (${remote.count} records) than this device (${localCount}). ` +
        `Backing up now will overwrite it with this device's smaller data set.\n\n` +
        `If you meant to bring data DOWN to this device, tap Cancel and use Restore instead.\n\n` +
        `Continue with Backup now anyway?`
      );
      if (!proceed) return;
    }
    toast("Backing up...");
    await Cloud.backupNow();
    toast("Backup complete");
    loadSettingsScreen();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("restoreBtn").addEventListener("click", async () => {
  if (!confirm("This replaces all local data with your last cloud backup. Continue?")) return;
  toast("Restoring...");
  try {
    await Cloud.restoreLatest();
    toast("Restore complete");
    await reloadData();
    renderDashboard();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("wipeDataBtn").addEventListener("click", async () => {
  if (!confirm("This permanently erases ALL local data on this device. This cannot be undone. Continue?")) return;
  if (!confirm("Are you absolutely sure? Consider backing up first.")) return;
  await DB.clearAll();
  await seedDefaultsIfEmpty();
  toast("All local data erased");
  await reloadData();
  showScreen("dashboard");
});

// hook settings screen load into nav
const _origShowScreen = showScreen;
showScreen = function(name) {
  _origShowScreen(name);
  if (name === "settings") loadSettingsScreen();
};

// ==========================================================================
// MODAL HELPERS
// ==========================================================================
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
document.querySelectorAll(".modal-backdrop").forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); });
});

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ==========================================================================
// INIT
// ==========================================================================
async function init() {
  const now = new Date();
  document.getElementById("headerDate").textContent = now.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });

  await seedDefaultsIfEmpty();
  await reloadData();
  showScreen("dashboard");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
