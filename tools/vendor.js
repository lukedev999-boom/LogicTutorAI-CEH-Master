/** 將鎖定版本的清理器與授權複製為本機資源，執行期無 CDN。 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const [source, target] of [
    ['dist/purify.min.js', 'purify.min.js'],
    ['LICENSE', 'DOMPurify-LICENSE'],
]) {
    fs.copyFileSync(
        path.join(root, 'node_modules/dompurify', source),
        path.join(root, 'assets/vendor', target),
    );
}
