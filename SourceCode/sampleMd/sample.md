# 測驗題庫範本

本檔案示範系統支援的**所有**題庫語法，可直接複製任一題作為新題目的骨架。

## 📌 格式速查表

| 語法 | 必填 | 說明 |
|---|---|---|
| `## 第 N 題 【單選題】` | ✅ | 題型可為 `【單選題】`、`【多選題】`、`【簡答題】` |
| `## *第 N 題 【單選題】` | — | 題號前加 `*` 標記為**重要題目**（第 8 題） |
| `**English:**` | ✅ | 英文題幹 |
| `**中文：**` | — | 中文翻譯，可省略（第 9 題） |
| `**圖片：**` ＋ `![圖片](路徑)` | — | 支援多張，連續列出即可（第 6 題） |
| `**選項：**` ＋ `- A. 內容` | 選擇題 ✅ | 支援 A～F；簡答題不需要 |
| `**正確答案：AC**` | 選擇題 ✅ | 多選可寫 `AC` 或 `A,C`（第 8 題） |
| `**參考答案：**` | 簡答題 ✅ | 支援表格、列表等 Markdown（第 608 題） |
| `**題目解析：**` | — | 支援表格、程式碼區塊等 Markdown |
| 反引號包裹文字 | — | 以紅色粗體高亮關鍵字（第 7 題） |
| `---` | ✅ | 題目分隔線，**必須獨立成行** |

> ⚠️ **分隔線規則**：`---` 必須獨立成行才會被視為題目分隔。表格中的 `|---|---|` 不受影響。
>
> ℹ️ **冒號可有可無**：`**題目解析：**` 與 `**題目解析**` 兩種寫法皆可（`**圖片**`、`**參考答案**` 亦同）。

---

## 第 1 題 【單選題】

**English:**
What is the capital city of Japan?

**中文：**
日本的首都是哪裡？

**選項：**
- A. Seoul（首爾）
- B. Beijing（北京）
- C. Tokyo（東京）
- D. Bangkok（曼谷）

**正確答案：C**

**題目解析：**
🎯 **核心概念**
日本的首都是東京（Tokyo），這是一個基本的地理常識題。

📚 **其他選項為什麼不對？**
| 選項 | 城市 | 說明 |
|------|------|------|
| A. Seoul | 首爾 | 韓國首都，不是日本 |
| B. Beijing | 北京 | 中國首都，不是日本 |
| C. Tokyo | 東京 | ✔ 正確答案，日本首都 |
| D. Bangkok | 曼谷 | 泰國首都，不是日本 |

💡 **小提示**
東京都是日本的政治、經濟和文化中心，人口超過1300萬，是全球最大的都市圈之一。

---

## 第 2 題 【單選題】

**English:**
Which programming language is primarily used for web front-end development?

**中文：**
哪種程式語言主要用於網頁前端開發？

**選項：**
- A. Python
- B. JavaScript
- C. Java
- D. C++

**正確答案：B**

---

## 第 3 題 【多選題】

**English:**
Which of the following are primary colors? (Choose two.)

**中文：**
以下哪些是原色？（選擇兩項）

**選項：**
- A. Red（紅色）
- B. Green（綠色）
- C. Blue（藍色）
- D. Yellow（黃色）
- E. Purple（紫色）

**正確答案：AC**

---

## 第 4 題 【單選題】

**English:**
A security analyst is reviewing the network diagram shown below. Which device is acting as the firewall?

**中文：**
一位資安分析師正在審查下圖所示的網路拓撲圖。哪個設備是防火牆？

**圖片：**
![圖片](../images/q240.png)

**選項：**
- A. Device A（設備 A）
- B. Device B（設備 B）
- C. Device C（設備 C）
- D. Device D（設備 D）

**正確答案：B**

**題目解析：**
🔥 **Threat Hunting（威脅獵捕）**
這題的關鍵是「主動偵測尚未觸發告警的威脅」。

