
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";
const BUSINESS_ID = 1;

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

function getAvailableActions(status) {
  const actions = {
    PENDING: [
      { label: "Confirm Order", status: "CONFIRMED", type: "primary" },
      { label: "Cancel Order", status: "CANCELLED", type: "danger" },
    ],
    CONFIRMED: [
      { label: "Mark as Ready", status: "READY", type: "primary" },
      { label: "Cancel Order", status: "CANCELLED", type: "danger" },
    ],
    READY: [
      { label: "Mark as Collected", status: "COLLECTED", type: "primary" },
    ],
  };

  return actions[status] || [];
}

function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrder() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/businesses/${BUSINESS_ID}/orders/${orderId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }

        const data = await response.json();
        setOrder(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load order details.");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  async function updateOrderStatus(status) {
    setUpdating(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/businesses/${BUSINESS_ID}/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update order");
      }

      setOrder((previousOrder) => ({
        ...previousOrder,
        status,
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to update order status.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <p>Loading order details...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="dashboard">
        <Link to="/admin/orders" className="back-link">
          ← Back to Orders
        </Link>

        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const actions = getAvailableActions(order.status);

  const customerName = order.customer_name || order.customer?.name || "—";
  const phone = order.phone || order.customer?.phone || "—";
  const items = order.items || order.order_items || [];

  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  );

  return (
    <div className="dashboard order-details-page">
      <Link to="/admin/orders" className="back-link">
        ← Back to Orders
      </Link>

      <div className="order-details-header">
        <div>
          <div className="order-details-title-row">
            <h1>Order #{String(order.id || order.order_id).padStart(3, "0")}</h1>

            <span
              className={`status-badge status-${order.status.toLowerCase()}`}
            >
              <span className="status-dot"></span>
              {order.status}
            </span>
          </div>

          <p>
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {error && (
        <div className="error-message order-action-error">
          {error}
        </div>
      )}

      <div className="order-details-grid">
        <div className="order-details-main">
          <section className="order-details-card">
            <div className="order-card-header">
              <div>
                <h2>Order Items</h2>
                <p>Products included in this reservation.</p>
              </div>
            </div>

            <div className="order-items-list">
              {items.map((item, index) => {
                const productName =
                  item.product_name ||
                  item.name ||
                  item.product?.name ||
                  "Product";

                const lineTotal =
                  Number(item.quantity || 0) * Number(item.unit_price || 0);

                return (
                  <div className="order-item" key={item.id || index}>
                    <div className="order-item-info">
                      <strong>{productName}</strong>

                      <span>
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </span>
                    </div>

                    <strong className="order-item-total">
                      {formatCurrency(lineTotal)}
                    </strong>
                  </div>
                );
              })}
            </div>

            <div className="order-total-row">
              <span>Total</span>
              <strong>{formatCurrency(order.total || total)}</strong>
            </div>
          </section>

          <section className="order-details-card">
            <div className="order-card-header">
              <div>
                <h2>Order Timeline</h2>
                <p>Important order dates.</p>
              </div>
            </div>

            <div className="order-info-list">
              <div>
                <span>Created</span>
                <strong>{formatDate(order.created_at)}</strong>
              </div>

              <div>
                <span>Expires</span>
                <strong>{formatDate(order.expires_at)}</strong>
              </div>

              <div>
                <span>Current Status</span>
                <strong>{order.status}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="order-details-sidebar">
          <section className="order-details-card">
            <div className="order-card-header">
              <div>
                <h2>Customer Information</h2>
                <p>Customer details for this reservation.</p>
              </div>
            </div>

            <div className="customer-details">
              <div className="customer-avatar">
                {customerName.charAt(0).toUpperCase()}
              </div>

              <strong>{customerName}</strong>
              <span>{phone}</span>
            </div>
          </section>

          {actions.length > 0 && (
            <section className="order-details-card">
              <div className="order-card-header">
                <div>
                  <h2>Order Actions</h2>
                  <p>Update the reservation status.</p>
                </div>
              </div>

              <div className="order-actions">
                {actions.map((action) => (
                  <button
                    key={action.status}
                    className={`order-action-button ${action.type}`}
                    disabled={updating}
                    onClick={() => updateOrderStatus(action.status)}
                  >
                    {updating ? "Updating..." : action.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {actions.length === 0 && (
            <section className="order-details-card">
              <div className="order-card-header">
                <div>
                  <h2>Order Actions</h2>
                  <p>This order has no further available actions.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderDetails;