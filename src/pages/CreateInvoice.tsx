"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CreateOrderDialogContent from "@/components/orders/CreateOrderDialogContent"; // Import the refactored component

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();

  // This page now simply renders the CreateOrderDialogContent
  // and sets the initial order type to Sales.
  // The dialog itself handles the form logic and submission.

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Create New Invoice</h1>
      <p className="text-muted-foreground">
        Fill in the details to create a new sales order.
      </p>
      <CreateOrderDialogContent onClose={() => navigate("/orders")} />
    </div>
  );
};

export default CreateInvoice;