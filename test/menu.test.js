const test = require("node:test");
const assert = require("node:assert/strict");
const { defaultMenu, normalizeItem } = require("../src/menu");

test("normalizes a plain order item as one set", () => {
  const item = normalizeItem(defaultMenu, {
    orderTypeId: "plain",
    quantity: 2,
    fillingIds: []
  });

  assert.equal(item.orderTypeName, "原味");
  assert.equal(item.fillingSummary, "原味x6");
  assert.equal(item.subtotal, 120);
});

test("filled six requires six flavor picks and keeps one set price", () => {
  const item = normalizeItem(defaultMenu, {
    orderTypeId: "filled6",
    quantity: 1,
    fillingIds: ["milk", "milk", "cheese", "boba", "oreo", "taro"]
  });

  assert.equal(item.fillingSummary, "牛奶奶凍x2、香濃起司x1、黑糖珍珠x1、OREO 巧克力x1、鮮奶蜜芋頭x1");
  assert.equal(item.subtotal, 85);
});

test("mixed shows three plain plus three selected filling flavors", () => {
  const item = normalizeItem(defaultMenu, {
    orderTypeId: "mixed",
    quantity: 1,
    fillingIds: ["milk", "cheese", "cheese"]
  });

  assert.equal(item.fillingSummary, "原味x3 + 牛奶奶凍x1、香濃起司x2");
  assert.equal(item.subtotal, 75);
});

test("rejects filled order when flavor picks are not full", () => {
  assert.throws(() => normalizeItem(defaultMenu, {
    orderTypeId: "filled6",
    quantity: 1,
    fillingIds: ["milk"]
  }), /需選滿 6 個口味/);
});

test("rejects invalid quantity", () => {
  assert.throws(() => normalizeItem(defaultMenu, {
    orderTypeId: "plain",
    quantity: 0,
    fillingIds: []
  }), /組數/);
});
