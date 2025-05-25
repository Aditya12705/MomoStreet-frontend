import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ohtooqhepmqtkpijszvp.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odG9vcWhlcG1xdGtwaWpzenZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNTgwNDUsImV4cCI6MjA2MzczNDA0NX0.4aQkLyQDfiWyoSzt4NnfossxGWoBhu8rgFTiW1fFXD0";
const supabase = createClient(supabaseUrl, supabaseKey);

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

const formatIST = (utcString: string) => {
  try {
    const date = new Date(utcString.endsWith("Z") ? utcString : utcString + "Z");
    date.setHours(date.getHours() + 5, date.getMinutes() + 30);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return utcString;
  }
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [newItem, setNewItem] = useState<MenuItem>({
    id: 0,
    name: "",
    extras: "",
    price: null,
    image: "",
    category: "",
  });
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [newOrder, setNewOrder] = useState(false);
  const prevOrderCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const categories = Array.from(
    new Set(menu.map((item) => item.category).filter(Boolean))
  );

  const API_URL = "https://momostreet-backend.onrender.com";

  useEffect(() => {
    if (tab !== "orders") return;

    const fetchOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/orders`);
        const data = await response.json();
        setOrders(data);
        if (prevOrderCount.current !== 0 && data.length > prevOrderCount.current) {
          setNewOrder(true);
          if (soundEnabled && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 1;
            audioRef.current.play().catch(() => {});
          }
        }
        prevOrderCount.current = data.length;
      } catch (err) {
        console.error("Failed to fetch orders", err);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [tab, soundEnabled]);

  useEffect(() => {
    if (tab !== "menu") return;
    supabase
      .from("menu")
      .select("*")
      .then(({ data }) => {
        if (data) setMenu(data);
      });
  }, [tab]);

  useEffect(() => {
    if (tab !== "history") return;
    fetch(`${API_URL}/admin/history`)
      .then((res) => res.json())
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [tab]);

  const handleAddMenuItem = async () => {
    if (!newItem.name || (!newItem.price && !newItem.sizes) || !newItem.category) return;
    const { error } = await supabase.from("menu").insert([newItem]);
    if (!error) {
      const { data } = await supabase.from("menu").select("*");
      if (data) setMenu(data);
      setNewItem({ id: 0, name: "", extras: "", price: null, image: "", category: "" });
    }
  };

  const handleRemoveMenuItem = async (id: number) => {
    await supabase.from("menu").delete().eq("id", id);
    const { data } = await supabase.from("menu").select("*");
    if (data) setMenu(data);
  };

  const handleEditMenuItem = (idx: number) => {
    setEditIdx(idx);
    setNewItem({ ...menu[idx] });
  };

  const handleSaveEdit = async () => {
    if (editIdx === null) return;
    const id = menu[editIdx].id;
    await supabase.from("menu").update(newItem).eq("id", id);
    const { data } = await supabase.from("menu").select("*");
    if (data) {
      setMenu(data);
      setEditIdx(null);
      setNewItem({ id: 0, name: "", extras: "", price: null, image: "", category: "" });
    }
  };

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "unsigned_preset");

    const res = await fetch("https://api.cloudinary.com/v1_1/dcoedheqt/image/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.secure_url;
  };

  const clearOrders = () => {
    fetch(`${API_URL}/admin/clear`, { method: "POST" }).then(() => setOrders([]));
  };


  const enableSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setSoundEnabled(true))
        .catch(() => setSoundEnabled(true));
    }
  };

  return (
    <div style={{ padding: "2em", background: "#181818", color: "#fff", fontFamily: "Poppins, sans-serif" }}>
      <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa4c3b.mp3" preload="auto" />
      {!soundEnabled && (
        <div style={{ textAlign: "center", margin: "1em 0" }}>
          <button onClick={enableSound} style={{ background: "#ffd600", color: "#000", padding: "0.5em 1em", borderRadius: 6 }}>
            Enable Notification Sound
          </button>
        </div>
      )}

      <h1 style={{ textAlign: "center", fontSize: "2.2rem", marginBottom: "1em" }}>Admin Dashboard</h1>

      <div style={{ textAlign: "center", marginBottom: "1em" }}>
        {["orders", "menu", "history"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as Tab)}
            style={{
              margin: "0 0.5em",
              padding: "0.5em 1.2em",
              borderRadius: 8,
              border: "none",
              background: tab === t ? "#fff" : "#333",
              color: tab === t ? "#000" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
            {t === "orders" && newOrder && " 🔔"}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <div>
          {orders.map((order) => (
            <div key={order.id} style={{ background: "#232323", padding: "1em", margin: "1em 0", borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>{order.name} ({order.phone})</div>
              <div>{order.items}</div>
              <div style={{ color: "#aaa", fontSize: "0.9em" }}>{formatIST(order.created_at)}</div>
            </div>
          ))}
          <button onClick={clearOrders} style={{ background: "#d32f2f", color: "#fff", padding: "0.6em 1.2em", borderRadius: 6 }}>
            Clear All Orders
          </button>
        </div>
      )}

      {tab === "menu" && (
        <div>
          <h3 style={{ textAlign: "center" }}>Menu Management</h3>
          <div style={{ marginBottom: "1em", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <select value={newItem.category || ""} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            <input placeholder="Extras" value={newItem.extras} onChange={(e) => setNewItem({ ...newItem, extras: e.target.value })} />
            <input placeholder="Price" type="number" value={newItem.price?.toString() || ""} onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })} />
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = await uploadToCloudinary(file);
                  setNewItem((item) => ({ ...item, image: url }));
                }
              }}
            />
            {editIdx === null ? (
              <button onClick={handleAddMenuItem}>Add</button>
            ) : (
              <button onClick={handleSaveEdit}>Save</button>
            )}
          </div>
          <table style={{ width: "100%", background: "#222", borderRadius: 12, padding: 16 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Extras</th>
                <th>Price</th>
                <th>Image</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {menu.map((item, idx) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.extras}</td>
                  <td>₹{item.price}</td>
                  <td>{item.image && <img src={item.image} alt="img" style={{ width: 48 }} />}</td>
                  <td>
                    <button onClick={() => handleEditMenuItem(idx)}>Edit</button>
                    <button onClick={() => handleRemoveMenuItem(item.id)} style={{ marginLeft: 8 }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div>
          <h3 style={{ textAlign: "center" }}>Order History</h3>
          {history.map((order) => (
            <div key={order.id} style={{ background: "#232323", padding: "1em", margin: "1em 0", borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>{order.name} ({order.phone})</div>
              <div>{order.items}</div>
              <div style={{ color: "#aaa", fontSize: "0.9em" }}>{formatIST(order.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}