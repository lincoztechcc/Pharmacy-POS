import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const SETUP_SECRET = process.env.SETUP_SECRET || "licoz-setup-init-2026";
const SUPER_ADMIN_EMAIL = "linoctech@gmail.com";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    // 1. Modules — Pharmacy POS & Addon Modules
    const moduleList = [
      { name: "POS_BASIC", description: "Standard POS Billing & Sales" },
      { name: "PHARMACY_SPECIAL", description: "Medicine Database, Expiry Alerts & Batch Mgmt" },
      { name: "INVENTORY_ADVANCED", description: "Stock, Batch Tracking, Expiry & Warehouse" },
      { name: "HR_PAYROLL", description: "Employee Attendance, Shift & Salary Management" },
      { name: "ACCOUNTING_PRO", description: "Full Ledgers, P&L, Cash Flow & Tax Reports" },
      { name: "CRM_LOYALTY", description: "Customer Loyalty, History & Notifications" },
      { name: "MULTI_BRANCH", description: "Branch Transfers, Centralized Inventory & Reports" },
      { name: "ANALYTICS_AI", description: "Advanced Sales Forecasting & AI Analytics" },
    ];

    const createdModules: any[] = [];
    for (const mod of moduleList) {
      let m = await prisma.module.findFirst({ where: { name: mod.name } });
      if (!m) {
        m = await prisma.module.create({ data: mod });
      } else {
        m = await prisma.module.update({ where: { id: m.id }, data: { description: mod.description } });
      }
      createdModules.push(m);
    }

    // 2. Plans — Monthly, 6 Months, and Yearly
    const planList = [
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
        moduleNames: moduleList.map((m) => m.name),
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
        moduleNames: moduleList.map((m) => m.name),
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
        moduleNames: moduleList.map((m) => m.name),
      },
    ];

    for (const planData of planList) {
      const { moduleNames, ...data } = planData;

      let plan = await prisma.subscriptionPlan.findFirst({ where: { name: planData.name } });
      if (!plan) {
        plan = await prisma.subscriptionPlan.create({ data });
      } else {
        plan = await prisma.subscriptionPlan.update({
          where: { id: plan.id },
          data: { price: data.price, features: data.features },
        });
      }

      for (const modName of moduleNames) {
        const mod = createdModules.find((m) => m.name === modName);
        if (!mod) continue;
        const existing = await prisma.planModule.findFirst({
          where: { planId: plan.id, moduleId: mod.id },
        });
        if (!existing) {
          await prisma.planModule.create({ data: { planId: plan.id, moduleId: mod.id } });
        }
      }
    }

    // 3. Super Admin
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Lincoz@Tech-2";
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    const existing = await prisma.user.findFirst({ where: { email: SUPER_ADMIN_EMAIL } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: SUPER_ADMIN_EMAIL,
          password: hashedPassword,
          name: "Lincoz Tech",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashedPassword, role: "SUPER_ADMIN", status: "ACTIVE" },
      });
    }

    return NextResponse.json({
      message: "System initialized successfully",
      modulesCount: createdModules.length,
      plansCount: planList.length,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