📚 **其他選項為什麼不對？**
| 選項 | 定義 | 為什麼不符合題意？ |
|------|------|---------------------|
| A. Digital forensics | 事件後取證、分析證據、法律用途 | 偏向事後調查，不是主動找威脅 |
| B. Device B | 防火牆設備 | ✔ 圖示中 B 設備為防火牆 |
| C. Incident response | 事件發生後的緊急處理與回應 | 是已確認事件後才做 |
| D. E-discovery | 找取法律案件相關的電子文件資料 | 用於訴訟流程，與攻擊偵測無關 |

🎯 **總結**
在網路拓撲圖中，防火牆通常位於內部網路與外部網路之間，負責過濾進出的網路流量。

---

## 第 5 題 【多選題】

**English:**
Refer to the exhibit below. Which vulnerabilities are identified in the scan results? (Choose two.)

**中文：**
請參考下圖。掃描結果中識別出了哪些漏洞？（選擇兩項）

**圖片：**
![圖片](../images/q241.png)

**選項：**
- A. SQL Injection（SQL 注入）
- B. Cross-Site Scripting（跨站腳本攻擊）
- C. Buffer Overflow（緩衝區溢位）
- D. Privilege Escalation（權限提升）
- E. Directory Traversal（目錄遍歷）

**正確答案：AB**

---

## 第 6 題 【單選題】

**English:**
Review the two exhibits below. Based on the network diagram and log output, which device is under attack?

**中文：**
請參考下列兩張圖。根據網路架構圖和日誌輸出，哪個設備正在受到攻擊？

**圖片：**
![圖片](../images/q240.png)
![圖片](../images/q241.png)

**選項：**
- A. Server A（伺服器 A）
- B. Server B（伺服器 B）
- C. Router（路由器）
- D. Firewall（防火牆）

**正確答案：A**

**題目解析：**
🎯 **核心概念**
此題展示多張圖片的功能。當題目需要參考多個圖表、截圖或示意圖時，可以連續使用多個 `![圖片](路徑)` 標籤。

📚 **多圖片語法範例**
```markdown
**圖片：**
![圖片](../images/diagram1.png)
![圖片](../images/diagram2.png)
![圖片](../images/diagram3.png)
```

💡 **小提示**
- 每張圖片都必須使用 `![圖片]` 作為 alt 文字
- 圖片會在 Dialog 中垂直排列顯示
- 按鈕會顯示圖片數量，如「查看圖片 (3)」

---

## 第 7 題 【單選題】

**English:**
Which of the following can be used to `identify` potential `attacker` activities without affecting `production servers`?

**中文：**
下列哪一項可以用來`識別`潛在的`攻擊者`活動，而不會影響`生產伺服器`？

**選項：**
- A. `Honeypot`（蜜罐）
- B. `Firewall`（防火牆）
- C. Antivirus（防毒軟體）
- D. Load Balancer（負載平衡器）

**正確答案：A**

**題目解析：**
🎯 **關鍵字高亮功能說明**

此題展示了系統的**關鍵字高亮**功能。在 Markdown 題庫中，您可以使用反引號（\`）包裹重要的關鍵字，系統會自動以紅色粗體顯示這些關鍵字。

📚 **使用方法**
```markdown
**English:**
Which can be used to `identify` potential `attacker` activities?

