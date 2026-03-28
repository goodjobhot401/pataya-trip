# 🌴 2026 芭達雅泰國行住宿投票系統

這是一個專為 8 位好兄弟設計的泰國芭達雅旅遊住宿投票系統。

## 📋 如何開始？

### 1. 建立 Supabase 資料庫 (最重要！)
為了存投票數據，你需要：
1.  去 [Supabase 官網](https://supabase.com/) 註冊並建立一個新專案。
2.  在專案選單中找到 **SQL Editor**。
3.  開啟專案根目錄下的 `supabase_setup.sql` 檔案，複製全部內容貼上並執行 (Run)。
4.  **獲取 API Key**：去 Project Settings > API 找到 `Project URL` 與 `anon public` 的 Key。
5.  **填入程式碼**：打開 `main.js` 檔案第 3、4 行，貼上你的 URL 與 KEY。

### 2. 本地預覽 (開發者模式)
1.  安裝依賴：`npm install`
2.  啟動網頁：`npm run dev`
3.  打開瀏覽器看到的會是「錯誤訊息」，因為你必須帶入專屬連結 (見下方)。

### 3. 專屬投票連結組合方式
請根據你在 `supabase_setup.sql` 裡面設定的成員姓名與專屬 Key 進行拼接。

公式如下：
`https://goodjobhot401.github.io/pataya-trip/?u=[姓名]&k=[密鑰]`

例如：`.../?u=Evan&k=E821`
或是你在本地開發時用：`localhost:5173/?u=Evan&k=E821`

---

## 🚀 如何部署到 GitHub Pages？

1.  **打包專案**：在終端機輸入 `npm run build`。這會產生一個 `dist` 資料夾。
2.  **上傳到 GitHub**：
    *   在 GitHub 建立一個新的 Repository。
    *   將所有內容 (包含 `dist`) 推送上去。 (註：通常只需要推原始碼，透過 GitHub Action 自動部署會更專業，但手動部署最快)。
3.  **開啟 Pages 託管**：
    *   在你的 Repository 設定 (Settings) -> **Pages**。
    *   如果你是手動推送打包後的內容，請選擇部署 `gh-pages` 分支。
    *   設定完成後，你會得到一個網址 (例如 `https://yourname.github.io/pataya-trip/`)。
    *   **重點**：如果是部署在子路徑，記得在 `vite.config.js` 裡的 `base` 改成你的路徑名稱 (例如 `/pataya-trip/`) 並重新執行 `npm run build`。

## 🛠️ 功能與設計
*   一人兩票限制，已投過的選項可取消投下一票。
*   質感海島度假風介面，支援手機與行動裝置投票。
*   Airbnb 與度假村區塊化清單，點選查看詳情。
*   即時統計顯示，全透明投票進度。