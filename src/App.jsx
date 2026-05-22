import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const TRASH_EXPIRE = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_FOLDERS = ["すべて", "基本", "仕事", "勉強", "生活"];

const AISIN_HOLIDAYS = new Set([
  "2026-04-04","2026-04-05","2026-04-11","2026-04-12","2026-04-18","2026-04-19","2026-04-25","2026-04-26","2026-04-29","2026-04-30",
  "2026-05-01","2026-05-02","2026-05-03","2026-05-04","2026-05-05","2026-05-09","2026-05-10","2026-05-16","2026-05-17","2026-05-23","2026-05-24","2026-05-30","2026-05-31",
  "2026-06-06","2026-06-07","2026-06-13","2026-06-14","2026-06-20","2026-06-21","2026-06-27","2026-06-28",
  "2026-07-04","2026-07-05","2026-07-11","2026-07-12","2026-07-18","2026-07-19","2026-07-25","2026-07-26",
  "2026-08-01","2026-08-02","2026-08-08","2026-08-09","2026-08-10","2026-08-11","2026-08-12","2026-08-13","2026-08-14","2026-08-15","2026-08-16","2026-08-22","2026-08-23","2026-08-29","2026-08-30",
  "2026-09-05","2026-09-06","2026-09-12","2026-09-13","2026-09-19","2026-09-20","2026-09-26","2026-09-27",
  "2026-10-03","2026-10-04","2026-10-10","2026-10-11","2026-10-17","2026-10-18","2026-10-24","2026-10-25","2026-10-31",
  "2026-11-01","2026-11-07","2026-11-08","2026-11-14","2026-11-15","2026-11-21","2026-11-22","2026-11-28","2026-11-29",
  "2026-12-05","2026-12-06","2026-12-12","2026-12-13","2026-12-19","2026-12-20","2026-12-26","2026-12-27","2026-12-28","2026-12-29","2026-12-30","2026-12-31",
  "2027-01-01","2027-01-02","2027-01-03","2027-01-04","2027-01-05","2027-01-09","2027-01-10","2027-01-16","2027-01-17","2027-01-23","2027-01-24","2027-01-30","2027-01-31",
  "2027-02-06","2027-02-07","2027-02-13","2027-02-14","2027-02-20","2027-02-21","2027-02-27","2027-02-28",
  "2027-03-06","2027-03-07","2027-03-13","2027-03-14","2027-03-20","2027-03-21","2027-03-27","2027-03-28"
]);

const CALENDAR_MONTHS = [
  [2026, 4], [2026, 5], [2026, 6], [2026, 7],
  [2026, 8], [2026, 9], [2026, 10], [2026, 11],
  [2026, 12], [2027, 1], [2027, 2], [2027, 3],
];

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeTask(task) {
  return {
    id: task.id || Date.now(),
    text: task.text || "",
    deadline: task.deadline || "",
    priority: task.priority || "medium",
    category: task.category || "仕事",
    status: task.status || (task.done ? "完了" : "未着手"),
    favorite: Boolean(task.favorite),
    note: task.note || "",
    folder: task.folder || "基本",
  };
}

