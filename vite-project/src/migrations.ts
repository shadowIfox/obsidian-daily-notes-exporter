// migrations.ts — версия схемы данных и миграции между версиями (без DOM и хранилища).
//
// Схема — это форма сохранённых данных (какие поля у задачи, привычки и т. д.). Когда форма меняется,
// SCHEMA_VERSION увеличивается на 1 и добавляется миграция «старая версия → новая». Так данные, записанные
// прошлой версией приложения (или резервная копия из неё), приводятся к нынешнему виду, а не теряются.
//
// Правила миграции:
//  • работает с «сырыми» данными (unknown) и ничего не предполагает про их аккуратность;
//  • возвращает новые объекты, входные данные не меняет;
//  • повторный запуск на уже мигрированных данных ничего не портит.

import { newId } from './utils/id';

/** Текущая версия схемы. Совпадает с версией резервной копии. */
export const SCHEMA_VERSION = 1;

export type RawData = { tasks: unknown; habits: unknown; mood: unknown; settings: unknown };

export type Migration = {
    from: number;
    to: number;
    /** Что делает миграция — для читающего код и для журнала. */
    description: string;
    up(data: RawData): RawData;
};

export class SchemaTooNewError extends Error {
    found: number;
    supported: number;

    constructor(found: number, supported: number) {
        super(
            `Данные сохранены более новой версией приложения (схема ${found}, эта версия понимает до ${supported}). Обновите приложение, иначе данные могут быть повреждены.`,
        );
        this.name = 'SchemaTooNewError';
        this.found = found;
        this.supported = supported;
    }
}

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Применяет fn к каждому объекту массива; всё остальное (мусор, не-массив) оставляет как есть. */
function mapRecords(list: unknown, fn: (r: Raw) => Raw): unknown {
    return Array.isArray(list) ? list.map((item) => (isRecord(item) ? fn(item) : item)) : list;
}

const hasId = (r: Raw): boolean => typeof r.id === 'string' && r.id !== '';

export const MIGRATIONS: Migration[] = [
    {
        from: 0,
        to: 1,
        description: 'Данные до появления версий: поля checked/done → completed, записям без id выдаётся постоянный id',
        up: (data) => ({
            ...data,
            tasks: mapRecords(data.tasks, ({ checked, done, ...t }) => ({
                ...t,
                id: hasId(t) ? t.id : newId(),
                completed: t.completed ?? checked ?? done,
            })),
            habits: mapRecords(data.habits, (h) => ({ ...h, id: hasId(h) ? h.id : newId() })),
        }),
    },
];

/**
 * Приводит данные версии `from` к версии `target`, применяя миграции по порядку.
 * Данные из более новой версии не трогает — бросает SchemaTooNewError.
 */
export function migrate(data: RawData, from: number, migrations: Migration[] = MIGRATIONS, target: number = SCHEMA_VERSION): RawData {
    if (from > target) throw new SchemaTooNewError(from, target);
    let version = from;
    let current = data;
    while (version < target) {
        const step = migrations.find((m) => m.from === version);
        if (!step) throw new Error(`Нет миграции данных с версии ${version}.`);
        current = step.up(current);
        version = step.to;
    }
    return current;
}
