// notify.rs — системные уведомления: что и когда напомнить.
//
// Расписание считает Rust, а не окно: когда окно спрятано в меню-бар, WebView может «засыпать» вместе с таймерами.
// due_notices — чистая функция «данные + текущее время → какие уведомления пора показать» (её и тестируем);
// планировщик раз в полминуты вызывает её, а журнал `notified` в базе не даёт прислать одно и то же дважды.

use crate::db::Db;
use serde_json::Value;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

/// Сколько задач со временем показывать отдельными уведомлениями в начале дня (остальные — одним «и ещё N»).
const MAX_SEPARATE_TASKS: usize = 5;
/// За сколько минут до срока напоминать о задаче.
const BEFORE_DEADLINE_MIN: u32 = 120;

/// Настройки уведомлений (userSettings.notifications во фронтенде). Времена — минуты от полуночи.
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub enabled: bool,
    pub day_start: u32,
    pub task_at_day_start: bool,
    pub task_before_deadline: bool,
    pub repeat_at: Option<u32>,
    pub morning_digest: bool,
    pub evening_at: Option<u32>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            enabled: false,
            day_start: 9 * 60,
            task_at_day_start: true,
            task_before_deadline: true,
            repeat_at: None,
            morning_digest: false,
            evening_at: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Task {
    id: String,
    text: String,
    category: String,
    date: String,
    time: Option<u32>,
    completed: bool,
    completed_at: String,
}

#[derive(Debug, Clone)]
pub struct Habit {
    dates: Vec<String>,
    days: Option<Vec<u8>>, // дни недели по графику (Пн = 0); нет — каждый день
    archived: bool,
}

#[derive(Debug, Default, Clone)]
pub struct Snapshot {
    pub tasks: Vec<Task>,
    pub habits: Vec<Habit>,
    pub mood_dates: Vec<String>,
    pub settings: Settings,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Notice {
    pub key: String,
    pub title: String,
    pub body: String,
}

// ===== Разбор данных из базы (JSON из фронтенда; всё, что не разобралось, молча пропускается) =====

fn parse_time(s: &str) -> Option<u32> {
    let (h, m) = s.split_once(':')?;
    if h.len() != 2 || m.len() != 2 {
        return None;
    }
    let (h, m): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
    (h < 24 && m < 60).then_some(h * 60 + m)
}

fn text(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}

fn flag(v: &Value, key: &str, default: bool) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(default)
}

fn time_or(v: &Value, key: &str, default: u32) -> u32 {
    v.get(key).and_then(Value::as_str).and_then(parse_time).unwrap_or(default)
}

fn items(json: Option<&str>) -> Vec<Value> {
    json.and_then(|t| serde_json::from_str::<Value>(t).ok())
        .and_then(|v| if let Value::Array(a) = v { Some(a) } else { None })
        .unwrap_or_default()
}

pub fn parse_settings(user_settings: Option<&str>) -> Settings {
    let root = user_settings
        .and_then(|t| serde_json::from_str::<Value>(t).ok())
        .unwrap_or(Value::Null);
    let Some(n) = root.get("notifications").filter(|v| v.is_object()) else {
        return Settings::default();
    };
    let d = Settings::default();
    Settings {
        enabled: flag(n, "enabled", d.enabled),
        day_start: time_or(n, "dayStart", d.day_start),
        task_at_day_start: flag(n, "taskAtDayStart", d.task_at_day_start),
        task_before_deadline: flag(n, "taskBeforeDeadline", d.task_before_deadline),
        repeat_at: flag(n, "repeatEnabled", false).then(|| time_or(n, "repeatTime", 18 * 60)),
        morning_digest: flag(n, "morningDigest", d.morning_digest),
        evening_at: flag(n, "eveningEnabled", false).then(|| time_or(n, "eveningTime", 21 * 60)),
    }
}

