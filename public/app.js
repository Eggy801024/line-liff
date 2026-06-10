const state = {
  menu: null,
  selectedType: "plain",
  selectedPickupDate: "",
  calendarMonthOffset: 0,
  calendarOpen: false,
  fillingCounts: {},
  quantity: 1,
  cart: [],
  lineUserId: "",
  customerName: ""
};

const money = (value) => `$${value}`;
const flavorImages = {
  milk: "/flavors/milk.jpg",
  cheese: "/flavors/cheese.jpg",
  boba: "/flavors/boba.jpg",
  oreo: "/flavors/oreo.jpg",
  taro: "/flavors/taro.jpg",
  brownie: "/flavors/brownie.jpg"
};

function showWelcomeMessage() {
  if (sessionStorage.getItem("welcomeShown") === "1") return;
  const modal = document.querySelector("#welcomeModal");
  modal.hidden = false;
  document.querySelector("#welcomeClose").addEventListener("click", () => {
    modal.hidden = true;
    sessionStorage.setItem("welcomeShown", "1");
  }, { once: true });
}

async function initLiff() {
  const liffId = new URLSearchParams(location.search).get("liffId") || (await fetch("/api/config").then((response) => response.json()).catch(() => ({}))).liffId;
  if (!liffId || typeof liff === "undefined") return;
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    const profile = await liff.getProfile();
    state.lineUserId = profile.userId;
    state.customerName = profile.displayName;
  } catch {
    // The page still works outside LINE for testing.
  }
}

function selectedType() {
  return state.menu.orderTypes.find((item) => item.id === state.selectedType);
}

function selectedFillingTotal() {
  return Object.values(state.fillingCounts).reduce((sum, count) => sum + count, 0);
}

function fillingIdsFromCounts() {
  return Object.entries(state.fillingCounts).flatMap(([id, count]) => Array(count).fill(id));
}

function summarizeNames(names) {
  const counts = new Map();
  names.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  return [...counts.entries()].map(([name, count]) => `${name}x${count}`).join("、");
}

function summarizeItem(type, fillingNames) {
  if (type.id === "mixed") {
    return `原味x3 + ${summarizeNames(fillingNames)}`;
  }
  return fillingNames.length ? summarizeNames(fillingNames) : "原味x6";
}

function formatDateValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(date) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

function getPickupWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 29);
  return { start, end };
}

function makeMonthDate(offset) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

