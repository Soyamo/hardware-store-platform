import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

function AdminLayout() {
  return (
    <div className="admin-layout">
      <AdminSidebar />

      <div className="admin-main">
        <AdminTopbar />

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;