impl Snapshot {
    pub fn from_json(tasks: Option<&str>, habits: Option<&str>, mood: Option<&str>, user_settings: Option<&str>) -> Snapshot {
        Snapshot {
            tasks: items(tasks)
                .iter()
                .map(|t| Task {
                    id: text(t, "id"),
                    text: text(t, "text"),
                    category: text(t, "category"),
                    date: text(t, "date"),
                    time: t.get("time").and_then(Value::as_str).and_then(parse_time),
                    completed: flag(t, "completed", false),
                    completed_at: text(t, "completedAt"),
                })
                .collect(),
            habits: items(habits)
                .iter()
                .map(|h| Habit {
                    dates: h
                        .get("dates")
                        .and_then(Value::as_array)
                        .map_or(vec![], |a| a.iter().filter_map(|d| d.as_str().map(String::from)).collect()),
                    days: h
                        .get("days")
                        .and_then(Value::as_array)
                        .map(|a| a.iter().filter_map(|d| d.as_u64().map(|d| d as u8)).collect()),
                    archived: flag(h, "archived", false),
                })
                .collect(),
            mood_dates: items(mood).iter().map(|m| text(m, "date")).collect(),
            settings: parse_settings(user_settings),
        }
    }
}

// ===== Тексты =====

fn plural(n: usize, forms: [&str; 3]) -> &str {
    let (m10, m100) = (n % 10, n % 100);
    if m10 == 1 && m100 != 11 {
        forms[0]
    } else if (2..=4).contains(&m10) && !(10..20).contains(&m100) {
        forms[1]
    } else {
        forms[2]
    }
}

fn tasks_word(n: usize) -> String {
    format!("{n} {}", plural(n, ["задача", "задачи", "задач"]))
}

fn hhmm(min: u32) -> String {
    format!("{:02}:{:02}", min / 60, min % 60)
}

/// «1 ч 45 мин», «2 ч», «40 мин».
fn left_text(min: u32) -> String {
    match (min / 60, min % 60) {
        (0, m) => format!("{m} мин"),
        (h, 0) => format!("{h} ч"),
        (h, m) => format!("{h} ч {m} мин"),
    }
}

fn is_due(habit: &Habit, weekday: u8) -> bool {
    !habit.archived && habit.days.as_ref().is_none_or(|d| d.contains(&weekday))
}

// ===== Что пора показать =====

