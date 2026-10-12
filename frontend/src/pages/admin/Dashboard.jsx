
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../../services/api";

const statConfig = [
  { key: "pending_orders", label: "Pending Orders", status: "pending", filter: "PENDING" },
  { key: "confirmed_orders", label: "Confirmed", status: "confirmed", filter: "CONFIRMED" },
  { key: "ready_orders", label: "Ready", status: "ready", filter: "READY" },
  { key: "collected_orders", label: "Collected", status: "collected", filter: "COLLECTED" },
  { key: "cancelled_orders", label: "Cancelled", status: "cancelled", filter: "CANCELLED" },
  { key: "expired_orders", label: "Expired", status: "expired", filter: "EXPIRED" },
];

function formatDate(dateString) {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getDashboard();
        setDashboard(data);
      } catch (err) {
        setError("Unable to load dashboard data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Here's what's happening with your store today.</p>
        </div>

        <Link to="/admin/orders" className="dashboard-orders-button">
          View Orders <span>→</span>
        </Link>
      </div>

      <section className="dashboard-stats">
        {statConfig.map((stat) => (
          <Link
            key={stat.key}
            to={`/admin/orders?status=${stat.filter}`}
            className={`stat-card stat-${stat.status}`}
          >
            <div className="stat-card-top">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-arrow">→</span>
            </div>

            <div className="stat-value">
              {dashboard[stat.key] ?? 0}
            </div>

            <span className="stat-view">View orders</span>
          </Link>
        ))}
      </section>

      <section className="dashboard-summary">
        <div className="summary-card">
          <div className="summary-icon summary-icon-collected">✓</div>
          <div>
            <span className="summary-label">Collected Today</span>
            <strong>{dashboard.collected_today ?? 0}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon summary-icon-cancelled">×</div>
          <div>
            <span className="summary-label">Cancelled Today</span>
            <strong>{dashboard.cancelled_today ?? 0}</strong>
          </div>
        </div>
      </section>

      <section className="recent-orders-card">
        <div className="recent-orders-header">
          <div>
            <h2>Recent Orders</h2>
            <p>The latest reservations placed by customers.</p>
          </div>

          <Link to="/admin/orders" className="view-all-link">
            View all <span>→</span>
          </Link>
        </div>

        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {dashboard.recent_orders?.map((order) => (
                <tr key={order.order_id}>
                  <td>
                    <Link
                      to={`/admin/orders/${order.order_id}`}
                      className="order-number"
                    >
                      #{String(order.order_id).padStart(3, "0")}
                    </Link>
                  </td>

                  <td>
                    <div className="customer-cell">
                      <strong>{order.customer_name}</strong>
                      <span>{order.phone}</span>
                    </div>
                  </td>

                  <td className="order-date">
                    {formatDate(order.created_at)}
                  </td>

                  <td className="order-total">
                    {formatCurrency(order.total)}
                  </td>

                  <td>
                    <span
                      className={`status-badge status-${order.status.toLowerCase()}`}
                    >
                      <span className="status-dot"></span>
                      {order.status}
                    </span>
                  </td>

                  <td>
                    <Link
                      to={`/admin/orders/${order.order_id}`}
                      className="order-view-link"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {(!dashboard.recent_orders ||
                dashboard.recent_orders.length === 0) && (
                <tr>
                  <td colSpan="6">No recent orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;