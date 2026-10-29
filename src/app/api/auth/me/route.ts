import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { getCachedUser, setCachedUser } from "@/lib/user-cache";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Check fast server-side in-memory cache first
    const cached = getCachedUser(userId);
    if (cached && !decoded.isImpersonated) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
          "X-User-Cache": "HIT",
        },
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        tenant: {
          include: {
            modules: {
              include: {
                module: true
              }
            },
            subscription: {
              include: {
                plan: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: user.tenant,
      isImpersonated: Boolean(decoded.isImpersonated),
      impersonatorEmail: decoded.impersonatorEmail || null,
    };

    // Cache user profile in memory
    if (!decoded.isImpersonated) {
      setCachedUser(userId, userData);
    }

    return NextResponse.json(userData, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        "X-User-Cache": "MISS",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
