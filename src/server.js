const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { normalizeItem } = require("./menu");
const { createOrder, readOrders, updateOrderStatus } = require("./orderStore");
const { appendOrderToSheet, notifyCustomerOrderReady, notifyShop } = require("./integrations");
const { readSettings, writeSettings } = require("./settingsStore");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const publicDir = path.join(__dirname, "..", "public");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function publicSettings(settings) {
  const { adminPassword, ...safeSettings } = settings;
  return safeSettings;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function isPickupTimeAllowed(time) {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time >= "15:00" && time <= "18:30";
}

function isPhoneAllowed(phone) {
  return typeof phone === "string" && /^\d{10}$/.test(phone);
}

async function requireAdmin(req, res) {
  const settings = await readSettings();
  const password = req.headers["x-admin-password"];
  if (!password || password !== settings.adminPassword) {
    sendJson(res, 401, { error: "後台密碼錯誤" });
    return null;
  }
  return settings;
}

async function serveStatic(req, res, pathname) {
  const filePath = pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(publicDir))) {
    return notFound(res);
  }

  try {
    const data = await fs.readFile(resolved);
    const type = mime[path.extname(resolved).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    notFound(res);
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/menu") {
    const settings = await readSettings();
    return sendJson(res, 200, publicSettings(settings));
  }

  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, {
      liffId: process.env.LIFF_ID || "2010351146-95KCvcNH"
    });
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    const adminSettings = await requireAdmin(req, res);
    if (!adminSettings) return;
    const orders = await readOrders();
    return sendJson(res, 200, orders);
  }

  if (req.method === "GET" && pathname === "/api/admin/settings") {
    const settings = await requireAdmin(req, res);
    if (!settings) return;
    return sendJson(res, 200, publicSettings(settings));
  }

  if (req.method === "PUT" && pathname === "/api/settings") {
    try {
      const currentSettings = await requireAdmin(req, res);
      if (!currentSettings) return;
      const payload = await readBody(req);
      payload.adminPassword = payload.adminPassword || currentSettings.adminPassword;
      const settings = await writeSettings(payload);
      return sendJson(res, 200, publicSettings(settings));
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    try {
      const payload = await readBody(req);
      const settings = await readSettings();
      const pickupDate = String(payload.pickupDate || "");
      if (!pickupDate || !payload.pickupTime) {
        throw new Error("請選擇取餐日期與時間");
      }

      if (!isPickupTimeAllowed(payload.pickupTime)) {
        throw new Error("取餐時間只能選 15:00 到 18:30");
      }

      if (!isPhoneAllowed(payload.phone)) {
        throw new Error("請輸入 10 碼完整電話號碼，方便店家通知取餐");
      }

      if (settings.closedDates.includes(pickupDate)) {
        throw new Error("今天公休，先跟你說聲不好意思，請改選其他取餐日");
      }

      const paymentMethod = settings.paymentMethods.find((item) => item.id === payload.paymentMethodId && item.enabled);
      if (!paymentMethod) {
        throw new Error("請選擇付款方式");
      }

      const items = (payload.items || []).map((item) => normalizeItem(settings, item));
      if (items.length === 0) {
        throw new Error("請至少選一份餐點");
      }

      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      const order = await createOrder({
        customerName: payload.customerName,
        lineUserId: payload.lineUserId,
        phone: payload.phone,
        pickupDate,
        pickupTime: payload.pickupTime,
        paymentMethod,
        note: String(payload.note || "").slice(0, 80),
        items,
        total
      });

      await Promise.allSettled([notifyShop(order), appendOrderToSheet(order)]);
      return sendJson(res, 201, order);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const statusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    try {
      const adminSettings = await requireAdmin(req, res);
      if (!adminSettings) return;
      const payload = await readBody(req);
      const order = await updateOrderStatus(statusMatch[1], payload.status);
      if (payload.status === "done") {
        notifyCustomerOrderReady(order).catch(() => {});
      }
      return sendJson(res, 200, order);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Self ordering system running at http://localhost:${port}`);
});
