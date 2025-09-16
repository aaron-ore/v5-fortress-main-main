"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CreateOrderDialogContent from "@/components/orders/CreateOrderDialogContent"; // Import the refactored component

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 flex flex-col flex-grow h-full"> {/* Added h-full */}
      <h1 className="text-3xl font-bold flex-shrink-0">Create New Invoice</h1>
      <p className="text-muted-foreground flex-shrink-0">
        Fill in the details to create a new sales order.
      </p>
      <CreateOrderDialogContent onClose={() => navigate("/orders")} />
    </div>
  );
};

export default CreateInvoice;