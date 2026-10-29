import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { roundCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const tenantId = decoded.tenantId;

    if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 403 });

    const now = new Date();

    // Execute all database aggregations in parallel directly inside PostgreSQL
    // instead of loading thousands of orders into Node.js memory
    const [todayStats, monthStats, totalProducts, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: startOfDay(now),
            lte: endOfDay(now),
          },
          status: "COMPLETED",
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: startOfMonth(now),
            lte: endOfMonth(now),
          },
          status: "COMPLETED",
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.product.count({ where: { tenantId } }),
      prisma.order.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          user: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      todayRevenue: roundCurrency(todayStats._sum.totalAmount),
      todayOrdersCount: todayStats._count._all,
      monthRevenue: roundCurrency(monthStats._sum.totalAmount),
      monthOrdersCount: monthStats._count._all,
      totalProducts,
      recentOrders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
