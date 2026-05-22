import { useEffect, useState } from "react";
import "./index.css";

import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

// Firebase
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");

  const [filter, setFilter] = useState("all");

  // フォルダ
  const [folders] = useState(["仕事", "勉強", "生活"]);
  const [folder, setFolder] = useState("仕事");

  // ゴミ箱
  const [deletedFolders, setDeletedFolders] = useState([]);

  // ユーザー
  const [user, setUser] = useState(null);

  // -------------------------
  // PWA Service Worker
  // -------------------------
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // -------------------------
  // ログイン
  // -------------------------
  const login = async () => {
    const result = await signInWithPopup(auth, provider);
    setUser(result.user);
    loadTasks(result.user.uid);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setTasks([]);
  };

  // -------------------------
  // Firestore 読み込み
  // -------------------------
  const loadTasks = async (uid) => {
    const q = query(
      collection(db, "tasks"),
      where("uid", "==", uid)
    );

    const snapshot = await getDocs(q);

    setTasks(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  };

  // -------------------------
  // タスク追加（クラウド保存）
  // -------------------------
  const addTask = async () => {
    if (!input.trim()) return;
    if (!user) return alert("ログインしてください");

    const newTask = {
      text: input,
      done: false,
      deadline: deadline || null,
      priority,
      folder,
      uid: user.uid,
    };

    await addDoc(collection(db, "tasks"), newTask);

    loadTasks(user.uid);

    setInput("");
    setDeadline("");
    setPriority("medium");
  };

  // -------------------------
  // フォルダ件数
  // -------------------------
  const getFolderCount = (folderName) =>
    tasks.filter((t) => t.folder === folderName).length;

  // -------------------------
  // フォルダ削除
  // -------------------------
  const deleteFolder = (folderName) => {
    const ok = confirm(`${folderName} を削除しますか？`);
    if (!ok) return;

    setDeletedFolders((prev) => [...prev, folderName]);

    setTasks((prev) =>
      prev.map((t) =>
        t.folder === folderName ? { ...t, folder: "仕事" } : t
      )
    );

    if (folder === folderName) setFolder("仕事");
  };

  // -------------------------
  // フォルダ復元
  // -------------------------
  const restoreFolder = (folderName) => {
    setDeletedFolders((prev) =>
      prev.filter((f) => f !== folderName)
    );
  };

  // -------------------------
  // フィルター
  // -------------------------
  const filteredTasks = tasks.filter((task) => {
    if (task.folder !== folder) return false;
    if (filter === "active") return !task.done;
    if (filter === "done") return task.done;
    return true;
  });

  // -------------------------
  // DnD
  // -------------------------
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(filteredTasks);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const updated = tasks.map((t) => {
      const found = items.find((i) => i.id === t.id);
      return found ? found : t;
    });

    setTasks(updated);
  };

  // -------------------------
  // 完了切替
  // -------------------------
  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      )
    );
  };

  return (
    <div className="app">

      {/* ログインバー */}
      <div style={{ padding: 10 }}>
        {!user ? (
          <button onClick={login}>Googleログイン</button>
        ) : (
          <>
            <span style={{ marginRight: 10 }}>
              👤 {user.displayName}
            </span>
            <button onClick={logout}>ログアウト</button>
          </>
        )}
      </div>

      {/* ゴミ箱 */}
      <div className="trash">
        <h4>🗑 ゴミ箱</h4>

        {deletedFolders.length === 0 && (
          <p>空です</p>
        )}

        {deletedFolders.map((f) => (
          <div key={f}>
            <span>{f}</span>
            <button onClick={() => restoreFolder(f)}>
              復元
            </button>
          </div>
        ))}
      </div>

      {/* サイドバー */}
      <div className="sidebar">
        <h3>📁 Folders</h3>

        {folders.map((f) => (
          <div
            key={f}
            onClick={() => setFolder(f)}
            style={{
              padding: 8,
              cursor: "pointer",
              background: folder === f ? "#eee" : "transparent",
            }}
          >
            {f} ({getFolderCount(f)})
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFolder(f);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* メイン */}
      <div className="container">
        <h1>業務管理アプリ</h1>

        {/* タブ */}
        <div>
          <button onClick={() => setFilter("all")}>全て</button>
          <button onClick={() => setFilter("active")}>未完了</button>
          <button onClick={() => setFilter("done")}>完了</button>
        </div>

        {/* 入力 */}
        <div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="タスク"
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
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>

          <button onClick={addTask}>追加</button>
        </div>

        {/* DnD */}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="tasks">
            {(provided) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {filteredTasks.map((task, index) => (
                  <Draggable
                    key={task.id}
                    draggableId={String(task.id)}
                    index={index}
                  >
                    {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={() => toggleTask(task.id)}
                      >
                        {task.done ? "✔" : "⏳"} {task.text}
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}