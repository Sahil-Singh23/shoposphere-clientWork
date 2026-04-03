import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import prisma from "../prisma.js";

// Load environment variables explicitly with correct path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "shoposphere_auth";

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.split("=");
    if (rawKey?.trim() !== name) continue;
    const value = rawValueParts.join("=").trim();
    return value ? decodeURIComponent(value) : null;
  }

  return null;
}

function getAuthToken(req) {
  return getCookieValue(req, AUTH_COOKIE_NAME) || null;
}

/** Require valid JWT and hydrate req.auth from token. */
export const requireAuth = (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Role-based middleware: requireRole(roleName)
 * - Extracts JWT from auth cookie
 * - Validates token (signature + expiry)
 * - Loads user from DB and checks user.role === roleName (never trust signed auth claims for access control)
 * If role !== required → rejects with 401 Unauthorized.
 * On success sets req.userId, req.userEmail, req.role, req.auth.
 */
export const requireRole = (roleName) => async (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.userId);
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user || user.role !== roleName) {
      return res.status(401).json({ message: "Unauthorized access" });
    }

    req.userId = user.id;
    req.userEmail = user.email;
    req.role = user.role;
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/** Admin-only middleware (alias for requireRole("admin")). */
export const verifyToken = requireRole("admin");

/** Require valid JWT and set req.customerUserId (for customer-only routes like my-orders). */
export const requireCustomerAuth = (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: "Login required" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customerUserId = Number(decoded.userId);
    if (!req.customerUserId) return res.status(401).json({ message: "Invalid token" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/** Like requireCustomerAuth but verifies DB role is `customer` (excludes admin/driver tokens). */
export const requireCustomerOnly = async (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: "Login required" });
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.userId);
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.role !== "customer") {
      return res.status(403).json({ message: "Only customer accounts can use this feature" });
    }

    req.customerUserId = user.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/** Optionally set req.customerUserId when valid JWT is present (for order creation to link user). */
export const optionalCustomerAuth = (req, res, next) => {
  const token = getAuthToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const id = Number(decoded.userId);
    if (id) req.customerUserId = id;
  } catch (_) {}
  next();
};

/** Optionally set req.isAdmin if valid admin token. Does not fail on missing/invalid token. */
export const optionalAdminAuth = (req, res, next) => {
  const token = getAuthToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.userId);
    if (!userId) return next();
    prisma.user
      .findUnique({ where: { id: userId }, select: { role: true } })
      .then((u) => {
        if (u?.role === "admin") req.isAdmin = true;
      })
      .finally(() => next());
  } catch (_) {
    next();
  }
};
