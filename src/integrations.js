async function notifyShop(order) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.SHOP_NOTIFY_LINE_USER_ID;
  if (!token || !to || typeof fetch !== "function") {
    return { skipped: true, reason: "LINE notify env not configured" };
  }

  const text = [
    `新訂單 #${order.number}`,
    `金額 $${order.total}`,
    order.pickupTime ? `取餐 ${order.pickupDate} ${order.pickupTime}` : "",
    order.paymentMethod ? `付款 ${order.paymentMethod.name}` : "",
    ...order.items.map((item) => `${item.orderTypeName} / ${item.fillingSummary || "原味"} x${item.quantity}組`),
    order.note ? `備註：${order.note}` : ""
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }]
    })
  });

  if (!response.ok) {
    return { skipped: false, ok: false, status: response.status };
  }
  return { skipped: false, ok: true };
}

async function notifyCustomerOrderReady(order) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = order.customer && order.customer.lineUserId;
  if (!token || !to || typeof fetch !== "function") {
    return { skipped: true, reason: "LINE customer notify env not configured" };
  }

  const text = [
    "熱氣球脆皮雞蛋糕-屏東大武店通知",
    `您的訂單 #${order.number} 已完成，可以取餐囉！`,
    order.pickupDate && order.pickupTime ? `取餐時間：${order.pickupDate} ${order.pickupTime}` : "",
    "謝謝您，祝您用餐愉快。"
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }]
    })
  });

  if (!response.ok) {
    return { skipped: false, ok: false, status: response.status };
  }
  return { skipped: false, ok: true };
}

async function appendOrderToSheet() {
  return { skipped: true, reason: "Google Sheets connector not configured in this starter" };
}

module.exports = {
  appendOrderToSheet,
  notifyCustomerOrderReady,
  notifyShop
};
