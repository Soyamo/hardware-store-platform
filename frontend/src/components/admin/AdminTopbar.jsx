function AdminTopbar() {
  return (
    <header className="admin-topbar">
      <div className="topbar-search">
        <span>⌕</span>
        <input
          type="text"
          placeholder="Search orders, products..."
        />
      </div>

      <div className="topbar-right">
        <button className="notification-button" type="button">
          ♢
        </button>

        <div className="admin-profile">
          <div className="profile-avatar">A</div>

          <div className="profile-info">
            <strong>Admin</strong>
            <span>Store Manager</span>
          </div>

          <span className="profile-chevron">⌄</span>
        </div>
      </div>
    </header>
  );
}

export default AdminTopbar;