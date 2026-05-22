import { useEffect, useState } from "react";
import "./index.css";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("all");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("tasks");
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!text.trim()) return;
    setTasks([
      {
        id: Date.now(),
        text,
        deadline,
        priority,
        done: false,
      },
      ...tasks,
    ]);
    setText("");
    setDeadline("");
    setPriority("medium");
  };

  const removeTask = (id) =>
    setTasks(tasks.filter((t) => t.id !== id));

  const toggleTask = (id) =>
    setTasks(tasks.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    ));

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  return (
    <div className={dark ? "app dark" : "app"}>
      <div className="container">
        <div className="header">
          <h1>📋 業務管理アプリ</h1>
          <button onClick={() => setDark(!dark)}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>

        <div className="input-area">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="タスクを入力"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <button onClick={addTask}>追加</button>
        </div>

        <div className="tabs">
          <button onClick={() => setFilter("all")}>全て</button>
          <button onClick={() => setFilter("active")}>未完了</button>
          <button onClick={() => setFilter("done")}>完了</button>
        </div>

        <ul>
          {filtered.map((task) => (
            <li
              key={task.id}
              className={`${task.priority} ${task.done ? "done" : ""}`}
            >
              <div className="row">
                <span onClick={() => toggleTask(task.id)}>
                  {task.done ? "✔" : "⏳"} {task.text}
                </span>
                <button onClick={() => removeTask(task.id)}>削除</button>
              </div>

              <div className="meta">
                <span>優先度: {task.priority}</span>
                {task.deadline && <span>期限: {task.deadline}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
