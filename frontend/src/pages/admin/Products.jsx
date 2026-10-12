
import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";
const BUSINESS_ID = 1;

function formatCurrency(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function getAvailability(stock, reserved) {
  const available = Number(stock || 0) - Number(reserved || 0);

  if (available <= 0) {
    return { label: "Out of stock", className: "out-of-stock" };
  }

  if (available <= 10) {
    return { label: "Limited availability", className: "limited-stock" };
  }

  return { label: "In stock", className: "in-stock" };
}

function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category_id: "",
    description: "",
    price: "",
    unit_of_measure: "",
    custom_unit: "",
    stock_quantity: "",
    image_url: "",
  });

  async function loadProducts() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/businesses/${BUSINESS_ID}/products`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await response.json();

      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/businesses/${BUSINESS_ID}/categories`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      const data = await response.json();

      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (err) {
      console.error(err);
      setFormError("Unable to load categories.");
    }
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData({
      name: "",
      sku: "",
      category_id: "",
      description: "",
      price: "",
      unit_of_measure: "",
      custom_unit: "",
      stock_quantity: "",
      image_url: "",
    });

    setFormError("");
  }

  function closePanel() {
    if (isSaving) return;

    setIsPanelOpen(false);
    resetForm();
  }

function handleEditProduct(product) {
  setEditingProduct(product);

  setFormData({
    name: product.name || "",
    sku: product.sku || "",
    category_id: String(product.category_id || ""),
    description: product.description || "",
    price: String(product.price ?? ""),
    unit_of_measure: product.unit_of_measure || "",
    custom_unit: "",
    stock_quantity: String(product.stock_quantity ?? ""),
    image_url: product.image_url || "",
  });

  setFormError("");
  setSuccessMessage("");
  setIsPanelOpen(true);
}

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    const finalUnit =
      formData.unit_of_measure === "custom"
        ? formData.custom_unit.trim()
        : formData.unit_of_measure;

    if (!formData.name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    if (!formData.sku.trim()) {
      setFormError("SKU is required.");
      return;
    }

    if (!formData.category_id) {
      setFormError("Please select a category.");
      return;
    }

    if (!formData.price || Number(formData.price) < 0) {
      setFormError("Please enter a valid price.");
      return;
    }

    if (!finalUnit) {
      setFormError("Please select or enter a unit of measure.");
      return;
    }

    if (
      formData.stock_quantity === "" ||
      Number(formData.stock_quantity) < 0
    ) {
      setFormError("Please enter a valid stock quantity.");
      return;
    }

    const productPayload = {
      category_id: Number(formData.category_id),
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: Number(formData.price),
      unit_of_measure: finalUnit,
      stock_quantity: Number(formData.stock_quantity),
      image_url: formData.image_url.trim() || null,
    };

    try {
      setIsSaving(true);

      const response = await fetch(
        `${API_BASE_URL}/businesses/${BUSINESS_ID}/products${editingProduct ? `/${editingProduct.id}` : ""}`,
        {
          method: editingProduct ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productPayload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create product.");
      }

      setSuccessMessage(
        editingProduct
          ? "Product updated successfully."
          : "Product added successfully."
      );

      setIsPanelOpen(false);
      setEditingProduct(null);
      resetForm();
      await loadProducts();
    } catch (err) {
      console.error(err);
      setFormError(err.message || "Unable to add product.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard products-page">
      <div className="dashboard-header">
        <div>
          <h1>Products</h1>
          <p>Manage your store's product catalogue.</p>
        </div>

        <button
          className="dashboard-orders-button"
          onClick={() => {
            setSuccessMessage("");
            setFormError("");
            setIsPanelOpen(true);
          }}
        >
          + Add Product
        </button>
      </div>

      {successMessage && (
        <div className="products-success-message">
          {successMessage}
        </div>
      )}

      <section className="products-management-card">
        <div className="products-management-header">
          <div>
            <h2>Product Catalogue</h2>
            <p>{products.length} products in your catalogue.</p>
          </div>
        </div>

        {loading && (
          <div className="products-message">
            Loading products...
          </div>
        )}

        {error && (
          <div className="products-message error-message">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Availability</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const availability = getAvailability(
                    product.stock_quantity,
                    product.reserved_quantity
                  );

                  const availableQuantity =
                    Number(product.stock_quantity || 0) -
                    Number(product.reserved_quantity || 0);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-placeholder-image">
                            {product.name?.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{product.name}</strong>
                            <span>Per {product.unit_of_measure}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {product.category_name ||
                          product.category?.name ||
                          "—"}
                      </td>

                      <td className="product-sku">{product.sku}</td>

                      <td className="product-price">
                        {formatCurrency(product.price)}
                      </td>

                      <td>
                        {availableQuantity}{" "}
                        <span className="stock-unit">
                          {product.unit_of_measure}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`availability-badge ${availability.className}`}
                        >
                          <span className="status-dot"></span>
                          {availability.label}
                        </span>
                      </td>

                      <td>
                      <button
                        type="button"
                        className="product-view-link product-edit-button"
                        onClick={() => handleEditProduct(product)}
                      >
                        Edit
                      </button>
                      </td>
                    </tr>
                  );
                })}

                {products.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-products">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isPanelOpen && (
        <div className="product-panel-overlay" onClick={closePanel}>
          <aside
            className="product-form-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-panel-header">
              <div>
                <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
                <p>
                  {editingProduct
                    ? "Update this catalogue item."
                    : "Create a new catalogue item."}
                </p>
              </div>

              <button
                type="button"
                className="product-panel-close"
                onClick={closePanel}
                disabled={isSaving}
              >
                ×
              </button>
            </div>

            <form
              className="product-form"
              onSubmit={handleSubmit}
            >
              {formError && (
                <div className="product-form-error">
                  {formError}
                </div>
              )}

              <div className="product-form-section">
                <h3>Basic Information</h3>

                <label>
                  Product Name *
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. 20mm PVC Pipe"
                    required
                  />
                </label>

                <label>
                  SKU *
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    placeholder="e.g. PVC-20-001"
                    required
                  />
                </label>

                <label>
                  Category *
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select category</option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Optional product description"
                    rows="3"
                  />
                </label>
              </div>

              <div className="product-form-section">
                <h3>Pricing & Stock</h3>

                <label>
                  Price (R) *
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Unit of Measure *
                  <select
                    name="unit_of_measure"
                    value={formData.unit_of_measure}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select unit</option>
                    <option value="piece">Piece</option>
                    <option value="bag">Bag</option>
                    <option value="metre">Metre</option>
                    <option value="cubic_metre">Cubic metre</option>
                    <option value="kilogram">Kilogram</option>
                    <option value="box">Box</option>
                    <option value="roll">Roll</option>
                    <option value="custom">Custom unit</option>
                  </select>
                </label>

                {formData.unit_of_measure === "custom" && (
                  <label>
                    Custom Unit *
                    <input
                      type="text"
                      name="custom_unit"
                      value={formData.custom_unit}
                      onChange={handleInputChange}
                      placeholder="e.g. sheet, bundle, set"
                      required
                    />
                  </label>
                )}

                <label>
                  Initial Stock Quantity *
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
              </div>

              <div className="product-form-section">
                <h3>Product Image</h3>

                <div className="product-upload-disabled">
                  <strong>Image Upload</strong>
                  <span>Coming soon</span>
                  <small>
                    Image uploads will be activated in a future update.
                  </small>
                  <button type="button" disabled>
                    Choose File
                  </button>
                </div>

                <label>
                  Image URL
                  <input
                    type="url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </label>
              </div>

              <div className="product-form-actions">
                <button
                  type="button"
                  className="product-cancel-button"
                  onClick={closePanel}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="product-save-button"
                  disabled={isSaving}
                >
                  {isSaving
                    ? editingProduct
                      ? "Saving..."
                      : "Adding..."
                    : editingProduct
                      ? "Save Changes"
                      : "Add Product"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Products;