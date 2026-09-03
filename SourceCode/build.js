#!/usr/bin/env node

/**
 * Build Script - 拼接 HTML partials 成完整的 index.html
 *
 * 使用方式：
 *   npm install && npm run build
 * 或
 *   node build.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  partialsDir: path.join(__dirname, 'partials'),
  outputFile: path.join(__dirname, 'index.html'),
  assetsDir: path.join(__dirname, 'assets'),
};

// 部分文件的加载顺序
const partialFiles = [
  'header.html',
  'mobile-menu.html',
  'main-content.html',
  'dialogs.html',
  'footer.html',
];

/**
 * 读取文件内容
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ 错误：无法读取文件 ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * 写入文件
 */
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ 已生成：${filePath}`);
  } catch (error) {
    console.error(`❌ 错误：无法写入文件 ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * 检查 partials 目录
 */
function checkPartialsDirectory() {
  if (!fs.existsSync(config.partialsDir)) {
    console.error(`❌ 错误：partials 目录不存在：${config.partialsDir}`);
    process.exit(1);
  }
}

/**
 * 主构建函数
 */
function build() {
  console.log('🔨 开始构建 HTML...\n');

  // 检查目录
  checkPartialsDirectory();

  // 读取基础 HTML（head 部分）
  const baseTemplate = readFile(path.join(__dirname, 'index-template.html'));

  // 查找 <body> 标签的位置
  const bodyMatch = baseTemplate.match(/<body[^>]*>/);
  if (!bodyMatch) {
    console.error('❌ 错误：找不到 <body> 标签');
    process.exit(1);
  }

  const insertPoint = baseTemplate.indexOf(bodyMatch[0]) + bodyMatch[0].length;

  // 在 <div id="app"> 后开始插入 partials
  const appDivStart = baseTemplate.indexOf('<div id="app"', insertPoint);
  if (appDivStart === -1) {
    console.error('❌ 错误：找不到 <div id="app"> 标签');
    process.exit(1);
  }

  const appDivContent = baseTemplate.indexOf('>', appDivStart) + 1;

  // 加载所有 partials
  let partialsContent = '';
  for (const partialFile of partialFiles) {
    const partialPath = path.join(config.partialsDir, partialFile);

    if (!fs.existsSync(partialPath)) {
      console.warn(`⚠ 警告：跳过不存在的文件 ${partialFile}`);
      continue;
    }

    const content = readFile(partialPath);
    partialsContent += '\n        ' + content.trim().split('\n').join('\n        ') + '\n';
    console.log(`  ✓ 加载 ${partialFile}`);
  }

  // 拼接最终的 HTML
  const finalHtml =
    baseTemplate.substring(0, appDivContent) +
    partialsContent +
    baseTemplate.substring(appDivContent);

  // 写入输出文件
  writeFile(config.outputFile, finalHtml);

  console.log('\n✅ 构建完成！');
  console.log(`📄 输出文件：${config.outputFile}`);
  console.log(`📦 资源目录：${config.assetsDir}`);
  console.log('\n💡 提示：现在可以将 index.html 部署到 GitHub Pages');
}

// 运行构建
build();
