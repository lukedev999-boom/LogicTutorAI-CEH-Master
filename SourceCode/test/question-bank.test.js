const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseQuestions, computeBankId, normalizeImagePath } = require('../assets/js/question-bank');
const sample = fs.readFileSync(path.join(__dirname, '../sampleMd/sample.md'), 'utf8');

test('範例包含全部題型、重要標記、圖片與完整程式碼', () => {
    const bank = parseQuestions(sample);
    assert.equal(bank.length, 5);
    assert.equal(bank[1].correctAnswer, 'AC');
    assert.equal(bank[1].isImportant, true);
    assert.equal(bank[2].isShortAnswer, true);
    assert.match(bank[2].explanation, /第 99 題/);
    assert.equal(bank[3].chineseText, '');
    assert.deepEqual(bank[4].imagePaths, ['images/example.svg']);
});

test('Windows 換行、ASCII 欄位冒號與縮排選項', () => {
    const changed = sample
        .replaceAll('：', ':')
        .replaceAll('- A.', '  - A.')
        .replaceAll('\n', '\r\n');
    assert.deepEqual(
        parseQuestions(changed).map((q) => q.correctAnswer),
        ['A', 'AC', '', 'B', 'C'],
    );
});

test('無效答案與缺少必要欄位會回報題號', () => {
    assert.throws(
        () => parseQuestions(sample.replace('**正確答案：A**', '**正確答案：F**')),
        /第 1 題/,
    );
    assert.throws(() => parseQuestions(sample.replace('**English:**', '**Unknown:**')), /第 1 題/);
});

test('Markdown 表格與行內欄位示範不截斷解析', () => {
    const bank = parseQuestions(
        sample.replace('A 與 C 都在瀏覽器本機完成。', '行內 **正確答案：B** 不是欄位。'),
    );
    assert.match(bank[1].explanation, /行內 \*\*正確答案：B\*\*/);
    assert.match(bank[1].explanation, /\|/);
});

test('同題號但不同題幹或答案不共用進度', () => {
    const bank = parseQuestions(sample);
    assert.equal(computeBankId(bank), computeBankId(parseQuestions(sample)));
    assert.notEqual(
        computeBankId(bank),
        computeBankId(parseQuestions(sample.replace('**正確答案：A**', '**正確答案：B**'))),
    );
    assert.notEqual(
        computeBankId(bank),
        computeBankId(parseQuestions(sample.replace('Which file', 'What file'))),
    );
});

test('圖片路徑可部署於子目錄並拒絕主動內容協定', () => {
    assert.equal(normalizeImagePath('../images/2026/q1.png'), 'images/2026/q1.png');
    assert.equal(normalizeImagePath('q1.png'), 'images/q1.png');
    assert.equal(normalizeImagePath('javascript:alert(1)'), '');
    assert.equal(normalizeImagePath('data:text/html,test'), '');
    assert.equal(normalizeImagePath('https://example.com/q.png'), 'https://example.com/q.png');
});

test('儲存被封鎖時仍可作答與重設', () => {
    const context = vm.createContext({
        window: {
            get localStorage() {
                throw new Error('blocked');
            },
        },
        console: { warn() {} },
    });
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../assets/js/storage.js'), 'utf8'),
        context,
    );
    assert.equal(vm.runInContext("storage.setItem('a', 3); storage.getItem('a')", context), '3');
    assert.equal(vm.runInContext("storage.removeItem('a'); storage.getItem('a')", context), null);
});

test('手寫 JavaScript 均可解析', () => {
    for (const folder of ['assets/js', 'tools']) {
        for (const name of fs.readdirSync(path.join(__dirname, '..', folder))) {
            if (name.endsWith('.js'))
                new vm.Script(fs.readFileSync(path.join(__dirname, '..', folder, name), 'utf8'), {
                    filename: name,
                });
        }
    }
});