**選項：**
- A. `Honeypot`（蜜罐）
```

💡 **功能特點**
- ✅ 支援題目文字中的關鍵字標記
- ✅ 支援選項文字中的關鍵字標記
- ✅ 支援中英文題目
- ✅ 可在同一題目中標記多個關鍵字
- ✅ 自動以紅色粗體呈現，增強視覺效果

🎨 **視覺效果**
被反引號包裹的文字會以 <span style="color: #f87171; font-weight: 600;">紅色粗體</span> 顯示，幫助您快速識別題目中的關鍵概念。

---

## *第 8 題 【多選題】

**English:**
Which of the following are `symmetric` encryption algorithms? (Choose two.)

**中文：**
以下哪些是`對稱式`加密演算法？（選擇兩項）

**選項：**
- A. AES
- B. RSA
- C. 3DES
- D. ECC

**正確答案：A,C**

**題目解析：**
🎯 **本題示範兩項語法**

1. **重要題目標記**：題號前加上 `*`，寫成 `## *第 8 題 【多選題】`。系統會在題目標題旁顯示「重要」標籤，並可在設定中開啟「僅顯示重要題目」只複習這些題目。
2. **逗號分隔答案**：多選題答案可寫成 `A,C`，與連續格式 `AC` 完全等價，系統會自動正規化。

📚 **兩種答案寫法對照**

| 寫法 | 範例 | 解析結果 |
|------|------|----------|
| 連續格式 | `**正確答案：AC**` | AC |
| 逗號分隔 | `**正確答案：A,C**` | AC |

💡 **小提示**
重要題目適合標記易錯題或考前重點，搭配「僅顯示重要題目」可做最後衝刺複習。

---

## 第 9 題 【單選題】

**English:**
Which port does HTTPS use by default?

**選項：**
- A. 21
- B. 80
- C. 443
- D. 3389

**正確答案：C**

**題目解析：**
🎯 **中文翻譯為選填欄位**

此題刻意省略了中文翻譯區塊，示範純英文題目一樣能正常解析 —— 英文題幹會直接銜接到選項區塊之前。

📚 **本題的完整寫法**

```markdown
## 第 9 題 【單選題】

**English:**
Which port does HTTPS use by default?

**選項：**
- A. 21
- B. 80
- C. 443
- D. 3389

**正確答案：C**
```

💡 **注意事項**
- 省略中文翻譯後，按下「顯示中文翻譯」時不會有內容可切換，建議僅用於不需翻譯的題目
- 撰寫解析時若要提及欄位標籤（例如中文或選項的標記寫法），請一律放進程式碼區塊。行內反引號不會被解析器忽略，直接寫在內文會被誤判為真正的欄位

---

## 第 608 題 【簡答題】

**English:**
HOTSPOT - You are a security administrator investigating a potential infection on a network. INSTRUCTIONS - Click on each host and firewall. Review all logs to determine which host originated the infection and then identify if each remaining host is clean or infected. If at any time you would like to bring back the initial state of the simulation, please click the Reset All button.

**中文：**
熱點 - 您是一名安全管理員，正在調查網路上的潛在感染。說明 - 點選每個主機和防火牆。檢視所有日誌以確定哪個主機是感染的源頭，然後識別其餘每個主機是乾淨還是感染。如果您希望隨時恢復模擬的初始狀態，請點選 "Reset All" 按鈕。

**圖片**
![圖片](../images/q608.png)

**參考答案**
| Host | Status |
|---|---|
| 192.168.10.22 | Infected |
| 192.168.10.37 | Infected |
| 192.168.10.41 | Origin |
| 10.10.9.12 | Infected |
| 10.10.9.18 | Infected |

**題目解析**
🎯 **簡答題功能說明**

此題展示了系統新增的**簡答題**功能。簡答題不需要選擇選項，而是讓使用者先自行思考後再查看參考答案。

📚 **Markdown 格式**
```markdown
## 第 608 題 【簡答題】

**English:**
題目英文內容...

**中文：**
題目中文內容...

**圖片**
![圖片](路徑)

**參考答案**
答案內容（支援表格、列表等 Markdown 格式）
```

💡 **功能特點**
- ✅ 支援表格格式的參考答案
- ✅ 支援圖片附件
- ✅ 答案預設隱藏，需點擊「查看參考答案」按鈕
- ✅ 簡答題在答題卡上以特殊綠色邊框標識
- ✅ 簡答題不計入答題統計

---

