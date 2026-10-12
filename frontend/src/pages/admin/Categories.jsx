import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";
const BUSINESS_ID = 1;

function Categories() {
  const [categories, setCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

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
      setError("Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();

    if (!categoryName.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/businesses/${BUSINESS_ID}/categories`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: categoryName.trim(),
            parent_id: parentId === "" ? null : Number(parentId),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create category.");
      }

      setCategoryName("");
      setParentId("");
      setShowForm(false);

      await loadCategories();
    } catch (err) {
      console.error(err);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(categoryId) {
    setExpandedCategories((previous) => ({
      ...previous,
      [categoryId]: !previous[categoryId],
    }));
  }

  const parentCategories = categories.filter(
    (category) => category.parent_id === null
  );

  function getSubcategories(parentId) {
    return categories.filter(
      (category) => category.parent_id === parentId
    );
  }

  return (
    <div className="dashboard categories-page">
      <div className="dashboard-header">
        <div>
          <h1>Categories</h1>
          <p>Organize your store's product categories.</p>
        </div>

        <button 
          className="dashboard-orders-button"
          onClick={() => {
            setShowForm(true);
            setFormError("");
          }}
        >
          + Add Category
        </button>
      </div>

      {showForm && (
        <section className="categories-management-card category-form-card">
          <div className="categories-management-header">
            <div>
              <h2>Add Category</h2>
              <p>Create a parent category or subcategory.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateCategory} className="category-form">
            <div className="form-group">
              <label htmlFor="category-name">
                Category Name
              </label>

              <input
                id="category-name"
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Building Materials"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="parent-category">
                Parent Category
              </label>

              <select
                id="parent-category"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">
                  None — Parent Category
                </option>

                {categories
                  .filter((category) => category.parent_id === null)
                  .map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
              </select>
            </div>

            {formError && (
              <p className="error-message">{formError}</p>
            )}

            <button
              type="submit"
              className="dashboard-orders-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Category"}
            </button>
          </form>
        </section>
      )}

      <section className="categories-management-card">
        <div className="categories-management-header">
          <div>
            <h2>Category Structure</h2>
            <p>
              {categories.length} categories in your catalogue.
            </p>
          </div>
        </div>

        {loading && (
          <div className="products-message">
            Loading categories...
          </div>
        )}

        {error && (
          <div className="products-message error-message">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="category-tree">
            {parentCategories.map((parent) => {
              const subcategories = getSubcategories(parent.id);
              const isExpanded = expandedCategories[parent.id];

              return (
                <div className="category-group" key={parent.id}>
                  <div className="category-row parent-category">
                    <button
                      type="button"
                      className="category-expand-button"
                      onClick={() => toggleCategory(parent.id)}
                      aria-label={`Toggle ${parent.name}`}
                    >
                      {isExpanded ? "⌄" : "›"}
                    </button>

                    <span className="category-folder-icon">
                      📁
                    </span>

                    <strong>{parent.name}</strong>

                    <span className="category-count">
                      {subcategories.length} subcategories
                    </span>

                    <div className="category-actions">
                      <button type="button" disabled>
                        Edit
                      </button>
                      <button type="button" disabled>
                        Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && subcategories.length > 0 && (
                    <div className="subcategory-list">
                      {subcategories.map((subcategory) => (
                        <div
                          className="category-row subcategory-row"
                          key={subcategory.id}
                        >
                          <span className="subcategory-branch">
                            └
                          </span>

                          <span className="category-folder-icon">
                            📂
                          </span>

                          <span>{subcategory.name}</span>

                          <div className="category-actions">
                            <button type="button" disabled>
                              Edit
                            </button>
                            <button type="button" disabled>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && subcategories.length === 0 && (
                    <div className="category-empty">
                      No subcategories.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Categories;