function classifyTask(text) {
  const value = text.toLowerCase();

  let category = "仕事";
  let folder = "仕事";
  let priority = "medium";
  let status = "未着手";

  if (/勉強|学習|試験|資格|英語|読書|課題|復習|予習|講座|研修/.test(value)) {
    category = "勉強";
    folder = "勉強";
  } else if (/買い物|掃除|洗濯|料理|病院|家賃|生活|家事|支払|予約/.test(value)) {
    category = "生活";
    folder = "生活";
  }

  if (/至急|緊急|今日|本日|重要|最優先|急ぎ|締切/.test(value)) {
    priority = "high";
  } else if (/余裕|あとで|低|軽め|時間があれば/.test(value)) {
    priority = "low";
  }

  if (/対応中|作業中|進行中|着手中/.test(value)) {
    status = "進行中";
  } else if (/保留|待ち|確認待ち|返信待ち/.test(value)) {
    status = "保留";
  } else if (/完了|済み|終了/.test(value)) {
    status = "完了";
  }

  return { category, folder, priority, status };
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [trash, setTrash] = useState([]);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [selectedFolder, setSelectedFolder] = useState("すべて");
  const [newFolder, setNewFolder] = useState("");

  const [view, setView] = useState("tasks");

  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("仕事");
  const [status, setStatus] = useState("未着手");
  const [folder, setFolder] = useState("基本");

  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [openedMemo, setOpenedMemo] = useState(null);

  const [backgroundImage, setBackgroundImage] = useState(
    localStorage.getItem("backgroundImage") || ""
  );

  const [dragReadyId, setDragReadyId] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const savedTasks = JSON.parse(localStorage.getItem("tasks") || "[]").map(normalizeTask);
    const savedTrash = JSON.parse(localStorage.getItem("trash") || "[]");

    const now = Date.now();
    const validTrash = savedTrash
      .filter((t) => now - (t.deletedAt || now) < TRASH_EXPIRE)
      .map((t) => ({ ...normalizeTask(t), deletedAt: t.deletedAt }));

    const savedFolders = JSON.parse(localStorage.getItem("folders") || "null");

    setTasks(savedTasks);
    setTrash(validTrash);
    setFolders(savedFolders || DEFAULT_FOLDERS);
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("trash", JSON.stringify(trash));
  }, [trash]);

  useEffect(() => {
    localStorage.setItem("folders", JSON.stringify(folders));
  }, [folders]);

  const uploadBg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result;
      setBackgroundImage(img);
      localStorage.setItem("backgroundImage", img);
    };
    reader.readAsDataURL(file);
  };

  const resetBg = () => {
    setBackgroundImage("");
    localStorage.removeItem("backgroundImage");
  };

  const applyAiClassification = () => {
    if (!text.trim()) return;
    const result = classifyTask(text);
    setCategory(result.category);
    setPriority(result.priority);
    setStatus(result.status);
    setFolder(result.folder);
  };

  const addTask = () => {
    if (!text.trim()) return;

    const ai = classifyTask(text);
    const finalCategory = category || ai.category;
    const finalPriority = priority || ai.priority;
    const finalStatus = status || ai.status;
    const finalFolder = folder || ai.folder;

    setTasks([
      {
        id: Date.now(),
        text,
        deadline,
        priority: finalPriority,
        category: finalCategory,
        status: finalStatus,
        favorite: false,
        note: "",
        folder: finalFolder,
      },
      ...tasks,
    ]);

    setText("");
    setDeadline("");
    setPriority("medium");
    setCategory("仕事");
    setStatus("未着手");
    setFolder("基本");
  };

  const addFolder = () => {
    const name = newFolder.trim();
    if (!name) return;
    if (folders.includes(name)) {
      setNewFolder("");
      return;
    }
    setFolders([...folders, name]);
    setNewFolder("");
  };

  const deleteFolder = (name) => {
    if (name === "すべて" || name === "基本") return;
    setTasks(tasks.map((t) => (t.folder === name ? { ...t, folder: "基本" } : t)));
    setFolders(folders.filter((f) => f !== name));
    if (selectedFolder === name) setSelectedFolder("すべて");
  };

  const moveToTrash = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    setTrash([{ ...task, deletedAt: Date.now() }, ...trash]);
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const restoreTask = (id) => {
    const task = trash.find((t) => t.id === id);
    if (!task) return;

    const { deletedAt, ...restored } = task;
    setTasks([restored, ...tasks]);
    setTrash(trash.filter((t) => t.id !== id));
  };

  const startPress = (id) => {
    timerRef.current = setTimeout(() => {
      setDragReadyId(id);
      navigator.vibrate?.(50);
    }, 1500);
  };

  const stopPress = () => {
    clearTimeout(timerRef.current);
  };

  const updateTask = (id, patch) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let result = tasks.filter((t) => {
      const target = `${t.text} ${t.note || ""} ${t.category} ${t.status} ${t.folder}`.toLowerCase();
      return target.includes(keyword);
    });

    if (view === "favorite") {
      result = result.filter((t) => t.favorite);
    }

    if (selectedFolder !== "すべて") {
      result = result.filter((t) => t.folder === selectedFolder);
    }

    return result;
  }, [tasks, search, view, selectedFolder]);

  const stats = {
    total: tasks.length,
    complete: tasks.filter((t) => t.status === "完了").length,
    progress: tasks.filter((t) => t.status === "進行中").length,
    hold: tasks.filter((t) => t.status === "保留").length,
    todo: tasks.filter((t) => t.status === "未着手").length,
  };

  const calendarTaskMap = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!task.deadline) return;
      if (!map[task.deadline]) map[task.deadline] = [];
      map[task.deadline].push(task);
    });
    return map;
  }, [tasks]);

  return (
    <div
      className={dark ? "app dark" : "app"}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
      }}
    >
      <aside className="sidebar">
        <h2>📋 タスクバー</h2>

        <div className={view === "tasks" ? "menu active" : "menu"} onClick={() => setView("tasks")}>
          📋 タスク
        </div>

        <div className={view === "favorite" ? "menu active" : "menu"} onClick={() => setView("favorite")}>
          ⭐ お気に入り
        </div>

        <div className={view === "dashboard" ? "menu active" : "menu"} onClick={() => setView("dashboard")}>
          📊 ダッシュボード
        </div>

        <div className={view === "calendar" ? "menu active" : "menu"} onClick={() => setView("calendar")}>
          📅 Aisinカレンダー
        </div>

        <div className={view === "trash" ? "menu active" : "menu"} onClick={() => setView("trash")}>
          🗑 ゴミ箱 ({trash.length})
        </div>

        <div
          className="trashDropMini"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = Number(e.dataTransfer.getData("taskId"));
            moveToTrash(id);
            setDragReadyId(null);
          }}
        >
          🗑 ドロップ削除
        </div>

        <div className="sideBlock">
          <p>📂 フォルダ</p>

          {folders.map((f) => (
            <div
              key={f}
              className={selectedFolder === f ? "folder active" : "folder"}
              onClick={() => setSelectedFolder(f)}
            >
              <span>{f}</span>
              {f !== "すべて" && f !== "基本" && (
                <button
                  className="miniDanger"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(f);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div className="folderAdd">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="新規フォルダ"
            />
            <button onClick={addFolder}>追加</button>
          </div>
        </div>

        <div className="sideBlock">
          <p>🖼 背景変更</p>
          <input type="file" accept="image/*" onChange={uploadBg} />
          <button onClick={resetBg}>背景リセット</button>
        </div>
      </aside>

      <main className="container">
        <div className="header">
          <h1>📋 業務管理アプリ v6.0</h1>

          <button onClick={() => setDark(!dark)}>{dark ? "☀️" : "🌙"}</button>
        </div>

        <input
          className="search"
          placeholder="検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {view !== "trash" && view !== "dashboard" && view !== "calendar" && (
          <div className="input-area">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="タスク入力"
            />

            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />

            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>

            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>仕事</option>
              <option>勉強</option>
              <option>生活</option>
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>未着手</option>
              <option>進行中</option>
              <option>保留</option>
              <option>完了</option>
            </select>

            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              {folders.filter((f) => f !== "すべて").map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>

            <button onClick={applyAiClassification}>AI分類</button>
            <button onClick={addTask}>追加</button>
          </div>
        )}

        {view === "dashboard" && (
          <div className="dashboard">
            <div className="dashCard">総数 {stats.total}</div>
            <div className="dashCard">完了 {stats.complete}</div>
            <div className="dashCard">進行中 {stats.progress}</div>
            <div className="dashCard">未着手 {stats.todo}</div>
            <div className="dashCard">保留 {stats.hold}</div>
          </div>
        )}

        {view === "calendar" && (
          <div className="calendarView">
            <div className="calendarNote">
              Aisin 2026年度会社カレンダーをもとに、会社休日を緑色で表示しています。
            </div>

            <div className="calendarGrid">
              {CALENDAR_MONTHS.map(([year, month]) => {
                const first = new Date(year, month - 1, 1);
                const lastDay = new Date(year, month, 0).getDate();
                const startBlank = (first.getDay() + 6) % 7;
                const cells = [];

                for (let i = 0; i < startBlank; i++) {
                  cells.push(<div key={`b-${i}`} className="day blank" />);
                }

                for (let day = 1; day <= lastDay; day++) {
                  const key = toDateKey(year, month, day);
                  const isHoliday = AISIN_HOLIDAYS.has(key);
                  const dayTasks = calendarTaskMap[key] || [];

                  cells.push(
                    <div key={key} className={isHoliday ? "day holiday" : "day"}>
                      <strong>{day}</strong>
                      {dayTasks.length > 0 && (
                        <span className="taskDot">{dayTasks.length}</span>
                      )}
                    </div>
                  );
                }

                return (
                  <section className="monthCard" key={`${year}-${month}`}>
                    <h3>{year}年 {month}月</h3>
                    <div className="weekHeader">
                      <span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span>
                    </div>
                    <div className="days">{cells}</div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {(view === "tasks" || view === "favorite") &&
          filtered.map((task) => (
            <div
              key={task.id}
              className={`card ${task.priority}`}
              draggable={dragReadyId === task.id}
              onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
              onDragEnd={() => setDragReadyId(null)}
              onMouseDown={() => startPress(task.id)}
              onMouseUp={stopPress}
              onTouchStart={() => startPress(task.id)}
              onTouchEnd={stopPress}
            >
              {editingId === task.id ? (
                <div className="editRow">
                  <input value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                  <button
                    onClick={() => {
                      updateTask(task.id, { text: editingText });
                      setEditingId(null);
                    }}
                  >
                    保存
                  </button>
                </div>
              ) : (
                <h3>
                  {task.favorite ? "⭐ " : ""}
                  {task.text}
                </h3>
              )}

              <div className="meta">
                <span>📁 {task.category}</span>
                <span>📊 {task.status}</span>
                <span>📂 {task.folder}</span>
                <span>⚡ {task.priority}</span>
                {task.deadline && <span>📅 {task.deadline}</span>}
              </div>

              <div className="cardControls">
                <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })}>
                  <option>未着手</option>
                  <option>進行中</option>
                  <option>保留</option>
                  <option>完了</option>
                </select>

                <select value={task.folder} onChange={(e) => updateTask(task.id, { folder: e.target.value })}>
                  {folders.filter((f) => f !== "すべて").map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="actions">
                <button onClick={() => updateTask(task.id, { favorite: !task.favorite })}>⭐</button>

                <button
                  onClick={() => {
                    setEditingId(task.id);
                    setEditingText(task.text);
                  }}
                >
                  編集
                </button>

                <button onClick={() => setOpenedMemo(openedMemo === task.id ? null : task.id)}>
                  📝
                </button>
              </div>

              {openedMemo === task.id && (
                <textarea
                  value={task.note}
                  onChange={(e) => updateTask(task.id, { note: e.target.value })}
                  placeholder="メモを入力..."
                />
              )}
            </div>
          ))}

        {view === "trash" && (
          <>
            <div
              className="trashZone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = Number(e.dataTransfer.getData("taskId"));
                moveToTrash(id);
                setDragReadyId(null);
              }}
            >
              🗑 ここへドロップして削除
            </div>

            {trash.length === 0 && <p className="empty">ゴミ箱は空です。</p>}

            {trash.map((t) => (
              <div className="card" key={t.id}>
                <h3>{t.text}</h3>
                <div className="meta">
                  <span>30日後に自動削除</span>
                </div>

                <button onClick={() => restoreTask(t.id)}>復元</button>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
