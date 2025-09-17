import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCATION_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142.1 76.2% 36.3%)",
  "hsl(47.9 95.8% 53.1%)",
];

interface MiniDonutProps {
  percentage: number;
  isPositive: boolean;
  color: string;
}

const MiniDonut: React.FC<MiniDonutProps> = ({ percentage, isPositive, color }) => {
  const data = [{ name: "Achieved", value: percentage }, { name: "Remaining", value: 100 - percentage }];
  const remainingColor = "hsl(var(--muted))";

  return (
    <div className="relative w-16 h-16 flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={20}
            outerRadius={28}
            paddingAngle={0}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            cornerRadius={5}
          >
            <Cell fill={color} />
            <Cell fill={remainingColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className={cn("text-xs font-bold flex items-center justify-center", isPositive ? "text-green-500" : "text-destructive")}>
          {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {percentage}%
        </p>
      </div>
    </div>
  );
};

interface LocationStockHealthCardProps {
  locationStockHealthData: any[];
}

const LocationStockHealthCard: React.FC<LocationStockHealthCardProps> = ({ locationStockHealthData: displayData }) => {
  return (
    <Card className="bg-card border-border rounded-lg shadow-sm p-4 flex flex-col h-[310px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Folder Stock {/* Changed title to Folder Stock */}
        </CardTitle>
        <p className="text-sm text-muted-foreground">Top folders by stock movement</p> {/* Changed description to folders */}
      </CardHeader>
      <CardContent className="flex-grow p-4 pt-0 flex flex-col justify-between">
        {displayData.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 justify-items-center items-center flex-grow">
              {displayData.map((data, index) => (
                <MiniDonut
                  key={index}
                  percentage={data.percentage}
                  isPositive={data.isPositive}
                  color={LOCATION_COLORS[index % LOCATION_COLORS.length]}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {displayData.map((data, index) => (
                <div key={index} className="flex items-center gap-2 min-w-0 overflow-hidden"> {/* Added min-w-0 and overflow-hidden */}
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: LOCATION_COLORS[index % LOCATION_COLORS.length] }}></span>
                  <span className="text-muted-foreground truncate">{data.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No stock movement data available for folders. {/* Changed text to folders */}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationStockHealthCard;