const fs = require("node:fs/promises");
const path = require("node:path");
const { defaultMenu } = require("./menu");

const dataDir = path.join(__dirname, "..", "data");
const settingsFile = path.join(dataDir, "settings.json");

async function ensureSettings() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(settingsFile);
  } catch {
    await fs.writeFile(settingsFile, `${JSON.stringify(defaultMenu, null, 2)}\n`, "utf8");
  }
}

async function readSettings() {
  await ensureSettings();
  const raw = await fs.readFile(settingsFile, "utf8");
  const saved = JSON.parse(raw || "{}");
  return {
    ...defaultMenu,
    ...saved,
    adminPassword: saved.adminPassword || defaultMenu.adminPassword || "88888888",
    paymentMethods: saved.paymentMethods || defaultMenu.paymentMethods,
    orderTypes: saved.orderTypes || defaultMenu.orderTypes,
    fillings: saved.fillings || defaultMenu.fillings,
    closedDates: saved.closedDates || []
  };
}

function normalizeSettings(payload) {
  const orderTypes = (payload.orderTypes || []).map((item) => ({
    ...item,
    basePrice: Number.parseInt(item.basePrice, 10) || 0,
    pieces: Number.parseInt(item.pieces, 10) || 0,
    maxFillings: Number.parseInt(item.maxFillings, 10) || 0
  }));

  const fillings = (payload.fillings || []).map((item) => ({
    ...item,
    price: Number.parseInt(item.price || 0, 10) || 0
  }));

  return {
    shopName: payload.shopName || defaultMenu.shopName,
    orderTypes,
    fillings,
    paymentMethods: payload.paymentMethods || defaultMenu.paymentMethods,
    closedDates: normalizeClosedDates(payload.closedDates || []),
    adminPassword: payload.adminPassword || defaultMenu.adminPassword || "88888888"
  };
}

function normalizeClosedDateToken(token) {
  const text = String(token).trim();
  if (!text) return "";

  const fullDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const shortDate = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  const year = new Date().getFullYear();

  const parsed = fullDate
    ? { year: Number(fullDate[1]), month: Number(fullDate[2]), day: Number(fullDate[3]) }
    : shortDate
      ? { year, month: Number(shortDate[1]), day: Number(shortDate[2]) }
      : null;

  if (!parsed) {
    throw new Error(`公休日格式錯誤：${text}`);
  }

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  if (
    date.getFullYear() !== parsed.year ||
    date.getMonth() !== parsed.month - 1 ||
    date.getDate() !== parsed.day
  ) {
    throw new Error(`公休日日期不存在：${text}`);
  }

  return [
    parsed.year,
    String(parsed.month).padStart(2, "0"),
    String(parsed.day).padStart(2, "0")
  ].join("-");
}

function normalizeClosedDates(closedDates) {
  return [...new Set(
    closedDates
      .map(normalizeClosedDateToken)
      .filter(Boolean)
  )];
}

async function writeSettings(payload) {
  const settings = normalizeSettings(payload);
  await ensureSettings();
  await fs.writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

module.exports = {
  readSettings,
  writeSettings
};
