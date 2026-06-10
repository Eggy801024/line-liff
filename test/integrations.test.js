const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLineUserIds } = require("../src/integrations");

test("parses multiple shop LINE user IDs", () => {
  assert.deepEqual(
    parseLineUserIds("U111,U222，U333 U222\nU444"),
    ["U111", "U222", "U333", "U444"]
  );
});

test("ignores empty shop LINE user ID values", () => {
  assert.deepEqual(parseLineUserIds(" , ， \n "), []);
});
