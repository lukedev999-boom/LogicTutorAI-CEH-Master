# LogicTutorAI 原創範例題庫

示範單選、多選、簡答、雙語、關鍵字、重要標記與 Markdown 解析。

## 第 1 題 【單選題】

**English:**
Which file does this tool load as its default `Markdown` question bank?

**中文：**
本工具預設讀取哪個 Markdown 題庫檔案？

**選項：**

- A. database.md（預設題庫）
- B. settings.json（設定檔）
- C. index.html（網頁）
- D. package.json（套件設定）

**正確答案：A**

**題目解析：**
網頁透過相對路徑讀取同層的 `database.md`，因此也能部署在網站子目錄。

---

## *第 2 題 【多選題】

**English:**
Which features work without an AI API key? Choose two.

**中文：**
哪些功能不需要 AI API Key？請選兩項。

**選項：**

- A. Answering questions（練習作答）
- B. Generating AI explanations（產生 AI 解析）
- C. Reading built-in explanations（閱讀內建解析）
- D. Requesting AI models（向 AI 服務取得模型）

**正確答案：C,A**

**題目解析：**
A 與 C 都在瀏覽器本機完成。

| 功能           | 需要 AI 服務 |
| -------------- | ------------ |
| 作答、題庫解析 | 否           |
| AI 解析        | 是           |

---

## 第 3 題 【簡答題】

**English:**
How can you add a question bank to this static website?

**中文：**
如何替這個靜態網站加入自己的題庫？

**參考答案：**

1. 複製範例題庫，修改題幹、選項與答案。
2. 點擊「載入題庫」選擇 Markdown 檔案。
3. 要替換網站預設內容，更新 `database.md` 再部署。

**題目解析：**
簡答題使用參考答案，不計入選擇題正確率。
欄位範例可安全放進程式碼區塊：

```markdown
**正確答案：A**
---

## 第 99 題 【單選題】
```

---

## 第 4 題 【單選題】

**English:**
Which filename extension is used by the sample question bank?

**選項：**

- A. .exe
- B. .md
- C. .zip
- D. .mp3

**正確答案：B**

**題目解析：**
這題示範省略中文欄位。

---

## 第 5 題 【單選題】

**English:**
Which shape appears in the image?

**中文：**
圖片中顯示哪一種形狀？

**圖片：**
![Blue circle](images/example.svg)

**選項：**

- A. Triangle（三角形）
- B. Square（正方形）
- C. Circle（圓形）

**正確答案：C**

**題目解析：**
圖片是藍色圓形，檔案隨網站發布，可離線顯示。
