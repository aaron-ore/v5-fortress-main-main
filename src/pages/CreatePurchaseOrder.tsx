"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import CreatePurchaseOrderPageContent from "@/components/orders/CreatePurchaseOrderPageContent"; // Import the new component

const CreatePurchaseOrder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 flex flex-col flex-grow h-full p-6"> {/* Added p-6 for consistent page padding */}
      <h1 className="text-3xl font-bold flex-shrink-0">Create New Purchase Order</h1>
      <p className="text-muted-foreground flex-shrink-0">
        Fill in the details to create a new purchase order.
      </p>
      <CreatePurchaseOrderPageContent onClose={() => navigate("/orders")} />
    </div>
  );
};

export default CreatePurchaseOrder;