import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { createMemoryBackend } from '../../src/storage';
import { initStore } from '../../src/store';
import { mkHabit, mkMood, mkTask } from './factories';

// «Файлы vault» на стороне Rust заменены картой в памяти
const files = new Map<string, string>();
const log: string[] = [];
const invoke = vi.fn(async (command: string, args: { vault: string; date: string; content?: string }) => {
    const path = `${args.vault}/daily-notes/${args.date}.md`;
    log.push(`${command} ${args.date}`);
    await Promise.resolve(); // как настоящий IPC: ответ приходит не сразу
    if (command === 'vault_read_note') return files.get(path) ?? null;
    if (command === 'vault_write_note') {
        files.set(path, args.content as string);
        return null;
    }
    throw new Error(`неизвестная команда ${command}`);
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: Parameters<typeof invoke>) => invoke(...a) }));

const { BLOCK_END, BLOCK_START, buildDailyNoteBlock, mergeNoteBlock, writeDailyNote } = await import('../../src/dailyNote');

const DAY = '2026-09-19'; // суббота: Пн = 0 … Сб = 5
const OTHER = '2026-09-18';

describe('buildDailyNoteBlock', () => {
    it('в блок попадают задачи дня, привычки по графику и настроение; чужие дни — нет', () => {
        const block = buildDailyNoteBlock(DAY, {
            tasks: [
                mkTask({ text: 'Позвонить', date: DAY, time: '14:30', category: 'Дом', notes: 'первая строка\nвторая' }),
                mkTask({ text: 'Сделано вчера, отмечено сегодня', date: OTHER, completed: true, completedAt: DAY }),
                mkTask({ text: 'Чужая', date: OTHER }),
            ],
            habits: [
                mkHabit({ text: 'Зарядка', dates: [DAY] }),
                mkHabit({ text: 'Чтение' }),
                mkHabit({ text: 'Только по будням', days: [0, 1, 2, 3, 4] }),
            ],
            mood: [mkMood(DAY, 4, 'спокойно'), mkMood(OTHER, 1)],
        });
        assert.equal(
            block,
            [
                BLOCK_START,
                '## Мой день',
                '',
                '### Задачи',
                '- [ ] 14:30 Позвонить (Дом)',
                '  > первая строка',
                '  > вторая',
                '- [x] Сделано вчера, отмечено сегодня',
                '',
                '### Привычки',
                '- [x] Зарядка',
                '- [ ] Чтение',
                '',
                '### Настроение',
                '4/5 — спокойно',
                '',
                BLOCK_END,
            ].join('\n'),
        );
    });

    it('день без записей — понятная строка, а не пустой блок', () => {
        const block = buildDailyNoteBlock(DAY, { tasks: [], habits: [], mood: [] });
        assert.match(block, /Записей за этот день нет\./);
        assert.ok(block.startsWith(BLOCK_START) && block.endsWith(BLOCK_END));
    });
});

describe('mergeNoteBlock', () => {
    const block = `${BLOCK_START}\nновый\n${BLOCK_END}`;

    it('заметки нет или она пустая — только блок', () => {
        assert.equal(mergeNoteBlock(null, block), `${block}\n`);
        assert.equal(mergeNoteBlock('  \n', block), `${block}\n`);
    });

    it('чужой текст без блока сохраняется, блок дописывается в конец', () => {
        assert.equal(mergeNoteBlock('# Мои мысли\n\nтекст\n\n\n', block), `# Мои мысли\n\nтекст\n\n${block}\n`);
    });

    it('прежний блок заменяется на месте, текст до и после не трогается', () => {
        const old = `до\n\n${BLOCK_START}\nстарый\n${BLOCK_END}\n\nпосле\n`;
        assert.equal(mergeNoteBlock(old, block), `до\n\n${block}\n\nпосле\n`);
    });

    it('повторная запись идемпотентна', () => {
        const once = mergeNoteBlock('мой текст', block);
        assert.equal(mergeNoteBlock(once, block), once);
    });

    it('маркер начала без конца — считается, что блока нет: ничего не теряется', () => {
        const broken = `текст\n${BLOCK_START}\nобрывок`;
        assert.equal(mergeNoteBlock(broken, block), `${broken}\n\n${block}\n`);
    });
});

describe('writeDailyNote', () => {
    beforeEach(async () => {
        files.clear();
        log.length = 0;
        invoke.mockClear();
        await initStore(createMemoryBackend({ tasks: [{ id: 'a', text: 'Из store', date: DAY }], schemaVersion: 1 }));
    });

    it('берёт данные из store и сохраняет чужой текст заметки', async () => {
        files.set(`/v/daily-notes/${DAY}.md`, 'мой дневник\n');
        await writeDailyNote('/v', DAY);
        const text = files.get(`/v/daily-notes/${DAY}.md`) as string;
        assert.ok(text.startsWith('мой дневник\n\n'));
        assert.match(text, /- \[ \] Из store/);
    });

    it('записи идут по очереди: вторая читает файл только после того, как первая записала', async () => {
        await Promise.all([writeDailyNote('/v', DAY), writeDailyNote('/v', DAY)]);
        assert.deepEqual(log, [`vault_read_note ${DAY}`, `vault_write_note ${DAY}`, `vault_read_note ${DAY}`, `vault_write_note ${DAY}`]);
    });

    it('сбой одной записи не ломает следующие', async () => {
        invoke.mockRejectedValueOnce('папка недоступна');
        await assert.rejects(writeDailyNote('/v', DAY), /папка недоступна/);
        await writeDailyNote('/v', DAY);
        assert.ok(files.has(`/v/daily-notes/${DAY}.md`));
    });
});
