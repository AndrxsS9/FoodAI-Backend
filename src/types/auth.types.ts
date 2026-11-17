export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: 'authenticated';
  sessionId?: string;
  aud: string | string[];
  iss: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