/// Уведомления, которые пора показать сейчас. today — «ГГГГ-ММ-ДД», weekday — Пн = 0 … Вс = 6, now — минуты от полуночи.
/// Функция «без памяти»: она возвращает всё, что подходит по времени; уже отправленное отсеивает журнал `notified` по ключу.
pub fn due_notices(snap: &Snapshot, today: &str, weekday: u8, now: u32) -> Vec<Notice> {
    let s = &snap.settings;
    if !s.enabled {
        return vec![];
    }
    let mut out = Vec::new();
    let notice = |kind: &str, id: &str, title: String, body: String| Notice {
        key: if id.is_empty() {
            format!("{today}|{kind}")
        } else {
            format!("{today}|{kind}|{id}")
        },
        title,
        body,
    };

    let open_today: Vec<&Task> = snap.tasks.iter().filter(|t| !t.completed && t.date == today).collect();
    let mut timed: Vec<&Task> = open_today.iter().copied().filter(|t| t.time.is_some()).collect();
    timed.sort_by_key(|t| t.time);

    // 1. Начало дня: по одному уведомлению на задачу со временем (только на те, что ещё впереди)
    if s.task_at_day_start && now >= s.day_start {
        let upcoming: Vec<&&Task> = timed.iter().filter(|t| t.time.is_some_and(|m| m >= now)).collect();
        for t in upcoming.iter().take(MAX_SEPARATE_TASKS) {
            let body = if t.category.is_empty() {
                t.text.clone()
            } else {
                format!("{} ({})", t.text, t.category)
            };
            out.push(notice("start", &t.id, format!("Сегодня в {}", hhmm(t.time.unwrap_or(0))), body));
        }
        if upcoming.len() > MAX_SEPARATE_TASKS {
            let rest = upcoming.len() - MAX_SEPARATE_TASKS;
            out.push(notice(
                "start",
                "more",
                "Сегодня по времени".into(),
                format!("и ещё {}", tasks_word(rest)),
            ));
        }
    }

    // 2. За 2 часа до срока. Если это время раньше начала дня — задачу уже назвало утреннее уведомление
    //    (а если те выключены, напоминание приходит в начале дня, а не среди ночи)
    if s.task_before_deadline {
        for t in &timed {
            let due = t.time.unwrap_or(0);
            let mut fire = due.saturating_sub(BEFORE_DEADLINE_MIN);
            if due < BEFORE_DEADLINE_MIN || fire <= s.day_start {
                if s.task_at_day_start {
                    continue;
                }
                fire = s.day_start;
            }
            if fire < due && now >= fire && now < due {
                out.push(notice(
                    "due",
                    &t.id,
                    t.text.clone(),
                    format!("Срок сегодня в {} — осталось {}", hhmm(due), left_text(due - now)),
                ));
            }
        }
    }

    // 3. Повторное напоминание в выбранное время: что ещё не сделано на сегодня
    if let Some(at) = s.repeat_at {
        if now >= at && !open_today.is_empty() {
            let names: Vec<&str> = open_today.iter().take(3).map(|t| t.text.as_str()).collect();
            let more = open_today.len().saturating_sub(3);
            let body = if more > 0 {
                format!("{} и ещё {more}", names.join(", "))
            } else {
                names.join(", ")
            };
            out.push(notice(
                "repeat",
                "",
                format!("Ещё не сделано: {}", tasks_word(open_today.len())),
                body,
            ));
        }
    }

    // 4. Утренняя сводка (по согласию): план на сегодня
    if s.morning_digest && now >= s.day_start {
        let overdue = snap
            .tasks
            .iter()
            .filter(|t| !t.completed && !t.date.is_empty() && t.date.as_str() < today)
            .count();
        let habits = snap
            .habits
            .iter()
            .filter(|h| is_due(h, weekday) && !h.dates.iter().any(|d| d == today))
            .count();
        let mut parts = Vec::new();
        if !open_today.is_empty() {
            parts.push(format!("на сегодня: {}", tasks_word(open_today.len())));
        }
        if overdue > 0 {
            parts.push(format!("просрочено: {overdue}"));
        }
        if habits > 0 {
            parts.push(format!("привычек: {habits}"));
        }
        if !parts.is_empty() {
            out.push(notice("morning", "", "План на сегодня".into(), parts.join(" · ")));
        }
    }

    // 5. Итоги дня (по согласию): что сделано и напоминание про настроение
    if let Some(at) = s.evening_at {
        if now >= at {
            let done = snap.tasks.iter().filter(|t| t.completed && t.completed_at == today).count();
            let due_habits: Vec<&Habit> = snap.habits.iter().filter(|h| is_due(h, weekday)).collect();
            let habits_done = due_habits.iter().filter(|h| h.dates.iter().any(|d| d == today)).count();
            let mut body = format!("Задач выполнено: {done}");
            if !due_habits.is_empty() {
                body += &format!(" · привычек: {habits_done} из {}", due_habits.len());
            }
            if !snap.mood_dates.iter().any(|d| d == today) {
                body += ". Как прошёл день? Запишите настроение.";
            }
            out.push(notice("evening", "", "Итоги дня".into(), body));
        }
    }

    out
}

// ===== Планировщик =====

/// Раз в полминуты читает данные из базы и показывает уведомления, которые ещё не отправлялись.
pub fn start_scheduler(app: AppHandle) {
    std::thread::spawn(move || {
        if let Some(db) = app.try_state::<Db>() {
            let _ = db.prune_notified();
        }
        loop {
            tick(&app);
            std::thread::sleep(Duration::from_secs(30));
        }
    });
}

