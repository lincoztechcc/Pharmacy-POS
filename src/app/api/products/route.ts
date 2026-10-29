import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { requireTenantUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

export async function GET(req: NextRequest) {
  try {
    const user = requireTenantUser(req);
    if (!user) {
      console.warn("GET Products: Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized: Please log in again." }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { tenantId: user.tenantId },
      include: {
        category: true,
        batches: {
          orderBy: { expiryDate: "asc" },
        },
        dealItems: {
          include: {
            product: true,
            category: true,
          },
        },
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("GET Products Critical Error:", error);
    return NextResponse.json({
      error: "Database error while fetching products.",
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = requireTenantUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, price, categoryId, sku, barcode, stock, image, sizes, formula, type, unit } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: "Product name is required." }, { status: 400 });
    }
    const hasSizes = sizes !== undefined && sizes !== null && sizes !== "" && !(Array.isArray(sizes) && sizes.length === 0);
    const parsedSizes = hasSizes ? (typeof sizes === "string" ? JSON.parse(sizes) : sizes) : null;

    // If sizes are not provided, price and stock become required
    if (!hasSizes) {
      if (price === undefined || price === "" || price === null) {
        return NextResponse.json({ error: "Price is required when sizes are not provided." }, { status: 400 });
      }
      if (stock === undefined || stock === "" || stock === null) {
        return NextResponse.json({ error: "Stock is required when sizes are not provided." }, { status: 400 });
      }
    }

    let computedStock = stock === undefined || stock === "" || stock === null ? 0 : parseFloat(stock);
    let computedPrice = price === undefined || price === "" || price === null ? 0 : parseFloat(price);

    if (hasSizes && Array.isArray(parsedSizes)) {
      computedStock = parsedSizes.reduce((acc: number, s: any) => acc + (parseFloat(s.stock) || 0), 0);
      if (parsedSizes.length > 0) {
        computedPrice = parseFloat(parsedSizes[0].price) || 0;
      }
    }

    // Build data payload
    const data: any = {
      name,
      price: computedPrice,
      stock: computedStock,
      categoryId: categoryId || undefined,
      sku,
      barcode,
      image,
      formula,
      type: type || "STANDARD",
      unit: unit || "PCS",
    };
    if (hasSizes) {
      data.sizes = parsedSizes;
    }
    data.tenantId = user.tenantId;
    const product = await prisma.product.create({
      data,
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("POST Product Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
