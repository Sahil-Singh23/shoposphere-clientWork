import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import passport  from 'passport';
import GoogleStrategy  from 'passport-google-oidc';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "shoposphere_auth";
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
};

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.split("=");
    const key = rawKey?.trim();
    if (key !== name) continue;
    const value = rawValueParts.join("=").trim();
    return value ? decodeURIComponent(value) : null;
  }

  return null;
}

function getAuthToken(req) {
  return getCookieValue(req, AUTH_COOKIE_NAME) || null;
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: undefined,
  });
}

async function getUserForAuthToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
 
  const userId = Number(decoded.userId);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  if (!user) return null;
  return { decoded, user };
}

// Configure Google OAuth strategy
passport.use('google', new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3004/auth/login/federated/google/callback',
  scope: ['profile', 'email']
}, async (issuer, profile, done) => {
  try {
    console.log('Google OAuth profile:', profile);
    
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const googleId = profile.id;
    
    if (!email) {
      return done(new Error('No email found in Google profile'), null);
    }
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });
    
    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId }
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: normalizeEmail(email),
          name: name || email.split('@')[0],
          googleId,
          role: 'customer',
          password: null // No password for OAuth users
        }
      });
    }
    
    return done(null, user);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Passport serialization for sessions
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const normalizeEmail = (v) => (v || "").replace(/^["']|["']$/g, "").trim().toLowerCase();

// POST /auth/signup — customer signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const trimmedName = (name || "").trim();
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedName) return res.status(400).json({ error: "Name is required" });
    if (!normalizedEmail) return res.status(400).json({ error: "Email is required" });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: "customer",
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    setAuthCookie(res, token);

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? undefined },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message || "Signup failed" });
  }
});

// POST /auth/login — single path: find user by email, verify password, issue JWT with role (admin/driver/customer)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const rawPassword = (password || "").replace(/^["']|["']$/g, "").trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(401).json({ error: "Invalid email or password", message: "Invalid email or password" });

    const match = await bcrypt.compare(rawPassword, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password", message: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    setAuthCookie(res, token);

    if (user.role === "admin") {
      return res.json({
        user: { id: user.id, email: user.email, isAdmin: true, role: "admin" },
      });
    }

    if (user.role === "driver") {
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
          role: "driver",
        },
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? undefined,
        role: "customer",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me — validate auth cookie and return user (role from DB; never trust signed auth claims for access control)
router.get("/me", async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    const authData = await getUserForAuthToken(token);
    if (!authData) return res.status(401).json({ error: "Invalid token" });

    const { user } = authData;

    if (user.role === "admin") {
      return res.json({ user: { id: user.id, email: user.email, isAdmin: true, role: "admin" } });
    }

    if (user.role === "driver") {
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
          createdAt: user.createdAt,
          role: "driver",
        },
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? undefined,
        createdAt: user.createdAt,
        role: "customer",
      },
    });
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /auth/verify — admin-only token verification (used by admin dashboard)
router.get("/verify", async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: "No token provided" });

    const authData = await getUserForAuthToken(token);
    if (!authData) return res.status(401).json({ message: "Invalid or expired token" });

    const { user } = authData;
    if (user.role !== "admin") {
      return res.status(401).json({ message: "Unauthorized access" });
    }

    res.json({ valid: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

router.post("/logout", async (_req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true });
});

// Google OAuth routes
router.get('/login/federated/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google OAuth callback
router.get('/login/federated/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      setAuthCookie(res, token);
      
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendURL}/auth/callback`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendURL}/auth/callback?message=${encodeURIComponent('Authentication failed')}`);
    }
  }
);

export default router;
