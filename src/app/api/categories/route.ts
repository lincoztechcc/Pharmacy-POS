import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

import { requireTenantUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = requireTenantUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const categories = await prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("GET Categories Error:", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = requireTenantUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, description } = await req.json();
    const category = await prisma.category.create({
      data: { name, description, tenantId: user.tenantId } as any,
    });
    return NextResponse.json(category);
  } catch (error: any) {
    console.error("POST Category Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
