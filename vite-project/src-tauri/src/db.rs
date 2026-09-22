// db.rs — база SQLite: одна таблица «ключ → JSON-текст».
// Ключи те же, что у localStorage (tasks, habits, …), поэтому фронтенд работает с базой через тот же интерфейс StorageBackend.

use rusqlite::{params, Connection, OptionalExtension};
use std::{path::Path, sync::Mutex};

/// Допустимые ключи данных (список совпадает со StoreKey во фронтенде, storage.ts).
pub const KEYS: [&str; 7] = ["tasks", "habits", "moodData", "userSettings", "categoryMarkers", "schemaVersion", "migrationBackup"];

/// Версия структуры самой базы (не путать с версией схемы данных приложения: та лежит внутри, в ключе schemaVersion).
const DB_VERSION: i32 = 2;

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        Self::init(Connection::open(path).map_err(err)?)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        Self::init(Connection::open_in_memory().map_err(err)?)
    }

    fn init(conn: Connection) -> Result<Self, String> {
        // WAL: запись не блокирует чтение и переживает внезапное выключение
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
            .map_err(err)?;

        let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)?;
        if version > DB_VERSION {
            return Err(format!(
                "База создана более новой версией приложения (версия {version}, эта понимает до {DB_VERSION})"
            ));
        }
        if version < 1 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS kv (
                     key        TEXT PRIMARY KEY,
                     value      TEXT NOT NULL,
                     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 PRAGMA user_version = 1;",
            )
            .map_err(err)?;
        }
        if version < 2 {
            // журнал отправленных системных уведомлений: ключ вида «дата|вид|id задачи», чтобы не присылать одно дважды
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS notified (
                     key     TEXT PRIMARY KEY,
                     sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 PRAGMA user_version = 2;",
            )
            .map_err(err)?;
        }
        Ok(Db(Mutex::new(conn)))
    }

    pub fn read(&self, key: &str) -> Result<Option<String>, String> {
        check_key(key)?;
        let conn = self.0.lock().map_err(|_| "База занята другой операцией".to_string())?;
        conn.query_row("SELECT value FROM kv WHERE key = ?1", params![key], |r| r.get(0))
            .optional()
            .map_err(err)
    }

    /// Записывает в журнал, что уведомление с таким ключом отправлено. true — ключа ещё не было (уведомление нужно показать).
    pub fn mark_notified(&self, key: &str) -> Result<bool, String> {
        let conn = self.0.lock().map_err(|_| "База занята другой операцией".to_string())?;
        let changed = conn
            .execute("INSERT OR IGNORE INTO notified (key) VALUES (?1)", params![key])
            .map_err(err)?;
        Ok(changed == 1)
    }

    /// Удаляет из журнала записи старше 14 дней (вызывается при запуске).
    pub fn prune_notified(&self) -> Result<(), String> {
        let conn = self.0.lock().map_err(|_| "База занята другой операцией".to_string())?;
        conn.execute(
            "DELETE FROM notified WHERE sent_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')",
            [],
        )
        .map_err(err)?;
        Ok(())
    }

    pub fn write(&self, key: &str, value: &str) -> Result<(), String> {
        check_key(key)?;
        let conn = self.0.lock().map_err(|_| "База занята другой операцией".to_string())?;
        conn.execute(
            "INSERT INTO kv (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![key, value],
        )
        .map_err(err)?;
        Ok(())
    }
}

fn check_key(key: &str) -> Result<(), String> {
    if KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Неизвестный ключ данных: {key}"))
    }
}

fn err(e: rusqlite::Error) -> String {
    e.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_key_is_none() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(db.read("tasks").unwrap(), None);
    }

    #[test]
    fn write_then_read_roundtrip_and_overwrite() {
        let db = Db::open_in_memory().unwrap();
        db.write("tasks", r#"[{"id":"1","text":"Привет"}]"#).unwrap();
        assert_eq!(db.read("tasks").unwrap().as_deref(), Some(r#"[{"id":"1","text":"Привет"}]"#));
        db.write("tasks", "[]").unwrap();
        assert_eq!(db.read("tasks").unwrap().as_deref(), Some("[]"));
    }

    #[test]
    fn keys_are_independent() {
        let db = Db::open_in_memory().unwrap();
        db.write("habits", "[1]").unwrap();
        assert_eq!(db.read("moodData").unwrap(), None);
    }

    #[test]
    fn unknown_key_is_rejected() {
        let db = Db::open_in_memory().unwrap();
        assert!(db.write("../etc", "x").is_err());
        assert!(db.read("sqlite_master").is_err());
    }

    #[test]
    fn notified_key_is_reported_only_once() {
        let db = Db::open_in_memory().unwrap();
        assert!(db.mark_notified("2026-09-19|start|a").unwrap());
        assert!(!db.mark_notified("2026-09-19|start|a").unwrap());
        assert!(db.mark_notified("2026-09-19|start|b").unwrap());
        db.prune_notified().unwrap(); // свежие записи остаются
        assert!(!db.mark_notified("2026-09-19|start|a").unwrap());
    }

    #[test]
    fn old_database_of_version_1_is_upgraded_and_keeps_data() {
        let dir = std::env::temp_dir().join(format!("myday-db-upgrade-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("old.sqlite");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT ''); INSERT INTO kv (key, value) VALUES ('tasks', '[1]'); PRAGMA user_version = 1;").unwrap();
        }
        let db = Db::open(&path).unwrap();
        assert_eq!(db.read("tasks").unwrap().as_deref(), Some("[1]"));
        assert!(db.mark_notified("k").unwrap());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn data_survives_reopen_on_disk() {
        let dir = std::env::temp_dir().join(format!("myday-db-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.sqlite");
        Db::open(&path).unwrap().write("userSettings", r#"{"userName":"Аня"}"#).unwrap();
        let again = Db::open(&path).unwrap();
        assert_eq!(again.read("userSettings").unwrap().as_deref(), Some(r#"{"userName":"Аня"}"#));
        std::fs::remove_dir_all(&dir).ok();
    }
}