fn tick(app: &AppHandle) {
    use chrono::{Datelike, Local, Timelike};
    let Some(db) = app.try_state::<Db>() else { return };
    let read = |key: &str| db.read(key).ok().flatten();
    let snap = Snapshot::from_json(
        read("tasks").as_deref(),
        read("habits").as_deref(),
        read("moodData").as_deref(),
        read("userSettings").as_deref(),
    );

    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let weekday = now.weekday().num_days_from_monday() as u8;
    for notice in due_notices(&snap, &today, weekday, now.hour() * 60 + now.minute()) {
        // Ключ записывается до показа: сбой показа лучше пропущенного напоминания, чем спама каждые полминуты
        if db.mark_notified(&notice.key).unwrap_or(false) {
            if let Err(e) = app.notification().builder().title(&notice.title).body(&notice.body).show() {
                log::warn!("Не удалось показать уведомление «{}»: {e}", notice.title);
            }
        }
    }
}

/// Пробное уведомление: по нему пользователь проверяет, что macOS разрешила показ.
pub fn send_test(app: &AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Мой день")
        .body("Уведомления работают: так будут выглядеть напоминания.")
        .show()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TODAY: &str = "2026-09-19";

    fn snap(tasks: &str, settings: &str) -> Snapshot {
        Snapshot::from_json(
            Some(tasks),
            Some("[]"),
            Some("[]"),
            Some(&format!(r#"{{"notifications":{settings}}}"#)),
        )
    }

    fn keys(n: &[Notice]) -> Vec<&str> {
        n.iter().map(|x| x.key.as_str()).collect()
    }

    const T_1430: &str = r#"[{"id":"a","text":"Позвонить маме","date":"2026-09-19","time":"14:30","category":"Дом","completed":false}]"#;

    #[test]
    fn nothing_is_sent_while_disabled() {
        let s = snap(T_1430, r#"{"enabled":false}"#);
        assert!(due_notices(&s, TODAY, 5, 12 * 60).is_empty());
        assert!(due_notices(&Snapshot::default(), TODAY, 5, 12 * 60).is_empty());
    }

    #[test]
    fn day_start_sends_one_notice_per_upcoming_timed_task() {
        let tasks = r#"[
            {"id":"a","text":"Утро","date":"2026-09-19","time":"08:00","completed":false},
            {"id":"b","text":"Обед","date":"2026-09-19","time":"13:00","category":"Работа","completed":false},
            {"id":"c","text":"Без времени","date":"2026-09-19","completed":false},
            {"id":"d","text":"Сделано","date":"2026-09-19","time":"15:00","completed":true},
            {"id":"e","text":"Завтра","date":"2026-09-20","time":"16:00","completed":false}
        ]"#;
        let s = snap(tasks, r#"{"enabled":true,"dayStart":"09:00","taskBeforeDeadline":false}"#);
        assert!(due_notices(&s, TODAY, 5, 8 * 60 + 59).is_empty(), "до начала дня тихо");
        let n = due_notices(&s, TODAY, 5, 9 * 60);
        assert_eq!(
            keys(&n),
            ["2026-09-19|start|b"],
            "только предстоящие, невыполненные, со временем, на сегодня"
        );
        assert_eq!(n[0].title, "Сегодня в 13:00");
        assert_eq!(n[0].body, "Обед (Работа)");
    }

    #[test]
    fn many_tasks_are_grouped_after_five() {
        let tasks: Vec<String> = (0..8)
            .map(|i| {
                format!(
                    r#"{{"id":"t{i}","text":"З{i}","date":"2026-09-19","time":"{:02}:00","completed":false}}"#,
                    10 + i
                )
            })
            .collect();
        let s = snap(&format!("[{}]", tasks.join(",")), r#"{"enabled":true,"taskBeforeDeadline":false}"#);
        let n = due_notices(&s, TODAY, 5, 9 * 60);
        assert_eq!(n.len(), 6);
        assert_eq!(n[5].key, "2026-09-19|start|more");
        assert_eq!(n[5].body, "и ещё 3 задачи");
    }

    #[test]
    fn two_hours_before_deadline_with_time_left() {
        let s = snap(T_1430, r#"{"enabled":true,"taskAtDayStart":false}"#);
        assert!(due_notices(&s, TODAY, 5, 12 * 60 + 29).is_empty());
        let n = due_notices(&s, TODAY, 5, 12 * 60 + 30);
        assert_eq!(keys(&n), ["2026-09-19|due|a"]);
        assert_eq!(n[0].body, "Срок сегодня в 14:30 — осталось 2 ч");
        // приложение запущено позже — напоминание всё ещё нужно, пока срок не наступил
        assert_eq!(due_notices(&s, TODAY, 5, 14 * 60)[0].body, "Срок сегодня в 14:30 — осталось 30 мин");
        assert!(
            due_notices(&s, TODAY, 5, 14 * 60 + 30).is_empty(),
            "срок наступил — поздно напоминать «за 2 часа»"
        );
    }

    #[test]
    fn early_deadline_is_covered_by_day_start_or_moved_to_it() {
        let early = r#"[{"id":"a","text":"Ранняя","date":"2026-09-19","time":"10:00","completed":false}]"#;
        // утреннее уведомление включено: оно и назовёт задачу, «за 2 часа» (08:00) не шлём
        let with_start = snap(early, r#"{"enabled":true,"dayStart":"09:00"}"#);
        assert_eq!(keys(&due_notices(&with_start, TODAY, 5, 9 * 60)), ["2026-09-19|start|a"]);
        // утреннее выключено: напоминание приходит в начале дня (09:00), а не в 08:00
        let no_start = snap(early, r#"{"enabled":true,"dayStart":"09:00","taskAtDayStart":false}"#);
        assert!(due_notices(&no_start, TODAY, 5, 8 * 60).is_empty());
        assert_eq!(keys(&due_notices(&no_start, TODAY, 5, 9 * 60)), ["2026-09-19|due|a"]);
        // задача в 01:00 (раньше любого «за 2 часа») тоже не даёт напоминание ночью
        let night = r#"[{"id":"n","text":"Ночная","date":"2026-09-19","time":"01:00","completed":false}]"#;
        assert!(due_notices(&snap(night, r#"{"enabled":true,"taskAtDayStart":false}"#), TODAY, 5, 0).is_empty());
    }

    #[test]
    fn completed_task_gets_no_deadline_reminder() {
        let done = r#"[{"id":"a","text":"Готово","date":"2026-09-19","time":"14:30","completed":true}]"#;
        let s = snap(done, r#"{"enabled":true}"#);
        assert!(due_notices(&s, TODAY, 5, 13 * 60).is_empty());
    }

    #[test]
    fn repeat_reminder_lists_what_is_still_open() {
        let tasks = r#"[
            {"id":"a","text":"Один","date":"2026-09-19","completed":false},
            {"id":"b","text":"Два","date":"2026-09-19","time":"20:00","completed":false},
            {"id":"c","text":"Три","date":"2026-09-19","completed":false},
            {"id":"d","text":"Четыре","date":"2026-09-19","completed":false},
            {"id":"e","text":"Готово","date":"2026-09-19","completed":true}
        ]"#;
        let s = snap(
            tasks,
            r#"{"enabled":true,"taskAtDayStart":false,"taskBeforeDeadline":false,"repeatEnabled":true,"repeatTime":"18:00"}"#,
        );
        assert!(due_notices(&s, TODAY, 5, 17 * 60 + 59).is_empty());
        let n = due_notices(&s, TODAY, 5, 18 * 60);
        assert_eq!(keys(&n), ["2026-09-19|repeat"]);
        assert_eq!(n[0].title, "Ещё не сделано: 4 задачи");
        assert_eq!(n[0].body, "Один, Два, Три и ещё 1");
        let all_done = snap(
            r#"[{"id":"a","text":"Х","date":"2026-09-19","completed":true}]"#,
            r#"{"enabled":true,"repeatEnabled":true}"#,
        );
        assert!(due_notices(&all_done, TODAY, 5, 19 * 60).is_empty(), "всё сделано — не беспокоим");
    }

    #[test]
    fn morning_digest_counts_tasks_overdue_and_habits() {
        let tasks = r#"[
            {"id":"a","text":"А","date":"2026-09-19","completed":false},
            {"id":"b","text":"Б","date":"2026-09-10","completed":false},
            {"id":"c","text":"В","date":"2026-09-11","completed":true}
        ]"#;
        let habits = r#"[
            {"dates":["2026-09-19"]},
            {"dates":[]},
            {"dates":[],"days":[0,1,2,3,4]},
            {"dates":[],"archived":true}
        ]"#;
        let s = Snapshot::from_json(
            Some(tasks),
            Some(habits),
            Some("[]"),
            Some(r#"{"notifications":{"enabled":true,"morningDigest":true,"taskAtDayStart":false,"taskBeforeDeadline":false}}"#),
        );
        let n = due_notices(&s, TODAY, 5, 9 * 60); // суббота: привычка «по будням» не считается, отмеченная — тоже
        assert_eq!(n[0].title, "План на сегодня");
        assert_eq!(n[0].body, "на сегодня: 1 задача · просрочено: 1 · привычек: 1");
        assert!(
            due_notices(
                &Snapshot {
                    settings: Settings {
                        enabled: true,
                        morning_digest: true,
                        ..Default::default()
                    },
                    ..Default::default()
                },
                TODAY,
                5,
                9 * 60
            )
            .is_empty(),
            "пустой день — без сводки"
        );
    }

    #[test]
    fn evening_summary_mentions_mood_only_when_missing() {
        let tasks = r#"[{"id":"a","text":"А","date":"2026-09-18","completed":true,"completedAt":"2026-09-19"},{"id":"b","text":"Б","date":"2026-09-19","completed":false}]"#;
        let habits = r#"[{"dates":["2026-09-19"]},{"dates":[]}]"#;
        let settings = r#"{"notifications":{"enabled":true,"eveningEnabled":true,"eveningTime":"21:00","taskAtDayStart":false,"taskBeforeDeadline":false}}"#;
        let without = Snapshot::from_json(Some(tasks), Some(habits), Some("[]"), Some(settings));
        assert!(due_notices(&without, TODAY, 5, 20 * 60 + 59).is_empty());
        let n = due_notices(&without, TODAY, 5, 21 * 60);
        assert_eq!(n[0].title, "Итоги дня");
        assert_eq!(
            n[0].body,
            "Задач выполнено: 1 · привычек: 1 из 2. Как прошёл день? Запишите настроение."
        );

        let with_mood = Snapshot::from_json(
            Some(tasks),
            Some(habits),
            Some(r#"[{"date":"2026-09-19","rating":4,"note":""}]"#),
            Some(settings),
        );
        assert_eq!(
            due_notices(&with_mood, TODAY, 5, 21 * 60)[0].body,
            "Задач выполнено: 1 · привычек: 1 из 2"
        );
    }

    #[test]
    fn broken_or_missing_data_never_panics() {
        let s = Snapshot::from_json(
            Some("не json"),
            Some("{}"),
            None,
            Some(r#"{"notifications":{"enabled":true,"dayStart":"25:99","repeatEnabled":true,"repeatTime":"abc"}}"#),
        );
        assert!(s.settings.enabled);
        assert_eq!(s.settings.day_start, 9 * 60, "битое время — значение по умолчанию");
        assert_eq!(s.settings.repeat_at, Some(18 * 60));
        assert!(due_notices(&s, TODAY, 5, 12 * 60).is_empty());
        assert_eq!(parse_settings(Some("[]")), Settings::default());
    }

    #[test]
    fn russian_plurals() {
        assert_eq!(tasks_word(1), "1 задача");
        assert_eq!(tasks_word(3), "3 задачи");
        assert_eq!(tasks_word(5), "5 задач");
        assert_eq!(tasks_word(11), "11 задач");
        assert_eq!(tasks_word(22), "22 задачи");
    }
}
