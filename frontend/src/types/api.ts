export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer";
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Pagination generic
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
