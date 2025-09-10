import React, { useState, useEffect, useRef } from 'react'; // Import necessary modules
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
  const SESSION_TIMEOUT = 3600 * 1000; // 1 hour (in milliseconds)
  const END_OF_DAY_HOUR = 23; // 11 PM

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const checkAuthStatus = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setIsAuthenticated(true);
        setUser(JSON.parse(storedUser));
      } else {
        setIsAuthenticated(false);
      }
    }

    checkAuthStatus();
  }, []);

  
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }
      logoutTimer.current = setTimeout(handleLogout, SESSION_TIMEOUT);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    const checkEndOfDay = () => {
      const now = new Date();
      if (now.getHours() >= END_OF_DAY_HOUR) {
        handleLogout();
      }
    };

    const endOfDayInterval = setInterval(checkEndOfDay, 60 * 60 * 1000); // Check every hour

    if (isAuthenticated) {
      resetTimer();
    }

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(endOfDayInterval);
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }
    };
  }, []);






interface UserData {
    id: number;
    name: string;
    email: string;
}

  const handleLogin = (userData: UserData) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    clearTimeout(logoutTimer.current as  ReturnType<typeof setTimeout>);
    setIsAuthenticated(false);
    setUser(null);
    // Remove localStorage remove to disable persistence
  };
  
  if (isAuthenticated === null) {
    return <div>Loading...</div>; // Or a loading spinner
  }


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