import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expiresAt = payload.exp * 1000;
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (expiresAt - Date.now() < oneDayMs) {
          try {
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
              headers: { Authorization: `Bearer ${token}` },
            });
            localStorage.setItem("auth_token", data.token);
            config.headers.Authorization = `Bearer ${data.token}`;
          } catch {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authEvents = new EventTarget();

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        authEvents.dispatchEvent(new Event("unauthorized"));
      }
    }
    return Promise.reject(error);
  }
);