function renderPickupDates() {
  const input = document.querySelector("#pickupDate");
  const trigger = document.querySelector("#pickupDateTrigger");
  const popover = document.querySelector("#calendarPopover");
  const title = document.querySelector("#calendarTitle");
  const grid = document.querySelector("#pickupDateGrid");
  const closedDates = new Set(state.menu.closedDates || []);
  const { start, end } = getPickupWindow();
  const selectedStillAvailable = state.selectedPickupDate && !closedDates.has(state.selectedPickupDate);

  if (!selectedStillAvailable) {
    const cursor = new Date(start);
    state.selectedPickupDate = "";
    while (cursor <= end) {
      const value = formatDateValue(cursor);
      if (!closedDates.has(value)) {
        state.selectedPickupDate = value;
        break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  input.value = state.selectedPickupDate;
  trigger.textContent = state.selectedPickupDate
    ? formatDateLabel(new Date(`${state.selectedPickupDate}T00:00:00`))
    : "目前沒有可取餐日期";
  document.querySelector("#submitOrder").disabled = !state.selectedPickupDate;
  popover.hidden = !state.calendarOpen;

  const monthDate = makeMonthDate(state.calendarMonthOffset);
  title.textContent = `${monthDate.getFullYear()} / ${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const cells = [];
  for (let i = 0; i < monthStart.getDay(); i += 1) {
    cells.push(`<span class="calendar-empty"></span>`);
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const value = formatDateValue(date);
    const isClosed = closedDates.has(value);
    const outOfRange = date < start || date > end;
    const disabled = isClosed || outOfRange;
    cells.push(`
      <button type="button" class="calendar-day ${isClosed ? "closed" : ""} ${value === state.selectedPickupDate ? "selected" : ""}" data-pickup-date="${value}" ${disabled ? "disabled" : ""}>
        <strong>${day}</strong>
      </button>
    `);
  }

  grid.innerHTML = cells.join("");
  const prevMonth = makeMonthDate(state.calendarMonthOffset - 1);
  const nextMonth = makeMonthDate(state.calendarMonthOffset + 1);
  document.querySelector("#prevMonth").disabled = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0) < start;
  document.querySelector("#nextMonth").disabled = nextMonth > end;
}

function renderPickupTimes() {
  const select = document.querySelector("#pickupTime");
  const options = [];
  for (let hour = 15; hour <= 18; hour += 1) {
    for (const minute of ["00", "15", "30", "45"]) {
      if (hour === 18 && !["00", "15", "30"].includes(minute)) continue;
      const time = `${String(hour).padStart(2, "0")}:${minute}`;
      options.push(`<option value="${time}">${time}</option>`);
    }
  }
  select.innerHTML = options.join("");
  select.value = "15:00";
}

function renderTypes() {
  const target = document.querySelector("#typeGrid");
  target.innerHTML = state.menu.orderTypes.map((item) => `
    <button type="button" class="choice ${item.id === state.selectedType ? "selected" : ""}" data-type="${item.id}">
      <span class="food-icon">🥞</span>
      <strong>${item.name}</strong>
      <small>${item.description}</small>
      <b>${money(item.basePrice)}</b>
    </button>
  `).join("");
}

function renderFillings() {
  const type = selectedType();
  const section = document.querySelector("#fillingSection");
  section.hidden = type.maxFillings === 0;
  if (type.maxFillings === 0) {
    state.fillingCounts = {};
    return;
  }

  const total = selectedFillingTotal();
  document.querySelector("#fillingHelp").textContent = `請分配 ${type.maxFillings} 個口味，已選 ${total}/${type.maxFillings}`;
  document.querySelector("#fillingGrid").innerHTML = state.menu.fillings.map((item) => {
    const count = state.fillingCounts[item.id] || 0;
    return `
      <article class="choice filling-counter ${count ? "selected" : ""}">
        <img class="flavor-photo" src="${flavorImages[item.id]}" alt="${item.name}">
        <strong>${item.name}</strong>
        <div class="mini-stepper">
          <button type="button" data-filling-step="-1" data-filling="${item.id}" ${count === 0 ? "disabled" : ""}>-</button>
          <output>${count}</output>
          <button type="button" data-filling-step="1" data-filling="${item.id}" ${total >= type.maxFillings ? "disabled" : ""}>+</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderQuantity() {
  document.querySelector("#quantity").textContent = state.quantity;
}

function itemFlavorText(item) {
  return item.fillingSummary || summarizeNames(item.fillingNames || []) || "原味";
}

function renderCart() {
  const target = document.querySelector("#cartList");
  const total = state.cart.reduce((sum, item) => sum + item.subtotal, 0);
  document.querySelector("#cartTotal").textContent = money(total);

  if (state.cart.length === 0) {
    target.className = "cart-list empty";
    target.textContent = "尚未加入餐點";
    return;
  }

  target.className = "cart-list";
  target.innerHTML = state.cart.map((item, index) => `
    <article class="cart-item">
      <div>
        <strong>${item.orderTypeName}</strong>
        <span>${itemFlavorText(item)} x ${item.quantity} 組</span>
      </div>
      <button type="button" data-remove="${index}">移除</button>
      <b>${money(item.subtotal)}</b>
    </article>
  `).join("");
}

function renderHistory() {
  const target = document.querySelector("#historyList");
  const history = JSON.parse(localStorage.getItem("orderHistory") || "[]").slice(0, 3);
  if (history.length === 0) {
    target.className = "history-list empty";
    target.textContent = "尚無歷史紀錄";
    return;
  }

  target.className = "history-list";
  target.innerHTML = history.map((order, index) => `
    <button type="button" data-reorder="${index}">
      <strong>#${order.number}</strong>
      <span>${order.items.map((item) => `${item.orderTypeName}x${item.quantity}組`).join("、")}</span>
      <b>${money(order.total)}</b>
    </button>
  `).join("");
}

function buildItem() {
  const type = selectedType();
  const required = type.maxFillings;
  const fillingIds = fillingIdsFromCounts();
  if (required > 0 && fillingIds.length !== required) {
    throw new Error(`${type.name} 要選滿 ${required} 個口味`);
  }

  const fillingNames = fillingIds.map((id) => state.menu.fillings.find((item) => item.id === id).name);
  return {
    orderTypeId: type.id,
    orderTypeName: type.name,
    fillingIds,
    fillingNames,
    fillingSummary: summarizeItem(type, fillingNames),
    quantity: state.quantity,
    unitLabel: "組",
    unitPrice: type.basePrice,
    subtotal: type.basePrice * state.quantity
  };
}

function bindEvents() {
  document.body.addEventListener("click", async (event) => {
    const typeButton = event.target.closest("[data-type]");
    if (typeButton) {
      state.selectedType = typeButton.dataset.type;
      state.fillingCounts = {};
      renderTypes();
      renderFillings();
    }

    const fillingStep = event.target.closest("[data-filling-step]");
    if (fillingStep) {
      const id = fillingStep.dataset.filling;
      const step = Number(fillingStep.dataset.fillingStep);
      const total = selectedFillingTotal();
      const required = selectedType().maxFillings;
      const current = state.fillingCounts[id] || 0;

      if (step > 0 && total < required) {
        state.fillingCounts[id] = current + 1;
      }
      if (step < 0 && current > 0) {
        state.fillingCounts[id] = current - 1;
      }
      renderFillings();
    }

    const pickupDateButton = event.target.closest("[data-pickup-date]");
    if (pickupDateButton && !pickupDateButton.disabled) {
      state.selectedPickupDate = pickupDateButton.dataset.pickupDate;
      document.querySelector("#pickupDate").value = state.selectedPickupDate;
      state.calendarOpen = false;
      renderPickupDates();
    }

    const stepButton = event.target.closest("[data-step]");
    if (stepButton) {
      state.quantity = Math.max(1, Math.min(50, state.quantity + Number(stepButton.dataset.step)));
      renderQuantity();
    }

    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      state.cart.splice(Number(removeButton.dataset.remove), 1);
      renderCart();
    }

    const reorderButton = event.target.closest("[data-reorder]");
    if (reorderButton) {
      const history = JSON.parse(localStorage.getItem("orderHistory") || "[]");
      const order = history[Number(reorderButton.dataset.reorder)];
      state.cart = order.items.map((item) => ({ ...item }));
      renderCart();
    }
  });

  document.querySelector("#pickupDateTrigger").addEventListener("click", () => {
    state.calendarOpen = !state.calendarOpen;
    renderPickupDates();
  });

  document.querySelector("#prevMonth").addEventListener("click", () => {
    state.calendarMonthOffset -= 1;
    renderPickupDates();
  });

  document.querySelector("#nextMonth").addEventListener("click", () => {
    state.calendarMonthOffset += 1;
    renderPickupDates();
  });

  document.querySelector("#addItem").addEventListener("click", () => {
    const result = document.querySelector("#result");
    try {
      state.cart.push(buildItem());
      state.quantity = 1;
      state.fillingCounts = {};
      result.textContent = "";
      renderQuantity();
      renderFillings();
      renderCart();
    } catch (error) {
      result.textContent = error.message;
    }
  });

  document.querySelector("#submitOrder").addEventListener("click", async () => {
    const result = document.querySelector("#result");
    if (state.cart.length === 0) {
      result.textContent = "先加入餐點";
      return;
    }

    const phone = document.querySelector("#phone").value.trim();
    if (!/^\d{10}$/.test(phone)) {
      result.textContent = "請輸入 10 碼完整電話號碼，方便店家通知取餐";
      return;
    }

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: document.querySelector("#customerName").value || state.customerName,
        lineUserId: state.lineUserId,
        phone,
        pickupDate: document.querySelector("#pickupDate").value,
        pickupTime: document.querySelector("#pickupTime").value,
        note: document.querySelector("#note").value,
        items: state.cart
      })
    });
    const data = await response.json();
    if (!response.ok) {
      result.textContent = data.error || "送出失敗";
      return;
    }

    state.cart = [];
    const history = JSON.parse(localStorage.getItem("orderHistory") || "[]");
    localStorage.setItem("orderHistory", JSON.stringify([data, ...history].slice(0, 6)));
    document.querySelector("#note").value = "";
    renderCart();
    renderHistory();
    result.textContent = `訂單 #${data.number} 已送出，請等候店家接單`;
  });
}

async function boot() {
  showWelcomeMessage();
  await initLiff();
  state.menu = await fetch("/api/menu").then((response) => response.json());
  document.querySelector("#customerName").value = state.customerName;
  renderPickupDates();
  renderPickupTimes();
  renderTypes();
  renderFillings();
  renderQuantity();
  renderCart();
  renderHistory();
  bindEvents();
}

boot();
