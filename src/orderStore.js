const fs = require("node:fs/promises");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "orders.json");
const allowedStatuses = new Set(["new", "accepted", "done", "cancelled"]);

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readOrders() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "") || "[]");
}

async function writeOrders(orders) {
  await ensureStore();
  await fs.writeFile(dataFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

function makeOrderNumber(index) {
  return String(index + 1).padStart(4, "0");
}

async function createOrder(payload) {
  const orders = await readOrders();
  const now = new Date();
  const order = {
    id: crypto.randomUUID(),
    number: makeOrderNumber(orders.length),
    status: "new",
    customer: {
      name: payload.customerName || "LINE 客人",
      lineUserId: payload.lineUserId || "",
      phone: payload.phone || ""
    },
    pickupDate: payload.pickupDate || "",
    pickupTime: payload.pickupTime || "",
    paymentMethod: payload.paymentMethod || null,
    note: payload.note || "",
    items: payload.items,
    total: payload.total,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  orders.unshift(order);
  await writeOrders(orders);
  return order;
}

async function updateOrderStatus(id, status) {
  if (!allowedStatuses.has(status)) {
    throw new Error("訂單狀態不存在");
  }

  const orders = await readOrders();
  const order = orders.find((item) => item.id === id);
  if (!order) {
    throw new Error("找不到訂單");
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  await writeOrders(orders);
  return order;
}

async function clearOrderHistory() {
  await ensureStore();
  const files = await fs.readdir(dataDir);
  const backupFiles = files.filter((file) => /^orders-.*\.json$/i.test(file));
  await writeOrders([]);
  await Promise.all(
    backupFiles.map((file) => fs.rm(path.join(dataDir, file), { force: true }))
  );
  return { cleared: true, deletedBackups: backupFiles.length };
}

module.exports = {
  clearOrderHistory,
  createOrder,
  readOrders,
  updateOrderStatus
};
