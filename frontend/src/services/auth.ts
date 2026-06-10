import { api } from "./api";
import type { AuthResponse, User } from "../types/api";

export const authService = {
  async login(credentials: Record<string, string>): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", credentials);
    if (response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
    }
    return response.data;
  },

  async onboard(data: Record<string, string>): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/onboard", data);
    if (response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
    }
    return response.data;
  },

  async register(data: Record<string, string>): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", data);
    if (response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
    }
    return response.data;
  },

  logout(): void {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>("/auth/me");
    return response.data;
  },
};
