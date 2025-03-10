import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import customersData from "../data/customer_master.json";
import "./Login.css";

// Define the customer type
interface Customer {
  customerId: string;
  name: string;
  email: string;
  phoneNo: string;
  role: string;
  password: string;
  assignedLots: string[];
  isVerified: string;
  lastLogin: string;
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lotId, setLotId] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLotId("");
    setTempPassword("");
  }, [setupMode]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customer = customersData.find(
      (c) => c.email === email && c.password === password
    );

    if (customer) {
      setError("");
      localStorage.removeItem("authToken");

      const sessionData = {
        ...customer,
        expiresAt: Date.now() + 30 * 60 * 1000,
      };

      localStorage.setItem("authToken", JSON.stringify(sessionData));

      navigate(
        customer.role === "owner" && customer.assignedLots.length > 1
          ? `/${customer.customerId}/owner-dashboard`
          : `/${customer.customerId}/${customer.assignedLots[0]}/revenue-dashboard`
      );
    } else {
      setError("Invalid username or password");
    }
  };

  const handleSetupAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customer = customersData.find(
      (c) => c.assignedLots.includes(lotId) && c.password === tempPassword && c.role === "temp"
    );

    if (customer) {
      setError("");
      setCreatingAccount(true);
    } else {
      setError("Invalid LotID or Password");
    }
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customerIndex = customersData.findIndex(
      (c) => c.assignedLots.includes(lotId) && c.role === "temp"
    );

    if (customerIndex !== -1) {
      const updatedCustomers = [...customersData];
      updatedCustomers[customerIndex].email = email;
      updatedCustomers[customerIndex].password = password;
      updatedCustomers[customerIndex].role = "owner";

      try {
        const response = await fetch("http://localhost:5000/update-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCustomers),
        });

        const result = await response.json();
        if (response.ok) {
          const newUser = updatedCustomers[customerIndex];
          localStorage.setItem("authToken", JSON.stringify(newUser));

          navigate(
            newUser.assignedLots.length > 1
              ? `/${newUser.customerId}/owner-dashboard`
              : `/${newUser.customerId}/${newUser.assignedLots[0]}/revenue-dashboard`
          );
        } else {
          setError("Failed to update account. Please try again.");
        }
      } catch (err) {
        console.error("Error updating customer data:", err);
        setError("Server error. Please try again.");
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/assets/Logo_Operator.svg" alt="Parallel Operator" className="logo-operator" />

        {setupMode ? (
          creatingAccount ? (
            <form onSubmit={handleCreateAccount} autoComplete="off">
              {/* Fake Hidden Fields to Stop Autofill */}
              <input type="text" name="fakeuser" style={{ display: "none" }} />
              <input type="password" name="fakepassword" style={{ display: "none" }} />

              <div className="info-tooltip">
                <img src="/assets/info_login.svg" alt="Info" />
                <p>Please choose an email and password, you will use these credentials to log in.</p>
              </div>
              <input
                type="text"
                placeholder="Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                name="new-email"
              />
              <input
                type="password"
                placeholder="Create Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                name="new-password"
              />
              <button type="submit" className="login-button">Create Account</button>
            </form>
          ) : (
            <form onSubmit={handleSetupAccount} autoComplete="off">
              {/* Fake Hidden Fields to Stop Autofill */}
              <input type="text" name="fakeuser" style={{ display: "none" }} />
              <input type="password" name="fakepassword" style={{ display: "none" }} />

              <input
                type="text"
                placeholder="LotID"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                autoComplete="off"
                name="lot-id"
              />
              <input
                type="password"
                placeholder="Temp Password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                autoComplete="new-password"
                name="temp-password"
              />
              <button type="submit" className="login-button">Setup Account</button>
              {error && <p className="error">{error}</p>}
              <div className="info-box">
                <img src="/assets/info_login.svg" alt="Info" />
                <p>Your LotID and Temporary Password can be found in your box!</p>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} autoComplete="off">
            {/* Fake Hidden Fields to Stop Autofill */}
            <input type="text" name="fakeuser" style={{ display: "none" }} />
            <input type="password" name="fakepassword" style={{ display: "none" }} />

            <input
              type="text"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              name="email-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              name="password-input"
            />
            <button type="submit" className="login-button">Login</button>
            {error && <p className="error">{error}</p>}
          </form>
        )}

        {!setupMode && <a href="#" className="forgot-password">Forgot my password</a>}
        {!setupMode && <button className="setup-account" onClick={() => setSetupMode(true)}>Setup an Account</button>}
        {setupMode && <button className="setup-account" onClick={() => setSetupMode(false)}>Back to Login</button>}
      </div>
      <footer>
        <img src="/assets/PoweredbyParallelDark.svg" alt="Powered by Parallel" className="powered-by-logo" />
      </footer>
    </div>
  );
};

export default Login;
