const statusText = {
  new: "待接單",
  accepted: "製作中",
  done: "已完成",
  cancelled: "取消"
};

let tab = "active";
let orders = [];
let settings = null;
let adminPassword = sessionStorage.getItem("adminPassword") || "";

const money = (value) => `$${value}`;

function adminHeaders() {
  return { "X-Admin-Password": adminPassword };
}

async function getConfiguredLiffId() {
  const queryLiffId = new URLSearchParams(location.search).get("liffId");
  if (queryLiffId) return queryLiffId;
  const config = await fetch("/api/config").then((response) => response.json()).catch(() => ({}));
  return config.liffId || "";
}

function toClosedDateInputValue(dateText) {
  const match = String(dateText).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateText;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function normalizeClosedDateToken(token) {
  const text = token.trim();
  if (!text) return "";

  const fullDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const shortDate = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  const year = new Date().getFullYear();
  const parsed = fullDate
    ? { year: Number(fullDate[1]), month: Number(fullDate[2]), day: Number(fullDate[3]) }
    : shortDate
      ? { year, month: Number(shortDate[1]), day: Number(shortDate[2]) }
      : null;

  if (!parsed) throw new Error(`公休日格式錯誤：${text}`);

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  if (date.getFullYear() !== parsed.year || date.getMonth() !== parsed.month - 1 || date.getDate() !== parsed.day) {
    throw new Error(`公休日日期不存在：${text}`);
  }

  return [
    parsed.year,
    String(parsed.month).padStart(2, "0"),
    String(parsed.day).padStart(2, "0")
  ].join("-");
}

function parseClosedDates(value) {
  return [...new Set(
    value
      .split(/[\s,，、]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeClosedDateToken)
  )];
}

function sameTaipeiDate(iso) {
  const orderDate = new Date(iso).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
  const today = new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
  return orderDate === today;
}

function visibleOrders() {
  if (tab === "new") return orders.filter((order) => order.status === "new");
  if (tab === "done") return orders.filter((order) => order.status === "done");
  return orders.filter((order) => order.status !== "done" && order.status !== "cancelled");
}

function renderAuthState(isLoggedIn) {
  document.querySelector("#loginPanel").hidden = isLoggedIn;
  document.querySelector("#adminContent").hidden = !isLoggedIn;
}

function handleUnauthorized() {
  sessionStorage.removeItem("adminPassword");
  adminPassword = "";
  renderAuthState(false);
  document.querySelector("#loginResult").textContent = "後台密碼錯誤";
}

function renderStats() {
  const today = orders.filter((order) => sameTaipeiDate(order.createdAt));
  document.querySelector("#todayCount").textContent = today.length;
  document.querySelector("#todayRevenue").textContent = money(today.reduce((sum, order) => sum + order.total, 0));
  document.querySelector("#pendingCount").textContent = orders.filter((order) => order.status === "new").length;
}

function renderOrders() {
  const target = document.querySelector("#orders");
  const list = visibleOrders();
  if (list.length === 0) {
    target.innerHTML = `<div class="empty-state">目前沒有訂單</div>`;
    return;
  }

  target.innerHTML = list.map((order) => `
    <article class="order-card ${order.status}">
      <div class="order-main">
        <div>
          <h2>#${order.number}</h2>
          <time>${new Date(order.createdAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</time>
        </div>
        <span class="status">${statusText[order.status]}</span>
        <strong>${money(order.total)}</strong>
      </div>
      <div class="order-items">
        <p><b>取餐</b> ${order.pickupDate || ""} ${order.pickupTime || ""}</p>
        <p><b>客人</b> ${order.customer.name} ${order.customer.phone ? ` / ${order.customer.phone}` : ""}</p>
        ${order.items.map((item) => `
          <p><b>${item.orderTypeName}</b> ${item.fillingSummary || item.fillingNames.join("、") || "原味"} x ${item.quantity} 組</p>
        `).join("")}
        ${order.note ? `<p class="note">備註：${order.note}</p>` : ""}
      </div>
      <div class="order-actions">
        ${order.status === "new" ? `<button type="button" data-status="accepted" data-id="${order.id}">接單</button>` : ""}
        ${order.status !== "done" ? `<button type="button" data-print="${order.id}">出單</button>` : ""}
        ${order.status === "accepted" ? `<button type="button" data-status="done" data-id="${order.id}">完成</button>` : ""}
      </div>
    </article>
  `).join("");
}

async function loadOrders() {
  const response = await fetch("/api/orders", { headers: adminHeaders() });
  if (response.status === 401) return handleUnauthorized();
  orders = await response.json();
  renderStats();
  renderOrders();
}

async function loadSettings() {
  const response = await fetch("/api/admin/settings", { headers: adminHeaders() });
  if (response.status === 401) return handleUnauthorized();
  settings = await response.json();
  renderSettings();
}

function renderSettings() {
  document.querySelector("#shopName").value = settings.shopName;
  document.querySelector("#closedDates").value = (settings.closedDates || []).map(toClosedDateInputValue).join("、");
  document.querySelector("#newAdminPassword").value = "";
  document.querySelector("#menuEditor").innerHTML = settings.orderTypes.map((item, index) => `
    <article class="editor-row">
      <label>品項<input data-menu="${index}" data-key="name" value="${item.name}"></label>
      <label>說明<input data-menu="${index}" data-key="description" value="${item.description}"></label>
      <label>價格<input data-menu="${index}" data-key="basePrice" type="number" min="0" value="${item.basePrice}"></label>
    </article>
  `).join("");

}

async function saveSettings() {
  settings.shopName = document.querySelector("#shopName").value;
  try {
    settings.closedDates = parseClosedDates(document.querySelector("#closedDates").value);
  } catch (error) {
    document.querySelector("#settingsResult").textContent = error.message;
    return;
  }

  document.querySelectorAll("[data-menu]").forEach((input) => {
    const item = settings.orderTypes[Number(input.dataset.menu)];
    item[input.dataset.key] = input.value;
  });

  const newPassword = document.querySelector("#newAdminPassword").value.trim();
  const payload = { ...settings };
  if (newPassword) payload.adminPassword = newPassword;

  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload)
  });
  if (response.status === 401) return handleUnauthorized();
  settings = await response.json();
  if (newPassword) {
    adminPassword = newPassword;
    sessionStorage.setItem("adminPassword", newPassword);
  }
  document.querySelector("#settingsResult").textContent = response.ok ? "設定已儲存" : settings.error;
  renderSettings();
}

