import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { UserRepository } from './user.repository.js';
import type { JwtPayload } from '../../shared/types/auth.js';
import type { User } from '../../db/index.js';
import { AuthError } from '../../shared/errors/index.js';

const SALT_ROUNDS = 12;

export interface OnboardInput {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

export interface LoginInput {
  email: string;
  password: string;
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



  async onboard(input: OnboardInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existing = await this.userRepo.findFirstByEmail(normalizedEmail);
    if (existing) {
      throw new AuthError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    
    // Generate slug from company name
    const slug = input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const { user } = await this.userRepo.createTenantWithAdmin(
      { name: input.companyName, slug },
      { name: input.name, email: normalizedEmail, passwordHash, role: 'admin' }
    );

    const token = this.signToken(user);
    return { user: this.stripHash(user), token };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepo.findFirstByEmail(normalizedEmail);
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

  async verifyAndFetchUser(token: string): Promise<JwtPayload> {
    const payload = this.verifyToken(token);
    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new AuthError('User no longer exists', 401);
    }
    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
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
