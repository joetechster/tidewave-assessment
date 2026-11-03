import { Request, Response, NextFunction } from 'express';
import { config } from './config';

export interface AuthUser {
  token: string;
  role: 'staff.admin' | 'staff.viewer' | 'automation' | 'tools';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  if (token === config.staffAdminToken) {
    req.user = { token, role: 'staff.admin' };
  } else if (token === config.staffViewerToken) {
    req.user = { token, role: 'staff.viewer' };
  } else if (token === config.automationToken) {
    req.user = { token, role: 'automation' };
  } else if (token === config.toolsToken) {
    req.user = { token, role: 'tools' };
  }

  next();
}

export function requireStaffOrAutomation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['staff.admin', 'staff.viewer', 'automation'].includes(req.user.role)) {
    res.status(401).json({ error: 'Unauthorized: Staff or automation credentials required' });
    return;
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['staff.admin', 'staff.viewer'].includes(req.user.role)) {
    res.status(401).json({ error: 'Unauthorized: Staff credentials required' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'staff.admin') {
    res.status(403).json({ error: 'Forbidden: Admin credentials required' });
    return;
  }
  next();
}

export function requireTools(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token || token !== config.toolsToken) {
    res.status(401).json({ error: 'Unauthorized: Valid tools token required' });
    return;
  }
  req.user = { token, role: 'tools' };
  next();
}
