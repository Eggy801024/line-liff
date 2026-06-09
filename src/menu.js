const defaultMenu = {
  shopName: "熱氣球脆皮雞蛋糕",
  adminPassword: "88888888",
  closedDates: [],
  paymentMethods: [
    { id: "linepay", name: "LINE Pay", enabled: true },
    { id: "pluspay", name: "全支付", enabled: true },
    { id: "cash", name: "現場付款", enabled: true }
  ],
  orderTypes: [
    {
      id: "plain",
      name: "原味",
      description: "沒包餡",
      basePrice: 60,
      pieces: 6,
      maxFillings: 0
    },
    {
      id: "filled6",
      name: "加料 6 個",
      description: "6 個可任選口味",
      basePrice: 85,
      pieces: 6,
      maxFillings: 6
    },
    {
      id: "filled3",
      name: "加料 3 個",
      description: "3 個可任選口味",
      basePrice: 50,
      pieces: 3,
      maxFillings: 3
    },
    {
      id: "mixed",
      name: "混搭",
      description: "3 個原味 + 3 個加料",
      basePrice: 75,
      pieces: 6,
      maxFillings: 3
    }
  ],
  fillings: [
    { id: "milk", name: "牛奶奶凍", price: 0 },
    { id: "cheese", name: "香濃起司", price: 0 },
    { id: "boba", name: "黑糖珍珠", price: 0 },
    { id: "oreo", name: "OREO 巧克力", price: 0 },
    { id: "taro", name: "鮮奶蜜芋頭", price: 0 },
    { id: "brownie", name: "榛果布朗尼", price: 0 }
  ]
};

function getOrderType(menu, id) {
  return menu.orderTypes.find((item) => item.id === id);
}

function getFilling(menu, id) {
  return menu.fillings.find((item) => item.id === id);
}

function summarizeFillings(names) {
  const counts = new Map();
  names.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  return [...counts.entries()].map(([name, count]) => `${name}x${count}`).join("、");
}

function summarizeItem(orderType, fillingNames) {
  if (orderType.id === "mixed") {
    return `原味x3 + ${summarizeFillings(fillingNames)}`;
  }
  return fillingNames.length ? summarizeFillings(fillingNames) : "原味x6";
}

function priceForItem(menu, item) {
  const orderType = getOrderType(menu, item.orderTypeId);
  if (!orderType) {
    throw new Error("Unknown order type");
  }
  return orderType.basePrice * item.quantity;
}

function normalizeItem(menu, item) {
  const orderType = getOrderType(menu, item.orderTypeId);
  if (!orderType) {
    throw new Error("餐點種類不存在");
  }

  const quantity = Number.parseInt(item.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw new Error("組數需為 1 到 50");
  }

  const fillingIds = Array.isArray(item.fillingIds) ? item.fillingIds : [];
  if (orderType.maxFillings === 0 && fillingIds.length > 0) {
    throw new Error("原味不可選加料口味");
  }

  if (orderType.maxFillings > 0 && fillingIds.length !== orderType.maxFillings) {
    throw new Error(`${orderType.name} 需選滿 ${orderType.maxFillings} 個口味`);
  }

  const fillings = fillingIds.map((id) => {
    const filling = getFilling(menu, id);
    if (!filling) {
      throw new Error("口味不存在");
    }
    return filling;
  });

  const fillingNames = fillings.map((filling) => filling.name);
  return {
    orderTypeId: orderType.id,
    orderTypeName: orderType.name,
    fillingIds: fillings.map((filling) => filling.id),
    fillingNames,
    fillingSummary: summarizeItem(orderType, fillingNames),
    quantity,
    unitLabel: "組",
    unitPrice: orderType.basePrice,
    subtotal: orderType.basePrice * quantity
  };
}

function calculateTotal(menu, items) {
  return items.reduce((sum, item) => sum + priceForItem(menu, item), 0);
}

module.exports = {
  defaultMenu,
  calculateTotal,
  normalizeItem,
  summarizeFillings,
  summarizeItem
};
