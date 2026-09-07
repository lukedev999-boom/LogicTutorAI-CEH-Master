# LogicTutorAI

以 Markdown 題庫驅動的輕量練習系統。純 HTML、CSS、JavaScript，無後端、無資料庫，適合 GitHub Pages。

支援單選、多選、簡答、雙語、圖片、解析、錯題複習、搜尋、計時與離線英漢查字。AI 解析為選用功能。

## 開始使用

```bash
git clone https://github.com/lukedev999-boom/LogicTutorAI-CEH-Master.git
cd LogicTutorAI-CEH-Master
python3 -m http.server 8000
```

開啟 http://localhost:8000，自動載入 `database.md`。點擊「載入題庫」可改讀自己的 Markdown 檔。

也能直接開啟完整下載資料夾中的 `index.html`，但 `file://` 模式需手動選題庫。網站不提供離線快取；要離線使用請下載完整靜態檔案。

## 編寫題庫

複製 [完整範例](sampleMd/sample.md)，更新題目即可。預設題庫為 [database.md](database.md)。

```markdown
## 第 1 題 【單選題】

**English:**
Which file stores the default question bank?

**中文：**
哪個檔案存放預設題庫？

**選項：**

- A. database.md
- B. index.html

**正確答案：A**

**題目解析：**
database.md 放在 index.html 同一層。
```

- 題型：`單選題`、`多選題`、`簡答題`。題號須為不重複的正整數。
- 欄位標籤放行首，接受中英文冒號；English 必填，中文可省略。
- 選項使用 A～F；多選答案接受 `AC` 或 `A,C`，順序不影響判分。
- 簡答題改用 `**參考答案：**`，不需選項、不計入正確率。
- `## *第 2 題 【多選題】` 標記重要題；反引號標記關鍵字。
- 圖片放 `images/`，在 `**圖片：**` 欄位填入 `![說明](images/example.svg)`。部署自己的圖片時需加入 Git。
- 解析與參考答案支援 Markdown 表格、清單及程式碼；HTML 會經安全清理。
- 題目用二級題號標題切分；`---` 可作分隔。示範欄位或題號請包在程式碼區塊。

## GitHub Pages

1. 將本次程式碼與 `.github/workflows/pages.yml` 推送至倉庫預設分支。
2. 在 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 開啟 **Actions → Build and deploy Pages**，確認成功；必要時按 **Run workflow**。

流程會安裝鎖定依賴、檢查格式、測試、建置，再發布 `dist/`。其他分支與 PR 只建置驗證。
預期網址：https://lukedev999-boom.github.io/LogicTutorAI-CEH-Master/ （需部署成功才可使用）

Fork 後網址改為自己的帳號與倉庫名稱。所有資源採相對路徑，支援專案子目錄。
設定依據：[GitHub Pages 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 開發

需要 Node.js 22 以上。

```bash
npm ci
npm run format
npm run check
npm run build
```

- 修改 `index-template.html`、`partials/`；`index.html` 為建置產物。
- `assets/js/question-bank.js`：解析、驗證與題庫識別。
- `assets/js/storage.js`：瀏覽器儲存與暫存備援。
- `assets/js/main.js`：作答、介面、計時與選用 AI。
- `assets/js/wordlookup.js`：離線查字；詞典已隨附，一般不需重建。
- 修改 Tailwind 類別後需重建；動態類別列在 `tailwind.config.js`。
- `npm run build:dict` 會下載 ECDICT 原始資料，只在調整詞典時使用。

發布檔案取自 `dist/`，不包含 node_modules、Template 或建置工具。每次建置會清除並重建 dist，請在原始碼目錄維護資源。

`Template/` 為本機私人資料，已加入 Git 與格式化忽略清單，不納入版控或網站發布。

## 資料與授權

答題進度依題庫內容儲存在此瀏覽器；清除網站資料或更改題庫內容會重新開始。儲存被封鎖時只保留本次頁面狀態。

AI 功能由瀏覽器直接連線 Groq；啟用後會傳送題目與提示詞。使用者自行填寫的 API Key 保存在此網站的 localStorage，請只在可信任的裝置使用，勿將金鑰寫入倉庫。自訂遠端圖片也會發出網路請求。

程式與原創範例採 [MIT](LICENSE)。第三方資源見 [授權清單](THIRD_PARTY_NOTICES.md)；自備題庫請確認有公開散布權限。歡迎用 Issue 回報問題或提交 PR，附上重現步驟與驗證結果。
