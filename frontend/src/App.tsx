import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Shops from './components/Shops';
import Products from './components/Products';
import Billing from './components/Billing';
import Reports from './components/Reports';
import Layout from './components/Layout';
import Stock from './components/Stock';
import { AppProvider } from './context/AppContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    // Remove localStorage persistence to always show login page first
  }, []);

interface UserData {
    id: number;
    name: string;
    email: string;
}

const handleLogin = (userData: UserData) => {
    setIsAuthenticated(true);
    setUser(userData);
    // Remove localStorage set to disable persistence
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    // Remove localStorage remove to disable persistence
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppProvider>
        <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shops" element={<Shops />} />
            <Route path="/products" element={<Products />} />
            <Route path="/billing" element={<Billing />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Layout>
      </AppProvider>
    </Router>
  );
}

export default App;