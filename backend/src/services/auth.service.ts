import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { UserRepository } from '../repositories/user.repository.js';
import type { JwtPayload } from '../types/auth.js';
import type { User } from '../db/index.js';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  tenantId: string;
  role?: 'admin' | 'manager' | 'viewer';
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private jwtSecret: string,
    private jwtExpiresIn: string,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const exists = await this.userRepo.tenantExists(input.tenantId);
    if (!exists) {
      throw new AuthError('Tenant not found', 404);
    }

    const existing = await this.userRepo.findByEmail(input.email, input.tenantId);
    if (existing) {
      throw new AuthError('Email already registered for this tenant', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      tenantId: input.tenantId,
      role: input.role ?? 'viewer',
    });

    const token = this.signToken(user);
    return { user: this.stripHash(user), token };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email, input.tenantId);
    if (!user) {
      throw new AuthError('Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AuthError('Invalid email or password', 401);
    }

    const token = this.signToken(user);
    return { user: this.stripHash(user), token };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch {
      throw new AuthError('Invalid or expired token', 401);
    }
  }

  async refreshToken(token: string): Promise<AuthResult> {
    const payload = this.verifyToken(token);

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new AuthError('User no longer exists', 401);
    }

    const newToken = this.signToken(user);
    return { user: this.stripHash(user), token: newToken };
  }

  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AuthError('User not found', 404);
    }

    return this.stripHash(user);
  }

  private signToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn as StringValue });
  }

  private stripHash(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
