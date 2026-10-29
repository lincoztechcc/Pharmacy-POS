import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { roundCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "licoz_pos_jwt_super_secret_2026_xK9mP3qR7vN2wL8";

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Acquires a PostgreSQL row-level lock (`SELECT ... FOR UPDATE`) before reading and
 * updating the `sizes` JSON variant stock to prevent race conditions (Lost Updates)
 * when multiple POS terminals sell the same product concurrently.
 */
async function incrementVariantStock(tx: any, productId: string, variantName: string, qtyToAdd: number) {
  const rows: any[] = await tx.$queryRaw`
    SELECT "id", "sizes" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
  `;
  const prod = rows[0];
  if (!prod) return;

  if (prod.sizes) {
    let sizesList = typeof prod.sizes === "string" ? JSON.parse(prod.sizes) : prod.sizes;
    if (Array.isArray(sizesList)) {
      let found = false;
      const updatedSizes = sizesList.map((sz: any) => {
        if (sz.sizeName === variantName) {
          found = true;
          const currentStock = parseInt(sz.stock || "0");
          return { ...sz, stock: String(currentStock + qtyToAdd) };
        }
        return sz;
      });

      if (found) {
        await tx.product.update({
          where: { id: productId },
          data: { 
            sizes: updatedSizes,
            stock: { increment: qtyToAdd }
          }
        });
        return;
      }
    }
  }

  await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: qtyToAdd } }
  });
}