async function setStatus(id, status) {
  const response = await fetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ status })
  });
  if (response.status === 401) return handleUnauthorized();
  await loadOrders();
}

async function clearOrderHistory() {
  const confirmed = confirm("確定要清空全部歷史訂單嗎？已備份的訂單檔也會一起清除，這個動作不能復原。");
  if (!confirmed) return;

  const response = await fetch("/api/orders/history", {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (response.status === 401) return handleUnauthorized();
  const result = await response.json();
  document.querySelector("#settingsResult").textContent = response.ok
    ? `歷史訂單已清空，已清除 ${result.deletedBackups || 0} 個備份檔`
    : result.error || "清空失敗";
  await loadOrders();
}

async function getShopLineId() {
  const result = document.querySelector("#settingsResult");
  const target = document.querySelector("#shopLineUserId");
  const showResult = (message) => {
    result.textContent = message;
    alert(message);
  };

  if (typeof liff === "undefined") {
    showResult("LINE LIFF 載入失敗，請用 LIFF 網址重新開啟後台");
    return;
  }

  const liffId = await getConfiguredLiffId();
  if (!liffId) {
    showResult("找不到 LIFF ID");
    return;
  }

  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return;
    }

    const profile = await liff.getProfile();
    target.value = profile.userId;
    await navigator.clipboard.writeText(profile.userId).catch(() => {});
    showResult(`店家 LINE 通知 ID：\n${profile.userId}\n\n已嘗試自動複製，可貼到 Render 的 SHOP_NOTIFY_LINE_USER_ID`);
  } catch {
    showResult("取得失敗，請確認後台網址是用 LIFF 開啟，或重新登入 LINE");
  }
}

function printOrder(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  const content = [
    `訂單 #${order.number}`,
    `時間 ${new Date(order.createdAt).toLocaleString("zh-TW")}`,
    ...order.items.map((item) => `${item.orderTypeName} ${item.fillingSummary || item.fillingNames.join("、") || "原味"} x ${item.quantity} 組`),
    order.note ? `備註：${order.note}` : "",
    `合計 ${money(order.total)}`
  ].filter(Boolean).join("\n");
  const win = window.open("", "_blank", "width=320,height=520");
  win.document.write(`<pre style="font-size:18px;line-height:1.5">${content}</pre>`);
  win.document.close();
  win.print();
}

async function login(password) {
  adminPassword = password;
  const response = await fetch("/api/admin/settings", { headers: adminHeaders() });
  if (response.status === 401) return handleUnauthorized();
  sessionStorage.setItem("adminPassword", password);
  settings = await response.json();
  document.querySelector("#loginResult").textContent = "";
  renderAuthState(true);
  renderSettings();
  await loadOrders();
}

document.querySelector("#loginButton").addEventListener("click", () => {
  login(document.querySelector("#adminPasswordInput").value.trim());
});

document.querySelector("#adminPasswordInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") login(event.currentTarget.value.trim());
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("adminPassword");
  adminPassword = "";
  renderAuthState(false);
});

document.querySelector("#tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  tab = button.dataset.tab;
  document.querySelectorAll("#tabs button").forEach((item) => item.classList.toggle("active", item === button));
  renderOrders();
});

document.querySelector("#orders").addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-status]");
  if (statusButton) setStatus(statusButton.dataset.id, statusButton.dataset.status);

  const printButton = event.target.closest("[data-print]");
  if (printButton) printOrder(printButton.dataset.print);
});

document.querySelector("#printTest").addEventListener("click", () => window.print());
document.querySelector("#saveSettings").addEventListener("click", saveSettings);
document.querySelector("#clearOrderHistory").addEventListener("click", clearOrderHistory);
document.querySelector("#getShopLineId").addEventListener("click", getShopLineId);
document.querySelector("#getShopLineIdTop").addEventListener("click", getShopLineId);

if (adminPassword) {
  login(adminPassword);
} else {
  renderAuthState(false);
}

setInterval(() => {
  if (adminPassword) loadOrders();
}, 5000);
