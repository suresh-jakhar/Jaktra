import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<div className="p-4 text-slate-500">Invoices List Placeholder</div>} />
          <Route path="/agent" element={<div className="p-4 text-slate-500">Agent Page Placeholder</div>} />
          <Route path="/analytics" element={<div className="p-4 text-slate-500">Analytics Page Placeholder</div>} />
          <Route path="/dlq" element={<div className="p-4 text-slate-500">DLQ Page Placeholder</div>} />
          <Route path="/settings" element={<div className="p-4 text-slate-500">Settings Page Placeholder</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
