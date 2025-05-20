import { useEffect, useState, useRef } from "react";

const API_URL = "https://momostreet-backend.onrender.com";

type Order = {
  id: number;
  items: string;
  name: string;
  phone: string;
  created_at: string;
};

type MenuItem = {
  id: number;
  name: string;
  extras?: string;
  price: number | null;
  sizes?: { size: string; price: number }[];
  image?: string;
  extraOptions?: { name: string; price: number }[];
  pizzaSubcategory?: string;
  category?: string;
};

type Tab = "orders" | "menu" | "history";

// Helper: Convert UTC to IST and format as dd/mm/yyyy HH:MM:SS
function formatIST(utcString: string) {
  if (!utcString) return "";
  try {
    // Parse as UTC (with or without Z)
    let utcDate = utcString.endsWith("Z") ? new Date(utcString) : new Date(utcString + "Z");
    // Convert to IST (UTC+5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffsetMs);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
      pad(istDate.getDate()) +
      "/" +
      pad(istDate.getMonth() + 1) +
      "/" +
      istDate.getFullYear() +
      " " +
      pad(istDate.getHours()) +
      ":" +
      pad(istDate.getMinutes()) +
      ":" +
      pad(istDate.getSeconds())
    );
  } catch {
    return utcString;
  }
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [newOrder, setNewOrder] = useState(false);
  const prevOrderCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // --- Unlock audio on user interaction ---
  const enableSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 1;
      // Try to play a short sound to unlock audio context
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setSoundEnabled(true);
      }).catch(() => {
        setSoundEnabled(true);
      });
    } else {
      setSoundEnabled(true);
    }
  };

  // Menu management state
  const [newItem, setNewItem] = useState<MenuItem>({ name: "", extras: "", price: "", image: "", category: "" } as any);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // Compute unique categories from menu
  const categories = Array.from(new Set(menu.map(i => i.category).filter(Boolean)));

  // --- Fetch orders (polling for notification) ---
  useEffect(() => {
    if (tab !== "orders") return;
    const fetchOrders = () => {
      fetch(`${API_URL}/admin/orders`)
        .then(res => res.json())
        .then(data => {
          setOrders(data);
          if (prevOrderCount.current !== 0 && data.length > prevOrderCount.current) {
            setNewOrder(true);
            // Play notification sound only if enabled
            if (soundEnabled && audioRef.current) {
              // Required for some browsers: pause, reset, then play
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.volume = 1;
              // Try to play, but ignore errors (browser may block if not user-initiated)
              audioRef.current.play().catch(() => {});
            }
          }
          prevOrderCount.current = data.length;
        });
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [tab, soundEnabled]);

  // --- Fetch menu (flat) ---
  useEffect(() => {
    if (tab !== "menu") return;
    fetch(`${API_URL}/admin/export-menu`)
      .then(res => res.json())
      .then(data => {
        setMenu(data);
      });
  }, [tab]);

  // --- Fetch order history ---
  useEffect(() => {
    if (tab !== "history") return;
    fetch(`${API_URL}/admin/history`)
      .then(res => res.json())
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [tab]);

  const clearOrders = () => {
    fetch(`${API_URL}/admin/clear`, { method: "POST" }).then(() => setOrders([]));
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/admin/upload-image`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.url) {
      setNewItem(item => ({ ...item, image: data.url }));
    }
  };

  // Menu management handlers
  const handleAddMenuItem = () => {
    if (!newItem.name || (!newItem.price && !newItem.sizes) || !newItem.category) return;
    const id = menu.length ? Math.max(...menu.map(i => i.id)) + 1 : 1;
    const itemToAdd = { ...newItem, id };
    // Insert at the top of the selected category
    let inserted = false;
    const updatedMenu = [];
    for (let i = 0; i < menu.length; ++i) {
      if (!inserted && menu[i].category === newItem.category) {
        updatedMenu.push(itemToAdd);
        inserted = true;
      }
      updatedMenu.push(menu[i]);
    }
    // If category not found (shouldn't happen), just add at start
    if (!inserted) updatedMenu.unshift(itemToAdd);
    setMenu(updatedMenu);
    setNewItem({ name: "", extras: "", price: "", image: "", category: "" } as any);
  };

  const handleRemoveMenuItem = (id: number) => {
    setMenu(menu.filter(item => item.id !== id));
  };

  const handleEditMenuItem = (idx: number) => {
    setEditIdx(idx);
    setNewItem({ ...menu[idx] });
  };

  const handleSaveEdit = () => {
    if (editIdx === null) return;
    const updated = [...menu];
    updated[editIdx] = { ...newItem, id: updated[editIdx].id };
    setMenu(updated);
    setEditIdx(null);
    setNewItem({ name: "", extras: "", price: "", image: "", category: "" } as any);
  };

  const handleSaveMenu = () => {
    fetch(`${API_URL}/admin/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menu),
    })
      .then(() => {
        setSaveMsg("Menu updated!");
        setTimeout(() => setSaveMsg(""), 2000);
        // Reload menu after save
        fetch(`${API_URL}/admin/export-menu`)
          .then(res => res.json())
          .then(data => setMenu(data));
      });
  };

  // Notification clear
  const clearNotification = () => setNewOrder(false);

  // --- UI ---
  return (
    <div style={{
      maxWidth: 1000,
      margin: "auto",
      padding: 24,
      background: "#181818",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "Poppins, Arial, sans-serif"
    }}>
      {/* Notification sound */}
      <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa4c3b.mp3" preload="auto" />
      {/* Show enable sound button if not enabled */}
      {!soundEnabled && (
        <div style={{ textAlign: "center", margin: "1em 0" }}>
          <button
            className="admin-action-btn"
            style={{ background: "#ffd600", color: "#222", fontWeight: 700 }}
            onClick={enableSound}
          >
            Enable Notification Sound
          </button>
          <div style={{ color: "#bbb", fontSize: "0.95em", marginTop: 4 }}>
            Click to allow sound for new orders
          </div>
        </div>
      )}
      <h1 style={{ textAlign: "center", fontSize: "2.6rem", fontWeight: 800, marginBottom: 0 }}>
        Admin Dashboard
      </h1>
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 24,
        margin: "2.5rem 0 2rem 0"
      }}>
        <button
          className={`admin-tab-btn${tab === "orders" ? " active" : ""}`}
          onClick={() => setTab("orders")}
        >
          Orders
          {newOrder && <span className="notif-dot" />}
        </button>
        <button
          className={`admin-tab-btn${tab === "menu" ? " active" : ""}`}
          onClick={() => setTab("menu")}
        >
          Edit Menu
        </button>
        <button
          className={`admin-tab-btn${tab === "history" ? " active" : ""}`}
          onClick={() => setTab("history")}
        >
          Order History
        </button>
      </div>

      {/* --- ORDERS PAGE --- */}
      {tab === "orders" && (
        <div>
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "2rem" }}>
            Current Orders
            <button
              style={{
                background: "none",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                marginLeft: 12,
                color: "#ffd600",
                verticalAlign: "middle"
              }}
              title="Notifications"
              onClick={clearNotification}
            >
              🔔
              {newOrder && (
                <span className="notif-dot" />
              )}
            </button>
          </h2>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button
              onClick={clearOrders}
              style={{
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.7em 2em",
                fontWeight: 700,
                fontSize: "1.1em",
                cursor: "pointer",
                marginTop: 8
              }}
            >
              Clear All Orders
            </button>
          </div>
          <div style={{ maxWidth: 700, margin: "auto" }}>
            {orders.length === 0 && (
              <div style={{ color: "#bbb", textAlign: "center", margin: "2em 0" }}>No current orders.</div>
            )}
            {orders.map(order => (
              <div key={order.id} className="admin-card">
                <div style={{ fontWeight: 700, fontSize: "1.1em" }}>
                  {order.name} <span style={{ color: "#aaa" }}>({order.phone})</span>
                </div>
                <div style={{ margin: "0.5em 0" }}>{order.items}</div>
                <div style={{ fontSize: "0.95em", color: "#aaa" }}>{formatIST(order.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MENU EDIT PAGE --- */}
      {tab === "menu" && (
        <div>
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "2rem" }}>Menu Management</h2>
          {saveMsg && <div style={{ color: "#4caf50", textAlign: "center", marginBottom: 8 }}>{saveMsg}</div>}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap"
          }}>
            {/* Category dropdown for new item */}
            <select
              value={newItem.category || ""}
              onChange={e => setNewItem({ ...newItem, category: e.target.value })}
              style={{ marginRight: 8, padding: "0.5em", borderRadius: 6, border: "1px solid #888", minWidth: 120 }}
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              placeholder="Name"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              style={{ marginRight: 8, padding: "0.5em", borderRadius: 6, border: "1px solid #888", minWidth: 120 }}
            />
            <input
              placeholder="Extras"
              value={newItem.extras}
              onChange={e => setNewItem({ ...newItem, extras: e.target.value })}
              style={{ marginRight: 8, padding: "0.5em", borderRadius: 6, border: "1px solid #888", minWidth: 120 }}
            />
            <input
              placeholder="Price"
              type="number"
              value={newItem.price?.toString() || ""}
              onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
              style={{ marginRight: 8, width: 90, padding: "0.5em", borderRadius: 6, border: "1px solid #888" }}
            />
            {/* Image upload */}
            <input
              type="file"
              accept="image/*"
              style={{ marginRight: 8 }}
              onChange={handleImageUpload}
            />
            {newItem.image && (
              <img src={newItem.image} alt="preview" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #888", marginRight: 8 }} />
            )}
            {editIdx === null ? (
              <button className="admin-action-btn" onClick={handleAddMenuItem}>Add Item</button>
            ) : (
              <button className="admin-action-btn" onClick={handleSaveEdit}>Save Edit</button>
            )}
            <button className="admin-action-btn" onClick={handleSaveMenu} style={{ marginLeft: 8 }}>Save Menu</button>
            <button className="admin-action-btn" onClick={() => {
              fetch(`${API_URL}/admin/export-menu`)
                .then(res => res.json())
                .then(data => setMenu(data));
            }}>Reload Menu</button>
          </div>
          <div style={{
            overflowX: "auto",
            background: "#222",
            borderRadius: 12,
            padding: "1em",
            maxHeight: 400,
            boxShadow: "0 2px 16px rgba(0,0,0,0.13)"
          }}>
            <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#181818", color: "#fff" }}>
                  <th style={{ padding: "0.7em" }}>Name</th>
                  <th style={{ padding: "0.7em" }}>Extras</th>
                  <th style={{ padding: "0.7em" }}>Price</th>
                  <th style={{ padding: "0.7em" }}>Sizes</th>
                  <th style={{ padding: "0.7em" }}>Image</th>
                  <th style={{ padding: "0.7em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((item, idx) => (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? "#232323" : "#292929" }}>
                    <td style={{ padding: "0.7em" }}>{item.name}</td>
                    <td style={{ padding: "0.7em" }}>{item.extras}</td>
                    <td style={{ padding: "0.7em" }}>{item.price !== null && item.price !== undefined ? `₹${item.price}` : ""}</td>
                    <td style={{ padding: "0.7em" }}>
                      {item.sizes && item.sizes.length > 0
                        ? item.sizes.map(s => `${s.size}: ₹${s.price}`).join(", ")
                        : ""}
                    </td>
                    <td style={{ padding: "0.7em" }}>
                      {item.image && <img src={item.image} alt="img" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #888" }} />}
                    </td>
                    <td style={{ padding: "0.7em" }}>
                      <button className="admin-action-btn" onClick={() => handleEditMenuItem(idx)}>Edit</button>
                      <button className="admin-action-btn" onClick={() => handleRemoveMenuItem(item.id)} style={{ marginLeft: 8, background: "#d32f2f" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ORDER HISTORY PAGE --- */}
      {tab === "history" && (
        <div>
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "2rem" }}>Order History</h2>
          <div style={{ maxWidth: 700, margin: "auto" }}>
            {history.length === 0 && (
              <div style={{ color: "#bbb", textAlign: "center", margin: "2em 0" }}>No previous orders.</div>
            )}
            {history.map(order => (
              <div key={order.id} className="admin-card">
                <div style={{ fontWeight: 700, fontSize: "1.1em" }}>
                  {order.name} <span style={{ color: "#aaa" }}>({order.phone})</span>
                </div>
                <div style={{ margin: "0.5em 0" }}>{order.items}</div>
                <div style={{ fontSize: "0.95em", color: "#aaa" }}>{formatIST(order.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Styles for admin dashboard --- */}
      <style>{`
        .admin-tab-btn {
          background: #232323;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 0.7em 2.2em;
          font-size: 1.1em;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .admin-tab-btn.active, .admin-tab-btn:hover {
          background: #fff;
          color: #8b0000;
        }
        .admin-action-btn {
          background: #333;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.5em 1.2em;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .admin-action-btn:hover {
          background: #8b0000;
          color: #fff;
        }
        .notif-dot {
          display: inline-block;
          width: 13px;
          height: 13px;
          background: #d32f2f;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          right: -8px;
          border: 2px solid #181818;
        }
        .admin-card {
          background: #232323;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10);
          padding: 1.2em 1.5em;
          margin-bottom: 1.2em;
        }
      `}</style>
    </div>
  );
}