async function decrementVariantStock(tx: any, productId: string, variantName: string, qtyToDeduct: number) {
  const rows: any[] = await tx.$queryRaw`
    SELECT "id", "sizes" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
  `;
  const prod = rows[0];
  if (!prod) return;

  if (prod.sizes) {
    let sizesList = typeof prod.sizes === "string" ? JSON.parse(prod.sizes) : prod.sizes;
    if (Array.isArray(sizesList)) {
      let found = false;
      const updatedSizes = sizesList.map((sz: any) => {
        if (sz.sizeName === variantName) {
          found = true;
          const currentStock = parseInt(sz.stock || "0");
          return { ...sz, stock: String(Math.max(0, currentStock - qtyToDeduct)) };
        }
        return sz;
      });

      if (found) {
        await tx.product.update({
          where: { id: productId },
          data: { 
            sizes: updatedSizes,
            stock: { decrement: qtyToDeduct }
          }
        });
        return;
      }
    }
  }

  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: qtyToDeduct } }
  });
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const { tenantId, role } = decoded;
    if (!tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const showClosed = searchParams.get("showClosed");
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status;

    // Role-based daily closing data separation
    if (showClosed === "true") {
      where.isClosed = true;
    } else if (showClosed === "false") {
      where.isClosed = false;
    } else if (showClosed === "all") {
      // Show both closed and active orders (do not add where.isClosed filter)
    } else if (startDate || endDate) {
      // Show both closed and active orders when filtering by date/month
    } else {
      // Default to active orders only for standard view
      where.isClosed = false;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate + "T00:00:00.000Z");
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate + "T23:59:59.999Z");
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { product: { select: { name: true } } } },
          user: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          table: { select: { name: true } },
          tenant: { select: { name: true, logoUrl: true, ntn: true, strn: true, receiptAddressString: true, receiptWhatsAppString: true, receiptEasyPaisaString: true, receiptJazzCashString: true, receiptRaastString: true, receiptBankString: true, cashierPrinterIp: true, cashierPrinterPort: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const { tenantId, id: userId } = decoded;

    const body = await req.json();
    const { items, totalAmount, paymentMethod, customerId, discount, tax, deliveryCharges, orderType, tableId, riderName, notes, status, paymentStatus, specialInstructions, redeemedPoints } = body;

    // Get the user's branch
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { include: { branches: { take: 1 } } } }
    });

    const branchId = user?.branchId || user?.tenant?.branches?.[0]?.id;
    if (!branchId) {
      return NextResponse.json({ error: "No branch found for this user" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const order = await tx.order.create({
        data: {
          totalAmount: roundCurrency(totalAmount),
          discount: roundCurrency(discount),
          tax: roundCurrency(tax),
          deliveryCharges: roundCurrency(deliveryCharges),
          specialInstructions: specialInstructions || null,
          paymentMethod,
          orderType: orderType || "RETAIL",
          status: status || "COMPLETED",
          paymentStatus: paymentStatus || "PAID",
          riderName: riderName || null,
          notes: notes || null,
          userId,
          tenantId,
          branchId,
          customerId: customerId || null,
          tableId: (tableId && tableId !== "none" && tableId !== "") ? tableId : null,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: roundCurrency(item.price),
              notes: item.notes || null,
            }))
          }
        }
      });

      // Update stock for each product
      for (const item of items) {
        const prod = await tx.product.findUnique({
          where: { id: item.productId },
          include: { dealItems: { include: { product: true } } }
        });

        if (prod?.type === "DEAL" && prod.dealItems && prod.dealItems.length > 0) {
          // If it is a combo deal, deduct stock of the individual products inside it
          for (const di of prod.dealItems) {
            let actualProductId = di.productId;
            let variantName = "";

            if (!actualProductId && di.categoryId) {
              // Generic category ingredient. Let's find which product of this category was chosen
              const catProds = await tx.product.findMany({
                where: { categoryId: di.categoryId }
              });
              // Find the product whose name is listed in the notes
              for (const p of catProds) {
                if (item.notes && item.notes.toLowerCase().includes(p.name.toLowerCase())) {
                  actualProductId = p.id;
                  const regex = new RegExp(`${escapeRegExp(p.name)}\\s*\\(([^)]+)\\)`, "i");
                  const match = item.notes.match(regex);
                  if (match) {
                    variantName = match[1].trim(); // Extract selected size (e.g. "Small")
                  }
                  break;
                }
              }
            } else {
              // Fixed product. Get variant from notes if present
              if (item.notes && di.product) {
                if (item.notes.toLowerCase().includes(di.product.name.toLowerCase())) {
                  const regex = new RegExp(`${escapeRegExp(di.product.name)}\\s*\\(([^)]+)\\)`, "i");
                  const match = item.notes.match(regex);
                  if (match) {
                    variantName = match[1].trim();
                  }
                }
              }
            }

            if (actualProductId) {
              if (variantName) {
                await decrementVariantStock(tx, actualProductId, variantName, di.quantity * item.quantity);
              } else {
                await tx.product.update({
                  where: { id: actualProductId },
                  data: { stock: { decrement: di.quantity * item.quantity } }
                });
              }
            }
          }
        } else {
          // Standard product, deduct variant or main stock
          if (item.notes) {
            await decrementVariantStock(tx, item.productId, item.notes, item.quantity);
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } }
            });
          }
        }
      }

      // Handle loyalty points: deduct redeemed points and award new points for completed purchase
      if (customerId && customerId !== "none") {
        const pointsToRedeem = Math.max(0, parseInt(String(redeemedPoints || "0"), 10));
        const isCompleted = (status || "COMPLETED") === "COMPLETED";
        const earnedPoints = isCompleted ? Math.floor(roundCurrency(totalAmount) / 100) : 0;

        if (pointsToRedeem > 0 || earnedPoints > 0) {
          const cust = await tx.customer.findUnique({
            where: { id: customerId },
            select: { loyaltyPts: true },
          });
          const currentPts = cust?.loyaltyPts || 0;
          const finalPts = Math.max(0, currentPts - pointsToRedeem + earnedPoints);

          await tx.customer.update({
            where: { id: customerId },
            data: { loyaltyPts: finalPts },
          });
        }
      }

      // Update table status if tableId is provided
      if (tableId && tableId !== "none" && tableId !== "") {
        const nextTableStatus = (status || "COMPLETED") === "COMPLETED" ? "AVAILABLE" : "OCCUPIED";
        await tx.table.update({
          where: { id: tableId },
          data: { 
            status: nextTableStatus,
            isFree: nextTableStatus === "AVAILABLE"
          }
        });
      }

      return order;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
