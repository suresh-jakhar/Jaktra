import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Invoices } from "./pages/Invoices";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { Agent } from "./pages/Agent";
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
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/analytics" element={<div className="p-4 text-slate-500">Analytics Page Placeholder</div>} />
          <Route path="/dlq" element={<div className="p-4 text-slate-500">DLQ Page Placeholder</div>} />
          <Route path="/settings" element={<div className="p-4 text-slate-500">Settings Page Placeholder</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
