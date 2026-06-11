import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Invoices } from "./pages/Invoices";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { Agent } from "./pages/Agent";
import { DLQ } from "./pages/DLQ";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { AcceptInvitation } from "./pages/AcceptInvitation";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite" element={<AcceptInvitation />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/dlq" element={<DLQ />} />
          
          <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
