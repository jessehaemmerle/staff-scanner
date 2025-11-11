import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-lg text-slate-600">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            user ? (
              user.role === 'admin' ? 
                <Navigate to="/admin" /> : 
                <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          } />
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <LoginPage setUser={setUser} />
          } />
          <Route path="/admin" element={
            user && user.role === 'admin' ? 
              <AdminDashboard user={user} logout={logout} /> : 
              <Navigate to="/login" />
          } />
          <Route path="/dashboard" element={
            user ? 
              <UserDashboard user={user} logout={logout} /> : 
              <Navigate to="/login" />
          } />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
