# Lincoz Pharmacy POS

Standalone **Multi-Tenant SaaS Pharmacy & Medical POS** extracted from Lincoz General POS.

## Key Pharmacy Features
- **Pharmacy Control Center (`/dashboard`)**: Real-time prescription & medicine sales overview.
- **Pharmacy POS (`/dashboard/pos`)**:
  - Fast barcode & generic salt/formula (`formula`) search.
  - Dedicated **Pharmacy Cash Receipt** with generic salt formulations and medical refund disclaimers.
- **Medical & Pharmacy Management (`/dashboard/pharmacy`)**:
  - **Medicines Catalog**: Manage medicines, generic salt formulations, categories, cost prices, and retail prices.
  - **Stock & Batches**: Track batch numbers (`batchNumber`), quantities, and color-coded expiry alerts (**Expired**, **Expiring soon ≤6m**, **Good**).
  - **Inward Shipments Log**: Record supplier invoices (`INV-...`), auto-increment stock & batch quantities, and log stock movements.
  - **Supplier Ledgers**: Track pharmaceutical vendor payables, record payments, and audit transaction history.
- **Medicines Catalog & Inventory (`/dashboard/inventory`)**: Bulk CSV import/export of medicines with formulas, low-stock alerts, and waste/expired stock write-offs.
- **Super Admin SaaS Portal (`/admin-dashboard`, `/tenants`, `/subscriptions`, `/modules`)**: Multi-tenant pharmacy onboarding, branch management, subscription plans, and addon controls (`INVENTORY_ADVANCED`, `CRM_LOYALTY`, `ANALYTICS_AI`, `HR_PAYROLL`, `ACCOUNTING_PRO`, `MULTI_BRANCH`).

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and configure your PostgreSQL `DATABASE_URL` and `JWT_SECRET`.

3. **Generate Prisma client & push schema**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
