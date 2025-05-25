import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";

const API_URL = "https://momostreet-backend.onrender.com";

type PizzaSizeOption = { size: string; price: number };
type ExtraOption = { name: string; price: number };
type MenuItem = {
  id: number;
  name: string;
  extras?: string;
  price?: number | null;
  image?: string;
  sizes?: PizzaSizeOption[]; // for pizza
  extraOptions?: ExtraOption[]; // new: available extras for this item
  pizzaSubcategory?: string; // optional: for pizza items
};
type PizzaSubGroup = {
  subcategory: string;
  items: MenuItem[];
};
type MenuGroup = {
  subcategory: string;
  items: MenuItem[] | PizzaSubGroup[];
};
type CartItem = MenuItem & { quantity: number; selectedSize?: PizzaSizeOption; selectedExtras?: ExtraOption[] };

// Improved: Check both name and extras for non-veg keywords, including omelette, seekh, kebab, and combos
function isNonVegItem(item: MenuItem) {
  const keywords = [
    "chicken", "egg", "drumstick", "wings", "non-veg", "chk", "fish", "mutton",
    "omelette", "omelet", "seekh", "kebab", "kebabs", "kabab", "kababs"
  ];
  const text = (item.name + " " + (item.extras || "")).toLowerCase();

  // Direct keyword match
  if (keywords.some(word => text.includes(word))) return true;

  // Special cases for rolls: if roll contains non-veg word
  if (/roll/.test(text)) {
    if (["chicken", "egg", "omelette", "seekh", "kebab", "mutton", "fish"].some(word => text.includes(word))) {
      return true;
    }
  }
  return false;
}
function isVegItem(item: MenuItem) {
  return !isNonVegItem(item);
}

// Helper type guard
function isPizzaSubGroupArray(items: unknown): items is PizzaSubGroup[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    typeof items[0] === "object" &&
    items[0] !== null &&
    "subcategory" in items[0] &&
    "items" in items[0]
  );
}

// Helper: parse extras from item.extras string (e.g. "(Add Cheese Rs 30)")
function parseExtraOptions(extras?: string): ExtraOption[] {
  if (!extras) return [];
  const options: ExtraOption[] = [];
  if (/cheese burst/i.test(extras)) {
    const match = extras.match(/Regular\s*-\s*Rs\.\s*(\d+)/i);
    const match2 = extras.match(/Medium\s*-\s*Rs\.\s*(\d+)/i);
    if (match) options.push({ name: "Cheese Burst (Regular)", price: parseInt(match[1]) });
    if (match2) options.push({ name: "Cheese Burst (Medium)", price: parseInt(match2[1]) });
  } else if (/add cheese/i.test(extras)) {
    const match = extras.match(/Add Cheese\s*Rs\s*(\d+)/i);
    if (match) options.push({ name: "Add Cheese", price: parseInt(match[1]) });
  }
  return options;
}

