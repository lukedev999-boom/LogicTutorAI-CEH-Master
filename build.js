#!/usr/bin/env node
/** 組合 HTML；遺漏任何 partial 都視為建置失敗。 */
const fs = require('node:fs');
const path = require('node:path');

const partials = ['header', 'mobile-menu', 'main-content', 'dialogs', 'footer'];
const template = fs.readFileSync(path.join(__dirname, 'index-template.html'), 'utf8');
const marker = /(<div id="app"[^>]*>)/;
if (!marker.test(template)) throw new Error('index-template.html 缺少 #app 容器。');
const content = partials
    .map((name) => fs.readFileSync(path.join(__dirname, 'partials', name + '.html'), 'utf8').trim())
    .join('\n');
fs.writeFileSync(
    path.join(__dirname, 'index.html'),
    template.replace(marker, (match) => match + '\n' + content + '\n'),
);
console.log('已建置 index.html');
