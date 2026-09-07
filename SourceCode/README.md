# 測驗作答系統

一個基於 Markdown 題庫的現代化測驗練習工具，專為 CompTIA SY0-701 認證考試設計，支援單選題、多選題、圖片題目，並整合 AI 解析功能。

## 📋 目錄

- [功能特色](#功能特色)
- [快速開始](#快速開始)
- [題庫格式](#題庫格式)
- [使用說明](#使用說明)
- [AI 解析功能](#ai-解析功能)
- [專案結構](#專案結構)
- [技術架構](#技術架構)
- [瀏覽器支援](#瀏覽器支援)

## ✨ 功能特色

### 核心功能
- 📝 **Markdown 題庫支援**：使用標準 Markdown 格式，易於編輯與維護
- 🎯 **單選題與多選題**：完整支援兩種題型
- 🖼️ **圖片題目**：支援題目內嵌圖片顯示
- 🔴 **關鍵字高亮**：使用反引號標記關鍵字，自動紅色顯示
- 🌐 **中英文切換**：一鍵切換題目語言顯示
- 📖 **英文單字即點即譯**：英文題幹的單字帶虛線底線，點擊即顯示繁體中文釋義，完全離線
- 📊 **答題卡導航**：視覺化答題狀態，快速跳轉題目
- 📈 **答題統計**：即時顯示答題進度與正確率
- 💾 **進度儲存**：自動儲存答題進度至瀏覽器本地儲存

### AI 增強功能
- 🤖 **AI 解析**：整合 GROQ API，提供詳細題目解析
- ⚙️ **自訂提示詞**：可自訂 AI 解析的提示詞模板
- 🎨 **多模型支援**：支援多種 GROQ 模型選擇

### 使用者體驗
- 🎨 **現代化 UI**：採用 Tailwind CSS，響應式設計
- ⚡ **流暢動畫**：平滑的過場動畫與互動效果
- 🔍 **快速跳題**：支援輸入題號快速跳轉
- 📱 **響應式設計**：完美適配桌面與行動裝置

## 🚀 快速開始

### 方法一：直接開啟 HTML 檔案

1. 下載或複製 `index.html` 檔案
2. 準備題庫檔案（Markdown 格式）
3. 將題庫檔案命名為 `database.md` 並放在與 `index.html` 相同目錄
4. 使用瀏覽器開啟 `index.html`

### 方法二：使用檔案選擇器

1. 開啟 `index.html`
2. 點擊「載入題庫」按鈕
3. 選擇您的 Markdown 題庫檔案

> 💡 以 `file://` 開啟時，瀏覽器的同源政策會阻擋自動讀取 `database.md`，
> 系統會直接提示改用「載入題庫」按鈕選檔，功能不受影響。

### 方法三：使用本地伺服器（推薦）

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js http-server
npx http-server -p 8000
```

然後在瀏覽器中開啟 `http://localhost:8000`

## 📖 題庫格式

題庫檔案需遵循以下 Markdown 格式：

### 單選題格式

```markdown
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

---
```

### 多選題格式

```markdown
## 第 2 題 【多選題】

**English:**
Which of the following are primary colors? (Choose two.)

**中文：**
以下哪些是原色？（選擇兩項）

**選項：**
- A. Red（紅色）
- B. Green（綠色）
- C. Blue（藍色）
- D. Yellow（黃色）

**正確答案：AC**

---
```

### 含圖片題目格式

```markdown
## 第 3 題 【單選題】

**English:**
A security analyst is reviewing the network diagram shown below.

**中文：**
一位資安分析師正在審查下圖所示的網路拓撲圖。

**圖片：**
![網路拓撲圖](../images/q240.png)

**選項：**
- A. Device A（設備 A）
- B. Device B（設備 B）
- C. Device C（設備 C）
- D. Device D（設備 D）

**正確答案：B**

---
```

### 簡答題格式

簡答題不提供選項，改為讓使用者自行思考後點擊「查看參考答案」。此題型不計入答題統計。

```markdown
## 第 4 題 【簡答題】

**English:**
HOTSPOT - Review all logs to determine which host originated the infection.

**中文：**
熱點 - 檢視所有日誌以確定哪個主機是感染的源頭。

**圖片：**
![圖片](../images/q608.png)

**參考答案：**
| Host | Status |
|---|---|
| 192.168.10.41 | Origin |
| 192.168.10.22 | Infected |

---
```

### 重要題目標記

題號前加上 `*`，該題會顯示「重要」標籤，並可透過設定中的「僅顯示重要題目」單獨複習。

```markdown
## *第 5 題 【多選題】

**English:**
Which of the following are symmetric encryption algorithms? (Choose two.)

**中文：**
以下哪些是對稱式加密演算法？（選擇兩項）

**選項：**
- A. AES
- B. RSA
- C. 3DES
- D. ECC

**正確答案：A,C**

---
```

### 題目解析（選填）

在 `**正確答案：X**` 之後可加上題目解析，支援表格、清單、程式碼區塊等完整 Markdown 語法。

```markdown
**正確答案：C**

**題目解析：**
🎯 **核心概念**
東京是日本的首都。

| 選項 | 城市 | 說明 |
|------|------|------|
| A | 首爾 | 韓國首都 |
| C | 東京 | ✔ 正確答案 |
```

### 格式說明

- **題目編號**：使用 `## 第 X 題 【題型】` 格式；題號前加 `*` 即標記為重要題目
- **題型標記**：`【單選題】`、`【多選題】` 或 `【簡答題】`
- **English**：英文題目內容（必填）
- **中文**：中文翻譯（選填，省略後該題無法切換中文顯示）
- **圖片**：使用標準 Markdown 圖片語法（選填），支援多張連續列出
- **選項**：使用 `- A. 選項內容` 格式，支援 A～F；簡答題不需要選項
- **正確答案**：單選題為單一字母（如 `C`）；多選題可用連續格式 `AC` 或逗號分隔 `A,C`
- **參考答案**：簡答題專用（簡答題必填），支援表格與清單
- **題目解析**：選填，支援表格、程式碼區塊等完整 Markdown
- **分隔線**：題目之間使用 `---` 分隔，**必須獨立成行**

> 💡 欄位標籤的全形冒號可有可無，`**題目解析：**` 與 `**題目解析**` 皆可正常解析。
>
> ⚠️ 分隔線 `---` 必須獨立成行；表格中的 `|---|---|` 不會被誤判為分隔線。
>
> ⚠️ 撰寫題目解析時若需提及欄位標籤，請放進程式碼區塊 —— 行內反引號不會被忽略，直接寫在內文會被誤判為真正的欄位。
>
> 📖 完整語法範例請參考 `sampleMd/sample.md`，該檔案示範了全部支援的格式。

### 關鍵字高亮功能

系統支援使用反引號（\`）標記重要關鍵字，被標記的文字會以**紅色粗體**顯示，幫助您快速識別題目重點。


#### 功能特點

- ✅ 支援題目文字中標記關鍵字
- ✅ 支援選項文字中標記關鍵字
- ✅ 支援中英文題目
- ✅ 可在同一題目中標記多個關鍵字
- ✅ 自動以紅色粗體呈現

#### 實際效果

被反引號包裹的文字如 \`identify\`、\`attacker\` 會在系統中顯示為紅色粗體，讓您更容易聚焦於題目的核心概念。

> 💡 提示：可參考 `sampleMd/sample.md` 第 7 題查看關鍵字高亮範例

## 📚 使用說明

### 基本操作

1. **載入題庫**
   - 點擊頂部「載入題庫」按鈕選擇 Markdown 檔案
   - 或將題庫檔案命名為 `database.md` 放在同目錄下自動載入

2. **答題**
   - **單選題**：直接點擊選項即可作答
   - **多選題**：勾選多個選項後點擊「提交答案」

3. **導航**
   - 使用「上一題」/「下一題」按鈕
   - 在答題卡中點擊題號快速跳轉
   - 使用「跳至第 X 題」輸入框快速跳轉

4. **查看結果**
   - 答題後立即顯示正確/錯誤提示
   - 答題卡以顏色標示答題狀態：
     - 🔵 藍色：已答對
     - 🔴 紅色：已答錯
     - 🟡 黃色：當前題目
     - ⚪ 灰色：未作答

### 進階功能

#### 中英文切換
- 點擊題目卡片右上角的「顯示中文翻譯」按鈕
- 可在英文與中文之間切換顯示

#### 英文單字即點即譯
- 顯示英文題目時，查得到釋義的單字會帶有**虛線底線**
- **點擊單字**即在下方彈出繁體中文釋義卡；再點一次、點卡片以外的地方或按 `Esc` 可關閉
- 資安術語會標上「資安術語」標籤，採用貼合 CEH 語境的解釋，而非一般字典的字面義
  - 例：`payload` 顯示「攻擊酬載」而非「商務載重」，`shell` 顯示「命令列存取權」而非「貝殼」
- 詞形變化會自動還原（`attackers` → `attacker`、`hardened` → `harden`）並標示原形
- 切換為中文顯示時自動停用
- **完全離線**：釋義來自本地詞典檔，不會發出任何網路請求

#### 查看圖片
- 若題目包含圖片，會顯示「查看圖片」按鈕
- 點擊後以彈窗形式顯示完整圖片

#### AI 解析
1. 點擊「AI 解析」按鈕
2. 首次使用需在設定中配置 GROQ API Key
3. 系統會自動分析題目並提供詳細解析

## 🤖 AI 解析功能

### 設定步驟

1. 點擊頂部工具列的「設定」按鈕（齒輪圖示）
2. 輸入您的 GROQ API Key
3. 選擇 AI 模型（預設：`openai/gpt-oss-20b`）
4. （選填）自訂提示詞模板
5. 點擊「儲存設定」

### 取得 GROQ API Key

1. 前往 [GROQ Console](https://console.groq.com/)
2. 註冊或登入帳號
3. 在 API Keys 頁面建立新的 API Key
4. 複製 API Key 並貼到設定中

### 支援的模型

- `openai/gpt-oss-20b`
- `llama-3.1-70b-versatile`
- `mixtral-8x7b-32768`
- 以及其他 GROQ 提供的模型

### 自訂提示詞

系統提供預設的 AI 解析提示詞，您也可以根據需求自訂：

- 點擊「使用自訂提示詞」開關
- 在文字框中輸入您的提示詞模板
- 提示詞中可使用變數（系統會自動替換題目內容）

## 📁 專案結構

```
CTIA/
├── index.html              # 主應用程式檔案
├── README.md              # 專案說明文件
├── CompTIA_SY0-701.md    # CompTIA SY0-701 題庫範例
├── sampleMd/              # 範例題庫目錄
│   └── sample.md         # 題庫格式範本
├── images/                # 題目圖片資源
│   ├── q240.png
│   ├── q241.png
│   └── ...
└── docx/                  # PDF 文件資源
    ├── CompTIA_SY0-701_精簡版-1.pdf
    └── ...
```

## 🔨 建置方式

本專案的產出為純靜態檔案，建置僅在「修改原始碼」時才需要執行。

```bash
# 安裝建置期依賴（僅需一次）
npm install

# 完整建置：編譯 Tailwind CSS + 拼接 HTML partials
npm run build

# 或分開執行
npm run build:css    # 產生 assets/vendor/tailwind.css
npm run build:html   # 由 partials/ 產生 index.html
```

### 重建英漢詞典（極少需要）

`assets/data/dict.js` 與 `lemma.js` 已隨專案附上，一般情況不必重建。
只有在想調整收錄範圍或釋義長度時才需要執行：

```bash
npm run build:dict
```

首次執行會自動從 GitHub 下載 ECDICT 原始資料（約 68 MB）至 `.cache/`，
之後改用快取。此步驟**不包含在 `npm run build`** 中，因為它需要網路且耗時較久。

> 💡 想調整或補充資安術語翻譯，直接編輯 `assets/data/glossary.js` 即可，
> 該檔案為手動維護，修改後重新整理頁面就生效，不需要執行任何建置指令。

| 檔案 | 用途 |
|---|---|
| `index-template.html` | HTML 外框（head、資源引用） |
| `partials/*.html` | 各區塊原始碼，**請修改這裡而非 index.html** |
| `index.html` | 建置產物，會被覆寫 |
| `tailwind.config.js` | Tailwind 設定與 safelist |
| `tools/build-dict.js` | 由 ECDICT 產生離線英漢詞典 |
| `assets/data/dict.js` | 建置產物，會被覆寫 |
| `assets/data/glossary.js` | 資安術語表，**手動維護**，不會被建置覆寫 |

> ⚠️ `index.html` 為自動產生，直接編輯會在下次建置時遺失。

## 🛠️ 技術架構

### 前端技術

- **HTML5**：結構標記
- **Tailwind CSS**：樣式框架（**預先編譯為靜態 CSS，執行期無 CDN 依賴**）
- **Vanilla JavaScript**：核心邏輯（無框架依賴）
- **LocalStorage API**：本地資料儲存（以題庫為單位隔離進度）

### 純靜態運行

執行期**不依賴任何外部網路資源**，可完全離線使用，亦可直接以 `file://` 開啟：

| 資源 | 位置 | 說明 |
|---|---|---|
| Tailwind CSS | `assets/vendor/tailwind.css` | 由 `npm run build:css` 預先編譯（約 32 KB） |
| marked.js | `assets/vendor/marked.min.js` | Markdown 渲染 |
| 等寬字型 | `assets/fonts/jetbrains-mono-latin.woff2` | 僅內嵌 latin 子集（約 31 KB） |
| 英漢詞典 | `assets/data/dict.js` | 37,887 詞，由 ECDICT 建置並轉為台灣繁體（約 2.2 MB） |
| 資安術語表 | `assets/data/glossary.js` | 407 條 CEH 術語，手動維護（約 29 KB） |
| 詞形還原表 | `assets/data/lemma.js` | 613 條不規則變形（約 15 KB） |
| 中文字型 | 系統內建 | PingFang TC／微軟正黑體／Noto Sans CJK |

> ⚠️ 修改 HTML 或 JS 中的 Tailwind 類別後，需重新執行 `npm run build:css`。
> JS 動態附加的類別無法被靜態掃描，已列於 `tailwind.config.js` 的 `safelist`，新增時請一併補上。

### 選用的外部服務

- **GROQ API**：AI 解析服務（**選用**，僅在使用者自行設定 API Key 後才會連線）

### 核心功能模組

- **題庫解析器**：解析 Markdown 格式題庫
- **題目渲染器**：動態渲染題目與選項
- **答題管理器**：管理答題狀態與進度
- **AI 整合模組**：處理 GROQ API 請求與回應
- **即點即譯模組**：`wordlookup.js` 負責單字標記、離線查詢與釋義卡

## 🌐 瀏覽器支援

- ✅ Chrome/Edge（推薦）
- ✅ Firefox
- ✅ Safari
- ✅ Opera

> ⚠️ 注意：需支援 ES6+ 語法與 LocalStorage API

## 📝 授權

本專案為開源專案，可自由使用與修改。

內建英漢詞典資料取自 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License），簡繁轉換使用 [opencc-js](https://github.com/nk2028/opencc-js)。

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request 來改善此專案！

## 📧 聯絡方式

如有問題或建議，請透過 GitHub Issues 提出。

---

**祝您考試順利！** 🎓

