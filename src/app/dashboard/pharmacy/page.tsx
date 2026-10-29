"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pill, Activity, AlertTriangle, Calendar, 
  Package, Search, Plus, Filter, History,
  LayoutGrid, List, ChevronRight, Users,
  ShoppingBag, Trash2, DollarSign, CheckCircle2,
  FileText, ShieldAlert, ArrowRightLeft, CreditCard,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { cn } from "@/lib/utils";

export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState("medicines");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Data States
  const [medicines, setMedicines] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  // Modals States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  
  // Ledger view states
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  
  // Add Supplier form state
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", email: "", address: "" });
  
  // Add Purchase form state
  const [purchaseInvoice, setPurchaseInvoice] = useState("");
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<any[]>([
    { productId: "", quantity: "", costPrice: "", batchNumber: "", expiryDate: "" }
  ]);
  
  const [submitting, setSubmitting] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [medRes, supRes, purRes] = await Promise.all([
        axios.get("/api/products"),
        axios.get("/api/suppliers"),
        axios.get("/api/purchases")
      ]);
      // Filter out deals, only show actual products for medicines
      const meds = Array.isArray(medRes.data) ? medRes.data.filter((p: any) => p.type !== "DEAL") : [];
      setMedicines(meds);
      setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
      setPurchases(Array.isArray(purRes.data) ? purRes.data : []);
    } catch (err) {
      console.error("Pharmacy Data fetch error:", err);
      toast.error("Failed to load pharmacy data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Compute Outstanding Balance for a supplier
  const getSupplierBalance = (supplier: any) => {
    if (!supplier || !supplier.ledger) return 0;
    return supplier.ledger.reduce((sum: number, entry: any) => sum + entry.amount, 0);
  };

  // Open ledger for a supplier
  const handleOpenLedger = async (supplier: any) => {
    setSelectedSupplier(supplier);
    setPaymentAmount("");
    setPaymentDescription("");
    setIsLedgerModalOpen(true);
    try {
      const res = await axios.get(`/api/suppliers/${supplier.id}/ledger`);
      setLedgerEntries(res.data);
    } catch {
      toast.error("Failed to load ledger history");
    }
  };

  // Submit supplier payment
  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !paymentAmount) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/suppliers/${selectedSupplier.id}/ledger`, {
        amount: parseFloat(paymentAmount),
        description: paymentDescription || "Payment made to supplier"
      });
      toast.success("Payment recorded successfully!");
      // Reload details
      const [supRes, ledgerRes] = await Promise.all([
        axios.get("/api/suppliers"),
        axios.get(`/api/suppliers/${selectedSupplier.id}/ledger`)
      ]);
      setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
      setLedgerEntries(ledgerRes.data);
      // Update selectedSupplier details to reflect new balance
      const updatedSup = supRes.data.find((s: any) => s.id === selectedSupplier.id);
      if (updatedSup) setSelectedSupplier(updatedSup);
      
      setPaymentAmount("");
      setPaymentDescription("");
      fetchAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit new supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post("/api/suppliers", newSupplier);
      toast.success("Supplier added successfully!");
      setIsSupplierModalOpen(false);
      setNewSupplier({ name: "", contact: "", email: "", address: "" });
      fetchAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add supplier");
    } finally {
      setSubmitting(false);
    }
  };

  // Manage purchase item rows
  const addPurchaseRow = () => {
    setPurchaseItems([...purchaseItems, { productId: "", quantity: "", costPrice: "", batchNumber: "", expiryDate: "" }]);
  };

  const removePurchaseRow = (idx: number) => {
    if (purchaseItems.length === 1) return;
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const updatePurchaseRow = (idx: number, field: string, value: any) => {
    const copy = [...purchaseItems];
    copy[idx][field] = value;
    setPurchaseItems(copy);
  };

  // Submit new inward purchase
  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupplierId) return toast.error("Please select a supplier");
    
    // Validate rows
    const validItems = purchaseItems.filter(item => item.productId && item.quantity && item.costPrice);
    if (validItems.length === 0) return toast.error("Please add at least one complete item (Medicine, Qty, Cost Price)");

    setSubmitting(true);
    try {
      await axios.post("/api/purchases", {
        supplierId: purchaseSupplierId,
        invoiceNo: purchaseInvoice || `INV-${Date.now().toString().slice(-6)}`,
        items: validItems
      });
      toast.success("Inward purchase & stocks logged successfully!");
      setIsPurchaseModalOpen(false);
      setPurchaseInvoice("");
      setPurchaseSupplierId("");
      setPurchaseItems([{ productId: "", quantity: "", costPrice: "", batchNumber: "", expiryDate: "" }]);
      fetchAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log purchase");
    } finally {
      setSubmitting(false);
    }
  };

  // Filters medicines by Name or Formula
  const filteredMedicines = medicines.filter(med => {
    const medName = med.name || "";
    const medFormula = med.formula || "";
    return medName.toLowerCase().includes(search.toLowerCase()) || medFormula.toLowerCase().includes(search.toLowerCase());
  });

  // Expiry styling
  const getExpiryBadge = (expiryDate: string) => {
    if (!expiryDate) return <Badge className="bg-slate-100 text-slate-600">No Expiry</Badge>;
    const exp = new Date(expiryDate);
    const today = new Date();
    const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
    
    if (exp < today) {
      return <Badge className="bg-rose-100 text-rose-700 border-none font-bold">⚠️ Expired</Badge>;
    } else if (diffMonths <= 6) {
      return <Badge className="bg-amber-100 text-amber-700 border-none font-bold">⏳ Expiring soon ({diffMonths}m)</Badge>;
    } else {
      return <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">🟢 Good (Exp: {exp.toLocaleDateString(undefined, {month: '2-digit', year: 'numeric'})})</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Pill className="w-8 h-8 text-blue-600 animate-pulse" /> Medical & Pharmacy Dashboard
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Add inward supply shipments, settle supplier ledgers, and manage stock batches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => setIsPurchaseModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-14 px-6 font-black text-sm shadow-xl shadow-blue-100 transition-all flex items-center"
          >
            <ShoppingBag className="mr-2 w-5 h-5" /> Inward Medicine Supply
          </Button>
          <Button 
            onClick={() => setIsSupplierModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 px-6 font-black text-sm shadow-xl shadow-emerald-100 transition-all flex items-center"
          >
            <Users className="mr-2 w-5 h-5" /> Add Supplier Vendor
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1.5 rounded-2xl mb-6 flex flex-row flex-wrap items-center w-fit h-auto gap-1">
          <TabsTrigger value="medicines" className="rounded-xl px-6 py-2.5 font-bold text-sm tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <Pill className="w-4 h-4 mr-2 inline-block" /> Medicines Catalog
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-6 py-2.5 font-bold text-sm tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <Package className="w-4 h-4 mr-2 inline-block" /> Stock & Batches
          </TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-xl px-6 py-2.5 font-bold text-sm tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <History className="w-4 h-4 mr-2 inline-block" /> Inward Shipments log
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-xl px-6 py-2.5 font-bold text-sm tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <CreditCard className="w-4 h-4 mr-2 inline-block" /> Supplier Ledgers
          </TabsTrigger>
        </TabsList>

        {/* Medicines Catalog Tab */}
        <TabsContent value="medicines" className="space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="relative group w-full max-w-md">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  placeholder="Search medicine by name or formula salt..."
                  className="pl-12 h-12 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-44 rounded-[2rem] bg-slate-50 animate-pulse border border-slate-100" />
                  ))}
                </div>
              ) : filteredMedicines.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 font-medium">
                  <Pill className="w-8 h-8 opacity-20 mb-2" />
                  <p>No medicines found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredMedicines.map((med) => (
                    <motion.div
                      key={med.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-[2rem] border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/20 transition-all flex flex-col justify-between h-44"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5" />
                        </div>
                        <Badge className={med.stock > 10 ? "bg-emerald-50 text-emerald-700" : med.stock > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}>
                          {med.stock > 0 ? `${med.stock} Units` : "Out of Stock"}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <h3 className="font-black text-slate-900 line-clamp-1 leading-tight text-base">{med.name}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1 truncate" title={med.formula || "No salt description"}>
                          🧪 {med.formula || "No Generic Salt formulation"}
                        </p>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Category: {med.category?.name || "Uncategorized"}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-sm font-black text-blue-600">PKR {parseFloat(med.price).toFixed(2)}</span>
                        {med.costPrice && <span className="text-[10px] text-slate-400 font-bold">Cost: PKR {parseFloat(med.costPrice).toFixed(2)}</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Detailed Stock & Batches Tab */}
        <TabsContent value="stock" className="space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="relative group w-full max-w-md">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  placeholder="Search batches by medicine or formula..."
                  className="pl-12 h-12 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-5 px-6 font-bold text-slate-700 min-w-[200px]">Medicine Info</TableHead>
                    <TableHead className="font-bold text-slate-700 min-w-[150px]">Generic Formula</TableHead>
                    <TableHead className="font-bold text-slate-700 min-w-[100px]">Total Stock</TableHead>
                    <TableHead className="font-bold text-slate-700 min-w-[280px]">Active Batches & Expiry Dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-medium">Loading stock batches...</TableCell>
                    </TableRow>
                  ) : filteredMedicines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-medium">No pharmacy stocks available.</TableCell>
                    </TableRow>
                  ) : (
                    filteredMedicines.map((med) => (
                      <TableRow key={med.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <Pill className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{med.name}</p>
                              <p className="text-xs text-slate-400 font-semibold">{med.category?.name || "Uncategorized"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-600">
                          {med.formula || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("px-2.5 py-1 rounded-lg font-bold border", 
                            med.stock > 10 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : med.stock > 0 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-rose-50 text-rose-700 border-rose-100"
                          )}>
                            {med.stock} Units
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 pr-6">
                          {med.batches && med.batches.length > 0 ? (
                            <div className="flex flex-col gap-1.5 max-w-md">
                              {med.batches.map((batch: any) => (
                                <div key={batch.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                                  <span className="text-slate-700">Batch: #{batch.batchNumber}</span>
                                  <span className="text-blue-600">{batch.quantity} Units</span>
                                  <span>{getExpiryBadge(batch.expiryDate)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold">No active tracked batches. Add stock via inward purchase tab.</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Inward Shipments Log Tab */}
        <TabsContent value="purchases" className="space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-5 px-6 font-bold text-slate-700">Invoice No</TableHead>
                    <TableHead className="font-bold text-slate-700">Supplier Vendor</TableHead>
                    <TableHead className="font-bold text-slate-700">Medicines Purchased</TableHead>
                    <TableHead className="font-bold text-slate-700">Total Purchase Amount</TableHead>
                    <TableHead className="font-bold text-slate-700">Date Logged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-slate-400 font-medium">Loading shipments log...</TableCell>
                    </TableRow>
                  ) : purchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-slate-400 font-medium">No supply invoices logged yet.</TableCell>
                    </TableRow>
                  ) : (
                    purchases.map((purchase) => (
                      <TableRow key={purchase.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-4 px-6 font-black text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" /> {purchase.invoiceNo || "N/A"}
                        </TableCell>
                        <TableCell className="font-bold text-slate-700">
                          {purchase.supplier?.name || "Deleted Supplier"}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            {purchase.items?.map((item: any) => (
                              <span key={item.id} className="text-xs text-slate-500 font-semibold">
                                • {item.product?.name} (Qty: {item.quantity}) {item.batchNumber ? `[Batch: ${item.batchNumber}]` : ""}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-slate-900">
                          PKR {parseFloat(purchase.totalAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-bold text-slate-400 text-xs">
                          {new Date(purchase.createdAt).toLocaleDateString()} {new Date(purchase.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Supplier Ledgers Tab */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-5 px-6 font-bold text-slate-700">Supplier Name</TableHead>
                    <TableHead className="font-bold text-slate-700">Contact Details</TableHead>
                    <TableHead className="font-bold text-slate-700">Outstanding Balance</TableHead>
                    <TableHead className="text-right font-bold text-slate-700 px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-medium">Loading suppliers...</TableCell>
                    </TableRow>
                  ) : suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-medium">No suppliers added yet.</TableCell>
                    </TableRow>
                  ) : (
                    suppliers.map((sup) => {
                      const balance = getSupplierBalance(sup);
                      return (
                        <TableRow key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-black text-slate-900">{sup.name}</p>
                                <p className="text-xs text-slate-400 font-semibold">{sup.address || "No address listed"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-slate-600">
                            <div>{sup.contact || "—"}</div>
                            <div className="text-[10px] text-slate-400">{sup.email || ""}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("px-3 py-1 rounded-xl font-bold border text-sm", 
                              balance > 0 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            )}>
                              {balance > 0 ? `We owe: PKR ${balance.toFixed(2)}` : "Settled / No Dues"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button 
                              onClick={() => handleOpenLedger(sup)}
                              className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl h-10 px-4 font-black text-xs transition-all"
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-2" /> View Account Ledger
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Supplier Modal Dialog */}
      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] p-8 border-none bg-white shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-600" /> Add Supplier Vendor
            </DialogTitle>
            <p className="text-slate-400 font-bold text-xs mt-1">Register a supplier vendor to log inward medicine shipments and manage ledgers.</p>
          </DialogHeader>
          <form onSubmit={handleAddSupplier} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier Name *</label>
              <Input required placeholder="e.g. Novartis Pharma" className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold px-4"
                value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
              <Input placeholder="e.g. +923000000000" className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold px-4"
                value={newSupplier.contact} onChange={e => setNewSupplier({ ...newSupplier, contact: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <Input placeholder="e.g. contact@supplier.com" className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold px-4"
                value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Office Address</label>
              <Input placeholder="e.g. Plot 12, Industrial Area, Lahore" className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold px-4"
                value={newSupplier.address} onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })} />
            </div>
            <div className="pt-4 flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsSupplierModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg shadow-emerald-50">
                {submitting ? "Saving..." : "Save Supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inward Purchase Modal Dialog */}
      <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <DialogContent className="sm:max-w-[750px] rounded-[32px] p-0 border-none bg-white shadow-2xl overflow-hidden">
          <div className="p-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-blue-600" /> Log Inward Medicine Supply
              </DialogTitle>
              <p className="text-slate-400 font-bold text-xs mt-1">Log newly received shipments, update inventory stocks, batch numbers, and supplier ledger dues.</p>
            </DialogHeader>
            <form onSubmit={handleAddPurchase} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose Supplier Vendor *</label>
                  <select 
                    required
                    className="w-full h-12 rounded-xl bg-slate-50 border border-slate-100 px-4 focus:bg-white transition-all outline-none font-bold text-sm"
                    value={purchaseSupplierId}
                    onChange={e => setPurchaseSupplierId(e.target.value)}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice / Reference No</label>
                  <Input placeholder="e.g. NOV-88421" className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold px-4"
                    value={purchaseInvoice} onChange={e => setPurchaseInvoice(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Purchase Items & Stock Levels</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addPurchaseRow} className="h-8 px-3 rounded-lg text-xs font-bold border-slate-200">
                    + Add Product Row
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {purchaseItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 items-end sm:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <div className="flex-[2.5] w-full text-left">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Medicine *</label>
                        <select
                          required
                          className="w-full h-10 rounded-lg bg-white border border-slate-100 px-2 outline-none font-bold text-xs"
                          value={item.productId}
                          onChange={e => updatePurchaseRow(idx, "productId", e.target.value)}
                        >
                          <option value="">-- Choose Med --</option>
                          {medicines.map(m => <option key={m.id} value={m.id}>{m.name} {m.formula ? `(${m.formula})` : ""}</option>)}
                        </select>
                      </div>

                      <div className="flex-[1.5] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Batch No</label>
                        <Input placeholder="BCH-99" className="h-10 rounded-lg bg-white border-slate-100 font-bold px-2 text-xs"
                          value={item.batchNumber} onChange={e => updatePurchaseRow(idx, "batchNumber", e.target.value)} />
                      </div>

                      <div className="flex-[1.5] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Expiry Date</label>
                        <Input type="date" className="h-10 rounded-lg bg-white border-slate-100 font-bold px-2 text-xs"
                          value={item.expiryDate} onChange={e => updatePurchaseRow(idx, "expiryDate", e.target.value)} />
                      </div>

                      <div className="flex-[1.2] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Cost Price *</label>
                        <Input required type="number" placeholder="Cost" className="h-10 rounded-lg bg-white border-slate-100 font-bold px-2 text-xs"
                          value={item.costPrice} onChange={e => updatePurchaseRow(idx, "costPrice", e.target.value)} />
                      </div>

                      <div className="flex-[1] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Qty *</label>
                        <Input required type="number" placeholder="Qty" className="h-10 rounded-lg bg-white border-slate-100 font-bold px-2 text-xs"
                          value={item.quantity} onChange={e => updatePurchaseRow(idx, "quantity", e.target.value)} />
                      </div>

                      <Button type="button" variant="ghost" onClick={() => removePurchaseRow(idx)} className="h-10 w-10 text-rose-500 rounded-lg p-0 hover:bg-rose-50 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsPurchaseModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancel</Button>
                <Button type="submit" disabled={submitting} className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-50">
                  {submitting ? "Logging Shipment..." : "Record Inward Shipment"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Ledger Drawer Modal Dialog */}
      <Dialog open={isLedgerModalOpen} onOpenChange={setIsLedgerModalOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-[32px] p-0 border-none bg-white shadow-2xl overflow-hidden">
          <div className="p-8 max-h-[90vh] overflow-y-auto space-y-6">
            <DialogHeader className="flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <ArrowRightLeft className="w-6 h-6 text-blue-600" /> Account Ledger History
                </DialogTitle>
                <p className="text-xs font-bold text-slate-400 mt-1">Supplier: {selectedSupplier?.name}</p>
              </div>
              <Badge className={cn("px-4 py-2 rounded-2xl font-black text-sm border", 
                selectedSupplier && getSupplierBalance(selectedSupplier) > 0 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
              )}>
                {selectedSupplier && getSupplierBalance(selectedSupplier) > 0 ? `We owe: PKR ${getSupplierBalance(selectedSupplier).toFixed(2)}` : "Balance Settled"}
              </Badge>
            </DialogHeader>

            {/* Post Payment Mini-Form */}
            <form onSubmit={handlePostPayment} className="p-5 rounded-2xl bg-slate-50 border border-slate-100/60 space-y-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Settle Dues / Record Payment
              </h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-[1.5]">
                  <Input required type="number" placeholder="Payment Amount (PKR) *" className="h-10 rounded-xl bg-white border-slate-100 font-bold px-3 text-xs"
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>
                <div className="flex-[2.5]">
                  <Input placeholder="Description (e.g. Settle Invoice NOV-102)" className="h-10 rounded-xl bg-white border-slate-100 font-bold px-3 text-xs"
                    value={paymentDescription} onChange={e => setPaymentDescription(e.target.value)} />
                </div>
                <Button type="submit" disabled={submitting || !paymentAmount} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 font-black text-xs shrink-0 shadow-md">
                  {submitting ? "Posting..." : "Record Payment"}
                </Button>
              </div>
            </form>

            {/* Ledger Transactions list */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Transaction Log</h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 py-3 text-xs">Date</TableHead>
                      <TableHead className="font-bold text-slate-700 text-xs">Description</TableHead>
                      <TableHead className="font-bold text-slate-700 text-xs">Type</TableHead>
                      <TableHead className="font-bold text-slate-700 text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-slate-400 text-xs">No transactions in this account.</TableCell>
                      </TableRow>
                    ) : (
                      ledgerEntries.map((entry) => (
                        <TableRow key={entry.id} className="text-xs font-bold hover:bg-slate-50">
                          <TableCell className="text-slate-400 py-2.5">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-slate-700 font-semibold">{entry.description}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-[9px] border-none font-bold", 
                              entry.type === "PURCHASE" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                            )}>
                              {entry.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-black", 
                            entry.amount > 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {entry.amount > 0 ? `+` : ``}{entry.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setIsLedgerModalOpen(false)} className="h-10 px-5 rounded-xl font-bold border-slate-200">Close Ledger</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
