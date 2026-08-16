(function (global) {
  "use strict";

  const DB_NAME = "xhs-studio";
  const DB_VERSION = 1;
  const STORE = "projects";
  const SCHEMA_VERSION = 1;

  let dbPromise = null;
  let saveTimer = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB 不可用"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
    });
    return dbPromise;
  }

  async function putProject(snapshot) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put({ ...snapshot, schemaVersion: SCHEMA_VERSION });
    });
  }

  async function getProject(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function listProjects(limit) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("updatedAt").openCursor(null, "prev");
      const out = [];
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur || out.length >= (limit || 20)) {
          resolve(out);
          return;
        }
        out.push(cur.value);
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteProject(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(id);
    });
  }

  function scheduleSave(getSnapshot, debounceMs) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        const snap = getSnapshot();
        if (!snap || !snap.id) return;
        snap.updatedAt = Date.now();
        await putProject(snap);
        if (typeof snap.onSaved === "function") snap.onSaved();
      } catch {
        /* best-effort */
      }
    }, debounceMs || 800);
  }

  async function flushSave(getSnapshot) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const snap = getSnapshot();
    if (!snap || !snap.id) return;
    snap.updatedAt = Date.now();
    await putProject(snap);
  }

  global.XHSProjectStore = {
    openDb,
    putProject,
    getProject,
    listProjects,
    deleteProject,
    scheduleSave,
    flushSave,
    SCHEMA_VERSION,
  };
})(typeof window !== "undefined" ? window : globalThis);