function MenuPage({
  menu,
  addToCart,
  removeFromCart,
  cart,
  filter,
  setFilter,
}: {
  menu: MenuGroup[];
  addToCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  removeFromCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  cart: CartItem[];
  filter: "all" | "veg" | "non-veg";
  setFilter: (f: "all" | "veg" | "non-veg") => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  // --- Normalize backend menu: treat all groups as MenuGroup, flatten pizza subgroups ---
  const normalizedMenu: MenuGroup[] = menu.map((group) => {
    // If backend sends {category:..., items:...}
    if (
      typeof group === "object" &&
      group !== null &&
      "category" in group &&
      !("subcategory" in group)
    ) {
      return {
        subcategory: (group as { category: string }).category,
        items: (group as { items: MenuItem[] | PizzaSubGroup[] }).items,
      };
    }
    return group;
  });

  // --- Filtering logic ---
  const filteredMenu = normalizedMenu
    .map((group) => {
      // If group is pizza and has subgroups, flatten all pizza items into one array for rendering
      if (
        typeof group.subcategory === "string" &&
        group.subcategory.trim().toLowerCase() === "pizza" &&
        isPizzaSubGroupArray(group.items)
      ) {
        // If there are no pizza items, don't show the section
        const allPizzaItems = (group.items as PizzaSubGroup[])
          .flatMap((subgroup) =>
            subgroup.items.map((item) => ({
              ...item,
              pizzaSubcategory: subgroup.subcategory,
            }))
          );
        return {
          ...group,
          items: allPizzaItems,
        };
      }
      // Normal section
      return {
        ...group,
        items: (group.items as MenuItem[]).filter((item) =>
          filter === "all"
            ? true
            : filter === "veg"
            ? isVegItem(item)
            : isNonVegItem(item)
        ),
      };
    })
    // Only filter out groups if they have no items (for pizza, don't filter out if items is an array of objects)
    .filter((group) => {
      if (
        typeof group.subcategory === "string" &&
        group.subcategory.trim().toLowerCase() === "pizza"
      ) {
        // Always show pizza section if there are any pizza items
        return Array.isArray(group.items) && group.items.length > 0;
      }
      return (group.items as MenuItem[]).length > 0;
    });

  const navGroups = filteredMenu;

  const getCartQty = (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => {
    if (item.sizes && size) {
      const found = cart.find(
        c =>
          c.id === item.id &&
          c.selectedSize?.size === size.size &&
          JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
      );
      return found ? found.quantity : 0;
    } else {
      const found = cart.find(
        c =>
          c.id === item.id &&
          JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
      );
      return found ? found.quantity : 0;
    }
  };

  const scrollToSubcat = (subcat: string) => {
    const el = document.getElementById(`subcat-${subcat.replace(/\s+/g, "-")}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setNavOpen(false);
  };

  return (
    <div className="menu-app dark-bg">
      <header className="main-header">
        <h1>MOMO STREET</h1>
        <button className="cart-btn" onClick={() => navigate("/cart")}>
          Cart
          {cart.length > 0 && <span className="cart-badge">{cart.reduce((a, b) => a + b.quantity, 0)}</span>}
        </button>
      </header>
      <nav className="subcat-nav">
        <button className="hamburger" onClick={() => setNavOpen(!navOpen)}>
          <span />
          <span />
          <span />
        </button>
        <div className={`nav-list${navOpen ? " open" : ""}`}>
          {navGroups.map(group => (
            <div
              key={group.subcategory}
              className="nav-link"
              onClick={() => scrollToSubcat(group.subcategory)}
            >
              {group.subcategory}
            </div>
          ))}
        </div>
      </nav>
      <div className="filter-bar">
        <button
          className={`filter-btn veg ${filter === "veg" ? "active" : ""}`}
          onClick={() => setFilter("veg")}
        >
          Veg Only
        </button>
        <button
          className={`filter-btn non-veg ${filter === "non-veg" ? "active" : ""}`}
          onClick={() => setFilter("non-veg")}
        >
          Non-Veg Only
        </button>
        <button
          className={`filter-btn all ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Show All
        </button>
      </div>
      <main>
        <h2 className="menu-title">Menu</h2>
        <div className="menu-groups">
          {filteredMenu.map(group => {
            // --- Render pizza section as a flat list with size and extras ---
            if (group.subcategory.toLowerCase().includes("pizza")) {
              return (
                <div key={group.subcategory} className="menu-group">
                  <div className="menu-group-title" id={`subcat-${group.subcategory.replace(/\s+/g, "-")}`}>
                    {group.subcategory}
                  </div>
                  <ul className="menu-list">
                    {(group.items as MenuItem[]).map(item => (
                      <PizzaMenuItem
                        key={item.id}
                        item={item}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                        getCartQty={getCartQty}
                        pizzaSubcategory={item.pizzaSubcategory}
                        extraOptions={item.extraOptions || parseExtraOptions(item.extras)}
                      />
                    ))}
                  </ul>
                </div>
              );
            }
            // --- Render normal menu section ---
            return (
              <div key={group.subcategory} className="menu-group">
                <div className="menu-group-title" id={`subcat-${group.subcategory.replace(/\s+/g, "-")}`}>
                  {group.subcategory}
                </div>
                <ul className="menu-list">
                  {(group.items as MenuItem[]).map(item => {
                    const extraOptions = item.extraOptions || parseExtraOptions(item.extras);
                    return (
                      <NonPizzaMenuItem
                        key={item.id}
                        item={item}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                        getCartQty={getCartQty}
                        extraOptions={extraOptions}
                      />
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function NonPizzaMenuItem({
  item,
  addToCart,
  removeFromCart,
  getCartQty,
  extraOptions,
}: {
  item: MenuItem;
  addToCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  removeFromCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  getCartQty: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => number;
  extraOptions: ExtraOption[];
}) {
  const [selectedExtras, setSelectedExtras] = useState<ExtraOption[]>([]);
  useEffect(() => setSelectedExtras([]), [item.id]);
  const qty = getCartQty(item, undefined, selectedExtras);
  const totalPrice =
    (item.price || 0) +
    selectedExtras.reduce((sum, e) => sum + (e.price || 0), 0);
  return (
    <li className="menu-item modern-card">
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="menu-item-img"
          />
        )}
        <div className="item-info">
          <span className="item-name">
            {item.name}
            <span
              className={`dot ${isVegItem(item) ? "veg-dot" : "nonveg-dot"}`}
              title={isVegItem(item) ? "Veg" : "Non-Veg"}
            />
          </span>
          {item.extras && <span className="item-extras">{item.extras}</span>}
        </div>
      </div>
      <div className="item-actions">
        <span className="price">
          {item.price !== null && item.price !== undefined ? <>₹{totalPrice}</> : ""}
        </span>
        {extraOptions.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {extraOptions.map(opt => (
              <label key={opt.name} style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedExtras.some(e => e.name === opt.name)}
                  onChange={e => {
                    setSelectedExtras(prev =>
                      e.target.checked
                        ? [...prev, opt]
                        : prev.filter(x => x.name !== opt.name)
                    );
                  }}
                />
                {opt.name} +₹{opt.price}
              </label>
            ))}
          </div>
        )}
        {item.price !== null && item.price !== undefined && (
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <button
              className="add-btn"
              onClick={() => addToCart(item, undefined, selectedExtras)}
            >
              Add
            </button>
            {qty > 0 && (
              <>
                <span className="qty-badge">{qty}</span>
                <button
                  className="add-btn"
                  style={{background: "#444", color: "#fff"}}
                  onClick={() => removeFromCart(item, undefined, selectedExtras)}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PizzaMenuItem({
  item,
  addToCart,
  removeFromCart,
  getCartQty,
  extraOptions,
  pizzaSubcategory,
}: {
  item: MenuItem;
  addToCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  removeFromCart: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => void;
  getCartQty: (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => number;
  extraOptions: ExtraOption[];
  pizzaSubcategory?: string;
}) {
  const [selectedSize, setSelectedSize] = useState<PizzaSizeOption | undefined>(item.sizes?.[0]);
  const [selectedExtras, setSelectedExtras] = useState<ExtraOption[]>([]);
  // Only show extras relevant to selected size, or all if not size-specific
  const availableExtras = extraOptions.filter(e =>
    !selectedSize ||
    e.name.toLowerCase().includes(selectedSize.size?.toLowerCase() || "")
  );
  useEffect(() => {
    setSelectedSize(item.sizes?.[0]);
    setSelectedExtras([]);
  }, [item]);
  useEffect(() => {
    setSelectedExtras([]);
  }, [selectedSize]);
  const qty = selectedSize ? getCartQty(item, selectedSize, selectedExtras) : 0;
  const totalPrice =
    (selectedSize?.price || 0) +
    selectedExtras.reduce((sum, e) => sum + (e.price || 0), 0);
  return (
    <li className="menu-item modern-card">
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="menu-item-img"
          />
        )}
        <div className="item-info">
          <span className="item-name">
            {item.name}
            <span
              className={`dot ${isVegItem(item) ? "veg-dot" : "nonveg-dot"}`}
              title={isVegItem(item) ? "Veg" : "Non-Veg"}
            />
          </span>
          {pizzaSubcategory && (
            <span className="item-extras" style={{ color: "#ffb300", fontWeight: 500, marginLeft: 8 }}>
              {pizzaSubcategory}
            </span>
          )}
          {item.extras && <span className="item-extras">{item.extras}</span>}
        </div>
      </div>
      <div className="item-actions">
        {item.sizes && item.sizes.length > 0 && (
          <select
            value={selectedSize?.size || ""}
            onChange={e =>
              setSelectedSize(item.sizes?.find(s => s.size === e.target.value))
            }
            style={{ marginBottom: 8, padding: "0.3em 0.7em", borderRadius: 6 }}
          >
            {item.sizes.map(size => (
              <option key={size.size} value={size.size}>
                {size.size} - ₹{size.price}
              </option>
            ))}
          </select>
        )}
        {availableExtras.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {availableExtras.map(opt => (
              <label key={opt.name} style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedExtras.some(e => e.name === opt.name)}
                  onChange={e => {
                    setSelectedExtras(prev =>
                      e.target.checked
                        ? [...prev, opt]
                        : prev.filter(x => x.name !== opt.name)
                    );
                  }}
                />
                {opt.name} +₹{opt.price}
              </label>
            ))}
          </div>
        )}
        <span className="price">
          {selectedSize ? <>₹{totalPrice}</> : ""}
        </span>
        {selectedSize && (
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <button
              className="add-btn"
              onClick={() => addToCart(item, selectedSize, selectedExtras)}
            >
              Add
            </button>
            {qty > 0 && (
              <>
                <span className="qty-badge">{qty}</span>
                <button
                  className="add-btn"
                  style={{background: "#444", color: "#fff"}}
                  onClick={() => removeFromCart(item, selectedSize, selectedExtras)}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function CartPage({
  cart,
  removeFromCart,
  updateQty,
  name,
  setName,
  phone,
  setPhone,
  submitOrder,
  submitted,
}: {
  cart: CartItem[];
  removeFromCart: (idx: number) => void;
  updateQty: (idx: number, qty: number) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  submitOrder: () => void;
  submitted: boolean;
}) {
  const navigate = useNavigate();
  if (submitted)
    return (
      <div className="centered">
        <h2>Order placed!</h2>
        <p>Thank you for ordering at <b>MOMO STREET</b>.</p>
        <button onClick={() => navigate("/")}>Back to Menu</button>
      </div>
    );
  return (
    <div className="cart-page dark-bg">
      <header>
        <button className="back-btn" onClick={() => navigate("/")}>← Menu</button>
        <h1>Your Cart</h1>
      </header>
      <ul className="cart-list">
        {cart.map((item, idx) => (
          <li key={idx} className="cart-item modern-card">
            <span>
              {item.name}
              {item.selectedSize && <span className="item-size"> ({item.selectedSize.size})</span>}
              {item.selectedExtras && item.selectedExtras.length > 0 && (
                <span className="item-extras">
                  {" [" +
                    item.selectedExtras.map(e => `${e.name} +₹${e.price}`).join(", ") +
                    "]"}
                </span>
              )}
            </span>
            <div className="cart-actions">
              <button onClick={() => updateQty(idx, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
              <span className="qty-badge">{item.quantity}</span>
              <button onClick={() => updateQty(idx, item.quantity + 1)}>+</button>
              <span className="price">₹{item.price && item.quantity ? item.price * item.quantity : ""}</span>
              <button onClick={() => removeFromCart(idx)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="order-form">
        <input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        <button onClick={submitOrder} disabled={!cart.length || !name || !phone}>Place Order</button>
      </div>
    </div>
  );
}

export default function App() {
  const [menu, setMenu] = useState<MenuGroup[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<"all" | "veg" | "non-veg">("all");

  useEffect(() => {
    fetch(`${API_URL}/menu`)
      .then(res => res.json())
      .then(data => {
        console.log("DEBUG: Menu received from backend:", data); // Debug print
        setMenu(data);
      })
      .catch(err => {
        console.error("Error fetching menu:", err);
        setMenu([]); // Fallback to empty menu
      });
  }, []);

  const addToCart = (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => {
    setCart(prev => {
      if (item.sizes && size) {
        const idx = prev.findIndex(
          c =>
            c.id === item.id &&
            c.selectedSize?.size === size.size &&
            JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
        );
        if (idx !== -1) {
          return prev.map((c, i) =>
            i === idx ? { ...c, quantity: c.quantity + 1 } : c
          );
        }
        return [...prev, { ...item, price: size.price, selectedSize: size, selectedExtras: extras || [], quantity: 1 }];
      } else {
        const idx = prev.findIndex(
          c =>
            c.id === item.id &&
            JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
        );
        if (idx !== -1) {
          return prev.map((c, i) =>
            i === idx ? { ...c, quantity: c.quantity + 1 } : c
          );
        }
        const totalPrice =
          (item.price || 0) +
          (extras || []).reduce((sum, e) => sum + (e.price || 0), 0);
        return [...prev, { ...item, price: totalPrice, selectedExtras: extras || [], quantity: 1 }];
      }
    });
  };

  const removeFromCartByItem = (item: MenuItem, size?: PizzaSizeOption, extras?: ExtraOption[]) => {
    setCart(prev => {
      if (item.sizes && size) {
        const idx = prev.findIndex(
          c =>
            c.id === item.id &&
            c.selectedSize?.size === size.size &&
            JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
        );
        if (idx !== -1) {
          const updated = [...prev];
          if (updated[idx].quantity > 1) {
            updated[idx].quantity = updated[idx].quantity - 1;
            return updated;
          } else {
            updated.splice(idx, 1);
            return updated;
          }
        }
        return prev;
      } else {
        const idx = prev.findIndex(
          c =>
            c.id === item.id &&
            JSON.stringify(c.selectedExtras || []) === JSON.stringify(extras || [])
        );
        if (idx !== -1) {
          const updated = [...prev];
          if (updated[idx].quantity > 1) {
            updated[idx].quantity = updated[idx].quantity - 1;
            return updated;
          } else {
            updated.splice(idx, 1);
            return updated;
          }
        }
        return prev;
      }
    });
  };

  const removeFromCartByIndex = (idx: number) => setCart(cart => cart.filter((_, i) => i !== idx));

  const updateQty = (idx: number, qty: number) => {
    setCart(cart =>
      cart.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  };

  const submitOrder = () => {
    fetch(`${API_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart
          .map(
            i =>
              `${i.name}${i.selectedSize ? ` (${i.selectedSize.size})` : ""}${
                i.selectedExtras && i.selectedExtras.length
                  ? " [" +
                    i.selectedExtras.map(e => `${e.name} +₹${e.price}`).join(", ") +
                    "]"
                  : ""
              } x${i.quantity}`
          )
          .join(", "),
        name,
        phone
      })
    }).then(() => {
      setSubmitted(true);
      setCart([]);
    });
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <MenuPage
              menu={menu}
              addToCart={addToCart}
              removeFromCart={removeFromCartByItem}
              cart={cart}
              filter={filter}
              setFilter={setFilter}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <CartPage
              cart={cart}
              removeFromCart={removeFromCartByIndex}
              updateQty={updateQty}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              submitOrder={submitOrder}
              submitted={submitted}
            />
          }
        />
      </Routes>
    </Router>
  );
}
