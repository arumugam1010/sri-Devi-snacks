import { sign, verify, Secret } from 'jsonwebtoken'; 
import bcrypt from 'bcryptjs'; const JWT_SECRET: string = process.env.JWT_SECRET || 'fallback-secret-key'; 
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';
 export interface TokenPayload { id: number; username: string; email: string; name: string; role: string; } 
 export const generateToken = (payload: TokenPayload): string => { return (sign as any)(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); }; 
 export const verifyToken = (token: string): TokenPayload => { return (verify as any)(token, JWT_SECRET) as TokenPayload; }; 
 export const hashPassword = async (password: string): Promise<string> => { const saltRounds = 10; return bcrypt.hash(password, saltRounds); };
  export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => { return bcrypt.compare(password, hashedPassword); };
