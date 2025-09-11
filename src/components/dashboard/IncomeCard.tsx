import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line } from "recharts";
import { ArrowUp } from "lucide-react";
import { useOrders } from "@/context/OrdersContext";

const IncomeCard: React.FC = () => {
  const { orders } = useOrders();

  const totalIncome = useMemo(() => {
    const totalSalesRevenue = orders
      .filter(order => order.type === "Sales")
      .reduce((sum, order) => sum + order.totalAmount, 0);

    return totalSalesRevenue;
  }, [orders]);

  // Generate dynamic data for the mini trend chart (upward trend)
  const data = useMemo(() => {
    if (totalIncome === 0) return [{ name: "A", value: 0 }];

    const baseValue = totalIncome / 0.9;
    return Array.from({ length: 7 }, (_, i) => {
      const value = baseValue * (1 + (i / 10)) + (Math.random() - 0.5) * (baseValue * 0.02);
      return { name: String.fromCharCode(65 + i), value: Math.max(0, value) };
    }).reverse();
  }, [totalIncome]);

  return (
    <Card className="bg-card border-border rounded-lg shadow-sm flex flex-col h-[74px] p-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
        <div className="flex items-center gap-1">
          <CardTitle className="text-xs font-bold text-foreground">Income</CardTitle>
          <ArrowUp className="h-3 w-3 text-green-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between p-0">
        <div className="text-sm font-bold text-foreground">
          ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <LineChart width={80} height={15} data={data}>
          <Line type="monotone" dataKey="value" stroke="#00BFD8" strokeWidth={2} dot={false} />
        </LineChart>
      </CardContent>
    </Card>
  );
};

export default IncomeCard;