import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { DEFAULT_NOTIFICATIONS, flushStore, loadSettings, normalizeNotifications, normalizeSettings, saveSettings } from '../../src/store';

describe('настройки уведомлений', () => {
    it('по умолчанию всё выключено: ничего не приходит, пока пользователь не согласится', () => {
        assert.equal(DEFAULT_NOTIFICATIONS.enabled, false);
        assert.equal(DEFAULT_NOTIFICATIONS.repeatEnabled, false);
        assert.equal(DEFAULT_NOTIFICATIONS.morningDigest, false);
        assert.equal(DEFAULT_NOTIFICATIONS.eveningEnabled, false);
        assert.deepEqual(loadSettings().notifications, DEFAULT_NOTIFICATIONS);
    });

    it('старые настройки без блока уведомлений получают значения по умолчанию', () => {
        assert.deepEqual(normalizeSettings({ themeMode: 'dark', userName: 'Аня' }).notifications, DEFAULT_NOTIFICATIONS);
    });

    it('мусор заменяется значениями по умолчанию по каждому полю отдельно', () => {
        const n = normalizeNotifications({
            enabled: 'да',
            dayStart: '25:00',
            repeatTime: '7:30',
            eveningTime: '22:15',
            morningDigest: true,
            x: 1,
        });
        assert.equal(n.enabled, false);
        assert.equal(n.dayStart, DEFAULT_NOTIFICATIONS.dayStart);
        assert.equal(n.repeatTime, DEFAULT_NOTIFICATIONS.repeatTime);
        assert.equal(n.eveningTime, '22:15');
        assert.equal(n.morningDigest, true);
        assert.deepEqual(normalizeNotifications([]), DEFAULT_NOTIFICATIONS);
        assert.deepEqual(normalizeNotifications(null), DEFAULT_NOTIFICATIONS);
    });

    it('сохраняются вместе с остальными настройками и переживают перезапуск', async () => {
        saveSettings({ notifications: { ...DEFAULT_NOTIFICATIONS, enabled: true, dayStart: '08:30' } });
        await flushStore();
        const stored = JSON.parse(localStorage.getItem('userSettings') as string);
        assert.equal(stored.notifications.enabled, true);
        assert.equal(stored.notifications.dayStart, '08:30');
        assert.equal(loadSettings().userName, '', 'соседние поля не затёрты');
    });
});
