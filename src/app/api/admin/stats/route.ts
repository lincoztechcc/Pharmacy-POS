import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { roundCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireSuperAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Fetch all required super-admin metrics in parallel instead of 7 sequential DB round-trips
    const [totalTenants, activeModules, recentTenants, allSubscriptions] = await Promise.all([
      prisma.tenant.count(),
      prisma.module.count({ where: { isActive: true } }),
      prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { subscription: { include: { plan: true } } },
      }),
      prisma.subscription.findMany({
        include: { plan: { select: { price: true } } },
      }),
    ]);

    const monthlyRevenue = roundCurrency(
      allSubscriptions
        .filter((sub: any) => sub.status === "ACTIVE")
        .reduce((acc: number, sub: any) => acc + (sub.plan?.price || 0), 0)
    );

    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueHistory = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const revenue = allSubscriptions
        .filter((sub: any) => new Date(sub.startDate) <= end && new Date(sub.endDate) >= start)
        .reduce((acc: number, sub: any) => acc + (sub.plan?.price || 0), 0);

      revenueHistory.push({
        month: months[monthDate.getMonth()],
        revenue: roundCurrency(revenue),
      });
    }

    return NextResponse.json({
      totalTenants,
      monthlyRevenue,
      activeModules,
      systemHealth: "99.9%",
      recentTenants,
      revenueHistory,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
