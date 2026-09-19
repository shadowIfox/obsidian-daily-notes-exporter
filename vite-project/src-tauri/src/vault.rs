// vault.rs — ежедневные заметки в Obsidian-vault: <vault>/daily-notes/ГГГГ-ММ-ДД.md.
// Пишет только в эту одну папку и только файлы с датой в имени, поэтому путь нельзя «увести» в сторону.

use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

const NOTES_DIR: &str = "daily-notes";

/// Ровно ГГГГ-ММ-ДД: цифры и два дефиса (календарную правильность проверять не нужно, важна безопасность имени файла).
fn is_date(s: &str) -> bool {
    s.len() == 10
        && s.bytes()
            .enumerate()
            .all(|(i, b)| if i == 4 || i == 7 { b == b'-' } else { b.is_ascii_digit() })
}

fn note_path(vault: &str, date: &str) -> Result<PathBuf, String> {
    if !is_date(date) {
        return Err(format!("Дата заметки должна быть в виде ГГГГ-ММ-ДД, получено: {date}"));
    }
    let vault = Path::new(vault);
    if !vault.is_dir() {
        return Err(format!("Папка vault не найдена: {}", vault.display()));
    }
    Ok(vault.join(NOTES_DIR).join(format!("{date}.md")))
}

/// Текст заметки за день; None — заметки ещё нет.
pub fn read_note(vault: &str, date: &str) -> Result<Option<String>, String> {
    match fs::read_to_string(note_path(vault, date)?) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Не удалось прочитать заметку: {e}")),
    }
}

/// Записывает заметку целиком. Сначала во временный файл рядом, потом переименование: при сбое старая заметка остаётся целой.
pub fn write_note(vault: &str, date: &str, content: &str) -> Result<(), String> {
    let path = note_path(vault, date)?;
    let dir = path.parent().ok_or("Некорректный путь заметки")?;
    fs::create_dir_all(dir).map_err(|e| format!("Не удалось создать папку {NOTES_DIR}: {e}"))?;
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content).map_err(|e| format!("Не удалось записать заметку: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Не удалось записать заметку: {e}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Пустая временная папка, удаляется вместе с вызовом drop.
    struct TempVault(PathBuf);
    impl TempVault {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("myday-vault-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempVault(dir)
        }
        fn path(&self) -> &str {
            self.0.to_str().unwrap()
        }
    }
    impl Drop for TempVault {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn date_format_is_strict() {
        assert!(is_date("2026-09-19"));
        for bad in [
            "2026-9-19",
            "2026/09/19",
            "../../etc",
            "2026-09-19/../x",
            "2026-09-19\n",
            "",
            "абвг-09-19",
        ] {
            assert!(!is_date(bad), "{bad:?} не должна проходить");
        }
    }

    #[test]
    fn missing_note_is_none_and_missing_vault_is_error() {
        let v = TempVault::new("missing");
        assert_eq!(read_note(v.path(), "2026-09-19").unwrap(), None);
        assert!(read_note("/такой/папки/нет", "2026-09-19").is_err());
        assert!(write_note("/такой/папки/нет", "2026-09-19", "x").is_err());
    }

    #[test]
    fn write_creates_folder_and_file_then_overwrites() {
        let v = TempVault::new("write");
        write_note(v.path(), "2026-09-19", "первая версия\n").unwrap();
        assert!(Path::new(v.path()).join("daily-notes/2026-09-19.md").is_file());
        assert_eq!(read_note(v.path(), "2026-09-19").unwrap().as_deref(), Some("первая версия\n"));
        write_note(v.path(), "2026-09-19", "вторая\n").unwrap();
        assert_eq!(read_note(v.path(), "2026-09-19").unwrap().as_deref(), Some("вторая\n"));
    }

    #[test]
    fn no_temp_file_is_left_behind() {
        let v = TempVault::new("tmp");
        write_note(v.path(), "2026-09-19", "текст").unwrap();
        let names: Vec<_> = fs::read_dir(Path::new(v.path()).join("daily-notes"))
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, vec![std::ffi::OsString::from("2026-09-19.md")]);
    }

    #[test]
    fn bad_date_never_touches_disk() {
        let v = TempVault::new("bad");
        assert!(write_note(v.path(), "../evil", "x").is_err());
        assert!(!Path::new(v.path()).join("daily-notes").exists());
    }
}
