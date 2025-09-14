import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { POItem } from "@/context/OrdersContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemRowProps {
  item: POItem;
  handleItemChange: (id: number, field: keyof POItem, value: string | number) => void;
  handleRemoveItem: (id: number) => void;
}

const SortableItemRow: React.FC<SortableItemRowProps> = ({ item, handleItemChange, handleRemoveItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className="relative group">
      <TableCell className="w-[20px] cursor-grab" {...listeners}>
        <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">⠿</span>
      </TableCell>
      <TableCell>
        <Input
          value={item.itemName}
          onChange={(e) =>
            handleItemChange(item.id, "itemName", e.target.value)
          }
          placeholder="Product Name"
          className="min-w-[120px]"
        />
      </TableCell>
      <TableCell className="text-right w-[100px]">
        <Input
          type="number"
          value={item.quantity === 0 ? "" : String(item.quantity)}
          onChange={(e) =>
            handleItemChange(
              item.id,
              "quantity",
              parseInt(e.target.value || '0'),
            )
          }
          min="0"
          className="min-w-[60px]"
        />
      </TableCell>
      <TableCell className="text-right w-[120px]">
        <Input
          type="number"
          value={item.unitPrice === 0 ? "" : String(item.unitPrice)}
          onChange={(e) =>
            handleItemChange(
              item.id,
              "unitPrice",
              parseFloat(e.target.value || '0'),
            )
          }
          step="0.01"
          min="0"
          className="min-w-[80px]"
        />
      </TableCell>
      <TableCell className="text-right font-semibold w-[120px]">
        ${(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="w-[50px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleRemoveItem(item.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default SortableItemRow;