import { NavLink } from "react-router-dom";

function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">AH</div>

        <div className="brand-info">
          <strong>ABC Hardware</strong>
          <span>Store Admin</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">▣</span>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/admin/orders"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">▤</span>
          <span>Orders</span>
        </NavLink>

        <NavLink
          to="/admin/products"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">□</span>
          <span>Products</span>
        </NavLink>

        <NavLink
          to="/admin/categories"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">⊞</span>
          <span>Categories</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/admin/store"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <span className="sidebar-icon">⚙</span>
          <span>Store Settings</span>
        </NavLink>

        <a href="/" className="sidebar-link">
          <span className="sidebar-icon">↗</span>
          <span>View Store</span>
        </a>
      </div>
    </aside>
  );
}

export default AdminSidebar;