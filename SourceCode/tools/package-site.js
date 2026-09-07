/** 只打包執行期資源；不發布 node_modules、工具或私人 Template。 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const output = path.join(root, 'dist');
// dist 為本工具專用產物目錄，重建前清除，避免舊題庫或圖片殘留。
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'database.md', 'sampleMd', 'images', 'assets']) {
    fs.cpSync(path.join(root, name), path.join(output, name), {
        recursive: true,
        filter: (source) =>
            !['.DS_Store', '.gitignore', 'tailwind-src.css'].includes(path.basename(source)),
    });
}
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(root, '..', name), path.join(output, name));
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('已打包 dist/，可部署到網站根目錄或子目錄。');
