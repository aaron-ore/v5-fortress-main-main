"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle, Printer, PackageOpen } from "lucide-react";
import { showError } from "@/utils/toast";
import { useOrders, POItem } from "@/context/OrdersContext";
import { formatPhoneNumber } from "@/utils/formatters";
import InventorySelectionDialog from "@/components/InventorySelectionDialog";
import { InventoryItem } from "@/context/InventoryContext";
import { usePrint } from "@/context/PrintContext";
import { generateQrCodeSvg } from "@/utils/qrCodeGenerator";
import { useCustomers } from "@/context/CustomerContext";
import { useVendors } from "@/context/VendorContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/context/ProfileContext";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableItemRow from "@/components/orders/SortableItemRow";

interface CreatePurchaseOrderPageContentProps {
  onClose: () => void;
}

const CreatePurchaseOrderPageContent: React.FC<CreatePurchaseOrderPageContentProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { addOrder } = useOrders();
  const { initiatePrint } = usePrint();
  const {  } = useCustomers(); // Keep customers for consistency, though not directly used for Purchase
  const { vendors } = useVendors();
  const { profile } = useProfile();

  const orderType: "Purchase" = "Purchase"; // Fixed to Purchase
  const [orderNumber, setOrderNumber] = useState("");
  const [customerSupplierId, setCustomerSupplierId] = useState<string | null>(null);
  const [customerSupplierName, setCustomerSupplierName] = useState("");
  const [customerSupplierEmail, setCustomerSupplierEmail] = useState("");
  const [customerSupplierAddress, setCustomerSupplierAddress] = useState("");
  const [customerSupplierContact, setCustomerSupplierContact] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [terms, setTerms] = useState("Net 30");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([]);
  const [orderQrCodeSvg, setOrderQrCodeSvg] = useState<string | null>(null);
  const [calculatedTotalAmount, setCalculatedTotalAmount] = useState(0);

  const taxRate = 0.05;

  const [isInventorySelectionDialogOpen, setIsInventorySelectionDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (customerSupplierId) {
      const vendor = vendors.find(v => v.id === customerSupplierId);
      if (vendor) {
        setCustomerSupplierName(vendor.name);
        setCustomerSupplierEmail(vendor.email || "");
        setCustomerSupplierAddress(vendor.address || "");
        setCustomerSupplierContact(vendor.phone ? formatPhoneNumber(vendor.phone) : "");
      }
    } else {
      setCustomerSupplierName("");
      setCustomerSupplierEmail("");
      setCustomerSupplierAddress("");
      setCustomerSupplierContact("");
    }
  }, [customerSupplierId, vendors]);

  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + (isNaN(item.quantity) ? 0 : item.quantity) * (isNaN(item.unitPrice) ? 0 : item.unitPrice), 0);
    setCalculatedTotalAmount(subtotal * (1 + taxRate));
  }, [items, taxRate]);

  useEffect(() => {
    const generateQr = async () => {
      if (orderNumber) {
        try {
          const svg = await generateQrCodeSvg(orderNumber, 60);
          setOrderQrCodeSvg(svg);
        } catch (error) {
          console.error("Error generating Order QR code:", error);
          setOrderQrCodeSvg(null);
        }
      } else {
        setOrderQrCodeSvg(null);
      }
    };
    generateQr();
  }, [orderNumber]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1, itemName: "", quantity: 0, unitPrice: 0 },
    ]);
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemChange = (
    id: number,
    field: keyof POItem,
    value: string | number,
  ) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleCustomerSupplierContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setCustomerSupplierContact(formatted);
  };

  const handleAddSelectedInventoryItems = (selectedInventoryItems: InventoryItem[]) => {
    const newOrderItems: POItem[] = selectedInventoryItems.map((invItem) => ({
      id: items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 + Math.random() : 1 + Math.random(),
      itemName: invItem.name,
      quantity: 1,
      unitPrice: invItem.unitCost, // Always unit cost for purchase
      inventoryItemId: invItem.id,
    }));
    setItems((prevItems) => {
      const existingInventoryItemIds = new Set(prevItems.map(item => item.inventoryItemId).filter(Boolean));
      const uniqueNewItems = newOrderItems.filter(newItem => !existingInventoryItemIds.has(newItem.inventoryItemId));
      return [...prevItems, ...uniqueNewItems];
    });
  };

  const handleSubmit = async () => {
    if (!customerSupplierName.trim() || !dueDate || items.some(item => !item.itemName || isNaN(item.quantity) || item.quantity <= 0 || isNaN(item.unitPrice) || item.unitPrice <= 0)) {
      showError(`Please fill in all required Purchase Order details and ensure all items have valid names, quantities, and prices.`);
      return;
    }

    const newOrder = {
      type: orderType,
      customerSupplier: customerSupplierName.trim(),
      date: orderDate,
      status: "New Order" as "New Order",
      totalAmount: calculatedTotalAmount,
      dueDate: dueDate,
      itemCount: items.length,
      notes: notes.trim(),
      orderType: "Wholesale" as "Wholesale", // Fixed to Wholesale for Purchase
      shippingMethod: "Standard" as "Standard",
      items: items,
      terms: terms.trim(),
    };

    try {
      await addOrder(newOrder);
      navigate("/orders");
      onClose();
    } catch (error) {
      // Error handling is already in addOrder context function
    }
  };

  const handlePrintPdf = () => {
    if (!orderNumber || !customerSupplierName.trim() || !dueDate || items.some(item => !item.itemName || isNaN(item.quantity) || item.quantity <= 0 || isNaN(item.unitPrice) || item.unitPrice <= 0)) {
      showError(`Please fill in all required Purchase Order details before generating the PDF.`);
      return;
    }
    if (!profile?.companyProfile) {
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    const commonPdfProps = {
      orderNumber: orderNumber,
      orderDate: orderDate,
      customerSupplierName: customerSupplierName,
      customerSupplierEmail: customerSupplierEmail,
      customerSupplierAddress: customerSupplierAddress,
      customerSupplierContact: customerSupplierContact.replace(/[^\d]/g, ''),
      terms: terms,
      dueDate: dueDate,
      items: items,
      notes: notes,
      taxRate: taxRate,
      companyLogoUrl: profile.companyProfile.companyLogoUrl || undefined,
      orderQrCodeSvg: orderQrCodeSvg,
    };

    initiatePrint({
      type: "purchase-order",
      props: {
        poNumber: commonPdfProps.orderNumber,
        poDate: commonPdfProps.orderDate,
        supplierName: commonPdfProps.customerSupplierName,
        supplierEmail: commonPdfProps.customerSupplierEmail,
        supplierAddress: commonPdfProps.customerSupplierAddress,
        supplierContact: commonPdfProps.customerSupplierContact,
        terms: commonPdfProps.terms,
        dueDate: commonPdfProps.dueDate,
        items: commonPdfProps.items,
        notes: commonPdfProps.notes,
        taxRate: commonPdfProps.taxRate,
        companyLogoUrl: commonPdfProps.companyLogoUrl,
        poQrCodeSvg: commonPdfProps.orderQrCodeSvg,
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="flex flex-col flex-grow overflow-hidden">
      {/* Main Scrollable Area for Form Content - Flexible Height */}
      <ScrollArea className="flex-grow px-6">
        <div className="space-y-6 py-4">
          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">PO Number</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Will be generated on creation"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerSupplierNameSelect">Supplier Name</Label>
                <Select value={customerSupplierId || "none-selected"} onValueChange={setCustomerSupplierId}>
                  <SelectTrigger id="customerSupplierNameSelect">
                    <SelectValue placeholder="Select an existing supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none-selected">Select Supplier</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!customerSupplierId && (
                  <Input
                    id="customerSupplierName"
                    value={customerSupplierName}
                    onChange={(e) => setCustomerSupplierName(e.target.value)}
                    placeholder="Or enter new supplier name"
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerSupplierEmail">Supplier Email</Label>
                <Input
                  id="customerSupplierEmail"
                  type="email"
                  value={customerSupplierEmail}
                  onChange={(e) => setCustomerSupplierEmail(e.target.value)}
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerSupplierContact">Supplier Phone</Label>
                <Input
                  id="customerSupplierContact"
                  type="text"
                  value={customerSupplierContact}
                  onChange={handleCustomerSupplierContactChange}
                  placeholder="e.g., 555-123-4567"
                  maxLength={12}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerSupplierAddress">Supplier Address</Label>
                <Textarea
                  id="customerSupplierAddress"
                  value={customerSupplierAddress}
                  onChange={(e) => setCustomerSupplierAddress(e.target.value)}
                  placeholder="123 Supplier St, City, State, Zip"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderDate">PO Date</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <Input
                  id="terms"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="e.g., Net 30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex items-center justify-between">
                <Label htmlFor="totalAmount" className="text-lg font-bold">Total Amount:</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    ${calculatedTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {orderQrCodeSvg && (
                    <div dangerouslySetInnerHTML={{ __html: orderQrCodeSvg }} className="w-16 h-16 object-contain flex-shrink-0" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4 flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl font-semibold">Items</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setIsInventorySelectionDialogOpen(true)}>
                  <PackageOpen className="h-4 w-4 mr-2" /> Add from Inventory
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <ScrollArea className="h-40 max-h-40 overflow-y-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[20px]"></TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="w-[100px] text-right">Quantity</TableHead>
                        <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                        {items.map((item) => (
                          <SortableItemRow
                            key={item.id}
                            item={item}
                            handleItemChange={handleItemChange}
                            handleRemoveItem={handleRemoveItem}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </ScrollArea>
              </DndContext>
              <div className="flex justify-end items-center mt-4 text-lg font-bold">
                Total Amount: ${calculatedTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col relative min-h-[120px]">
              <ScrollArea className="h-24 max-h-24 overflow-y-auto">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes or instructions here..."
                  rows={4}
                  className="flex-grow"
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Footer Buttons - Fixed Height */}
      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-4 flex-shrink-0 p-6 pt-0">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Create Purchase Order</Button>
        <Button variant="secondary" onClick={handlePrintPdf} disabled={!orderNumber}>
          <Printer className="h-4 w-4 mr-2" /> Print/PDF
        </Button>
      </div>

      <InventorySelectionDialog
        isOpen={isInventorySelectionDialogOpen}
        onClose={() => setIsInventorySelectionDialogOpen(false)}
        onAddItems={handleAddSelectedInventoryItems}
        itemType="purchase"
      />
    </div>
  );
};

export default CreatePurchaseOrderPageContent;