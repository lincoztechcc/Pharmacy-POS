import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

function getAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
}

// GET all plans — readable by any authenticated user
export async function GET(req: NextRequest) {
  const decoded = getAuth(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let plans = await prisma.subscriptionPlan.findMany({
      include: {
        modules: { include: { module: true } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { price: "asc" },
    });

    // Auto-seed default Monthly, 6 Months, and Yearly plans if database is empty
    if (plans.length === 0) {
      const defaultModules = [
        { name: "POS_BASIC", description: "Standard POS Billing & Sales" },
        { name: "PHARMACY_SPECIAL", description: "Medicine Database, Expiry Alerts & Batch Mgmt" },
        { name: "INVENTORY_ADVANCED", description: "Stock, Batch Tracking, Expiry & Warehouse" },
        { name: "HR_PAYROLL", description: "Employee Attendance, Shift & Salary Management" },
        { name: "ACCOUNTING_PRO", description: "Full Ledgers, P&L, Cash Flow & Tax Reports" },
        { name: "CRM_LOYALTY", description: "Customer Loyalty, History & Notifications" },
        { name: "MULTI_BRANCH", description: "Branch Transfers, Centralized Inventory & Reports" },
        { name: "ANALYTICS_AI", description: "Advanced Sales Forecasting & AI Analytics" },
      ];

      const seededModules: any[] = [];
      for (const mod of defaultModules) {
        let m = await prisma.module.findUnique({ where: { name: mod.name } });
        if (!m) {
          m = await prisma.module.create({ data: mod });
        }
        seededModules.push(m);
      }

      const defaultPlans = [
        {
          name: "Monthly Plan",
          price: 5000,
          billingType: "MONTHLY",
          features: [
            "Pharmacy POS & Billing",
            "Medicine & Formula Catalog",
            "Batch & Expiry Alerts",
            "Supplier Ledgers & Inward Supply",
          ],
        },
        {
          name: "6 Months Plan",
          price: 25000,
          billingType: "6_MONTHS",
          features: [
            "Pharmacy POS & Billing",
            "Medicine & Formula Catalog",
            "Batch & Expiry Alerts",
            "Supplier Ledgers & Inward Supply",
            "Accounting, HR & CRM Modules",
          ],
        },
        {
          name: "Yearly Plan",
          price: 45000,
          billingType: "YEARLY",
          features: [
            "All Pharmacy POS Features",
            "Unlimited Branches & Users",
            "Batch, Expiry & Supplier Ledgers",
            "Full Accounting, HR & AI Analytics",
            "Priority Support",
          ],
        },
      ];

      for (const p of defaultPlans) {
        const createdPlan = await prisma.subscriptionPlan.create({ data: p });
        await prisma.planModule.createMany({
          data: seededModules.map((mod) => ({
            planId: createdPlan.id,
            moduleId: mod.id,
          })),
          skipDuplicates: true,
        });
      }

      plans = await prisma.subscriptionPlan.findMany({
        include: {
          modules: { include: { module: true } },
          _count: { select: { subscriptions: true } },
        },
        orderBy: { price: "asc" },
      });
    }

    return NextResponse.json(plans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create new plan — super admin only
export async function POST(req: NextRequest) {
  const decoded = getAuth(req);
  if (!decoded || decoded.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, price, billingType, features } = await req.json();
    if (!name || price == null || !billingType)
      return NextResponse.json({ error: "name, price, billingType required" }, { status: 400 });

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: name.trim(),
        price: parseFloat(price),
        billingType,
        features: Array.isArray(features) ? features.filter(Boolean) : [],
      },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ error: "Plan name already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
