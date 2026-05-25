import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import ListingDetail from "@/pages/ListingDetail";
import AdminLogin from "@/pages/AdminLogin";
import AdminForgotPassword from "@/pages/AdminForgotPassword";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminListingForm from "@/pages/AdminListingForm";
import AdminMessages from "@/pages/AdminMessages";
import AdminSettings from "@/pages/AdminSettings";

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" theme="dark" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot" element={<AdminForgotPassword />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/new"
            element={
              <ProtectedRoute>
                <AdminListingForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/edit/:id"
            element={
              <ProtectedRoute>
                <AdminListingForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <ProtectedRoute>
                <AdminMessages />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
