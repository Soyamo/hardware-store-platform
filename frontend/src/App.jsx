import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Orders from "./pages/admin/Orders";
import OrderDetails from "./pages/admin/OrderDetails";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:orderId" element={<OrderDetails />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/admin" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;