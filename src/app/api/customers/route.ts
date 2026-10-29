import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { roundCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

function getAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const decoded = getAuth(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = decoded;

  try {
    // Fetch customers and SQL-level grouped spend totals in parallel
    // instead of loading all historical orders per customer into memory
    const [customers, spendByCustomer] = await Promise.all([
      prisma.customer.findMany({
        where: { tenantId },
        include: {
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          tenantId,
          status: "COMPLETED",
          customerId: { not: null },
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const spendMap = new Map<string, number>();
    for (const row of spendByCustomer) {
      if (row.customerId) {
        spendMap.set(row.customerId, roundCurrency(row._sum.totalAmount));
      }
    }

    const enriched = customers.map((c: any) => ({
      ...c,
      totalSpent: spendMap.get(c.id) || 0,
      orderCount: c._count.orders,
    }));

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const decoded = getAuth(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = decoded;

  try {
    const body = await req.json();
    const { name, phone, email } = body;

    const customer = await prisma.customer.create({
      data: { name, phone, email, tenantId },
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
