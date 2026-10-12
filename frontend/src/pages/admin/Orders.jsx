
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";
const BUSINESS_ID = 1;

const statusOptions = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "READY",
  "COLLECTED",
  "CANCELLED",
  "EXPIRED",
];

function formatDate(dateString) {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get("status") || "ALL";

  const [orders, setOrders] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const url = new URL(
          `${API_BASE_URL}/businesses/${BUSINESS_ID}/orders`
        );

        if (selectedStatus !== "ALL") {
          url.searchParams.set("status", selectedStatus);
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }

        const data = await response.json();

        setOrders(Array.isArray(data) ? data : data.orders || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load orders.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [selectedStatus]);

  function handleStatusChange(event) {
    const newStatus = event.target.value;

    setSelectedStatus(newStatus);

    if (newStatus === "ALL") {
      setSearchParams({});
    } else {
      setSearchParams({ status: newStatus });
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Orders</h1>
          <p>Manage customer reservations and collection.</p>
        </div>
      </div>

      <section className="orders-management-card">
        <div className="orders-management-header">
          <div>
            <h2>All Orders</h2>
            <p>View and manage reservations placed by customers.</p>
          </div>


        <div className="orders-filter">
            <label htmlFor="status-filter">Filter by status</label>

            <div className="custom-select-wrapper">
                <select
                    id="status-filter"
                    className="custom-select"
                    value={selectedStatus}
                    onChange={handleStatusChange}
                >
                    {statusOptions.map((status) => (
                        <option key={status} value={status}>
                            {status === "ALL" ? "All statuses" : status}
                        </option>
                    ))}
                </select>

                <span className="custom-select-arrow">⌄</span>
            </div>
        </div>
    </div>

        {loading && (
          <div className="orders-message">
            Loading orders...
          </div>
        )}

        {error && (
          <div className="orders-message error-message">
            {error}
          </div>
        )}

        {!loading && !error && (
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
                {orders.map((order) => (
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

                {orders.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-orders">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Orders;