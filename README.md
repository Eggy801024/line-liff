# LINE 自助點餐系統

這是一套可先本機測試的 LIFF 自助點餐雛形。

## 流程

1. 客人掃 QR Code 或點 LINE 連結。
2. 進入 `/` 點餐頁。
3. 選餐點、數量、備註。
4. 選取餐時間。
5. 送出訂單。
6. 店家手機或平板開 `/admin.html` 收單。
7. 後台可接單、出單、完成訂單。
8. 後台可調整品項、價格、公休日。

## 本機啟動

```powershell
node src/server.js
```

開啟：

- 客人點餐頁：`http://localhost:3000/`
- 店家後台：`http://localhost:3000/admin.html`

## LINE LIFF 設定

1. 到 LINE Developers 建立 LIFF App。
2. Endpoint URL 填部署後的首頁網址，例如 `https://你的服務.onrender.com/`。
3. 把 LIFF ID 放進 Render 的 `LIFF_ID`。
4. QR Code 可以直接指向 LIFF URL，或指向 `https://liff.line.me/你的LIFF_ID`。

## Render 設定

環境變數照 `.env.example` 填。

- `PUBLIC_BASE_URL`：部署後網址。
- `LIFF_ID`：LINE LIFF ID，目前測試用 `2010351146-95KCvcNH`。
- `LINE_CHANNEL_ACCESS_TOKEN`：Messaging API 長期 token。
- `SHOP_NOTIFY_LINE_USER_ID`：要收到新訂單通知的店家 LINE userId；多人可用逗號分隔，例如 `Uxxxx,Uyyyy,Uzzzz`。

目前訂單會存在 `data/orders.json`。正式營業建議下一步接 Google Sheets 或資料庫，避免 Render 重新部署後資料遺失。

## Google Sheets 欄位規劃

正式串接時建議每日一個分頁，欄位固定為：

`名字、電話、品項、價錢、取餐時間`

每週再自動整理成歷史檔案，方便統計每週訂單金額。
