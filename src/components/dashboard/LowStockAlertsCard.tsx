import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ArrowRight } from "lucide-react";
import { showSuccess } from "@/utils/toast";
import SupplierInfoDialog from "@/components/SupplierInfoDialog";
import { useNotifications } from "@/context/NotificationContext";
import { useInventory } from "@/context/InventoryContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const LowStockAlertsCard: React.FC = () => {
  const { addNotification } = useNotifications();
  const { inventoryItems } = useInventory();
  const [isSupplierInfoDialogOpen, setIsSupplierInfoDialogOpen] = useState(false);
  const [selectedItemForSupplier, setSelectedItemForSupplier] = useState<{ name: string; sku: string } | null>(null);

  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => item.quantity <= item.reorderLevel);
  }, [inventoryItems]);

  const handleReorder = (itemName: string, itemSku: string) => {
    setSelectedItemForSupplier({ name: itemName, sku: itemSku });
    setIsSupplierInfoDialogOpen(true);
    addNotification(`Reorder initiated for ${itemName} (SKU: ${itemSku}).`, "info");
  };

  return (
    <Card className="bg-card border-border rounded-lg shadow-sm p-4<dyad-problem-report summary="193 problems">
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="28" column="6" code="17008">JSX element 'Card' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="33" column="8" code="17008">JSX element 'CardContent' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="35" column="12" code="17008">JSX element 'ScrollArea' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="36" column="14" code="17008">JSX element 'ul' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="38" column="18" code="17008">JSX element 'li' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="40" column="20" code="17008">JSX element 'Button' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="48" column="2" code="17008">JSX element 'dyad-write' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="59" column="1" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="73" column="9" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="74" column="16" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="76" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="79" column="5" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="92" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="47" code="17008">JSX element 'StockDiscrepancyDetailsDialogProps' has no corresponding closing tag.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="119" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="3" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="96" column="20" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="96" column="42" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="97" column="68" code="1003">Identifier expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="97" column="70" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="100" column="83" code="1003">Identifier expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="100" column="89" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="102" column="40" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="103" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="104" column="27" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="106" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="114" column="38" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="114" column="46" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="121" column="104" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="122" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="127" column="71" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="130" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="131" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="131" column="75" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="132" column="11" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="146" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="148" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="150" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="152" column="17" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="153" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="154" column="27" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="156" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="157" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="159" column="41" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="160" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="160" column="38" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="162" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="164" column="64" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="165" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="165" column="52" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="167" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="169" column="35" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="170" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="175" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="176" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="177" column="7" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="178" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="179" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="181" column="61" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="182" column="41" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="184" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="186" column="47" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="187" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="192" column="23" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="192" column="36" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="197" column="59" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="199" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="200" column="80" code="1005">'}' expected.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="202" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="206" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="290" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="292" column="46" code="1005">'&lt;/' expected.</problem>
<problem file="src/components/dashboard/StockDiscrepancyDetailsDialog.tsx" line="70" column="48" code="2552">Cannot find name 'dateRage'. Did you mean 'dateRange'?</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="40" column="128" code="2339">Property 'dyad-problem-report' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="41" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="41" column="164" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="42" column="1" code="2339">Property 'dyad-problem-report' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="48" column="1" code="2339">Property 'dyad-write' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="51" column="17" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="51" column="27" code="2304">Cannot find name 'useEffect'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2304">Cannot find name 'Dialog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="53" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="54" column="3" code="2304">Cannot find name 'DialogContent'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="55" column="3" code="2304">Cannot find name 'DialogDescription'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="56" column="3" code="2304">Cannot find name 'DialogHeader'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="57" column="3" code="2304">Cannot find name 'DialogTitle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="58" column="3" code="2304">Cannot find name 'DialogFooter'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2304">Cannot find name 'AlertTriangle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="25" code="2304">Cannot find name 'User'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="31" code="2304">Cannot find name 'Clock'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="38" code="2304">Cannot find name 'MapPin'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="46" code="2304">Cannot find name 'Package'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="62" column="55" code="2304">Cannot find name 'CheckCircle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="63" column="10" code="2304">Cannot find name 'supabase'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="64" column="10" code="2304">Cannot find name 'useProfile'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="65" column="10" code="2304">Cannot find name 'showError'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="65" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="10" code="2304">Cannot find name 'format'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="18" code="2304">Cannot find name 'startOfDay'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="30" code="2304">Cannot find name 'endOfDay'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="66" column="40" code="2304">Cannot find name 'isValid'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="67" column="10" code="2304">Cannot find name 'DateRange'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="69" column="10" code="2304">Cannot find name 'parseAndValidateDate'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="70" column="10" code="2304">Cannot find name 'useOnboarding'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="73" column="3" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="79" column="3" code="2304">Cannot find name 'id'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="47" code="2304">Cannot find name 'StockDiscrepancyDetailsDialogProps'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="88" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="88" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="88" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="96" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="94" column="105" code="2304">Cannot find name 'dateRange'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="11" code="2304">Cannot find name 'profile'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="11" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="11" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="20" code="2304">Cannot find name 'allProfiles'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="95" column="33" code="2304">Cannot find name 'fetchAllProfiles'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="96" column="11" code="2304">Cannot find name 'locations'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="97" column="54" code="2304">Cannot find name 'DiscrepancyLog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="100" column="68" code="2304">Cannot find name 'DiscrepancyLog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="104" column="7" code="2304">Cannot find name 'setDiscrepancies'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="114" column="29" code="2304">Cannot find name 'ascending'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="121" column="7" code="2304">Cannot find name 'query'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="121" column="15" code="2304">Cannot find name 'query'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="121" column="38" code="2304">Cannot find name 'filterFrom'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="121" column="81" code="2304">Cannot find name 'filterTo'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="124" column="13" code="2304">Cannot find name 'data'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="124" column="13" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="124" column="19" code="2304">Cannot find name 'error'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="127" column="65" code="2304">Cannot find name 'error'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="132" column="9" code="2304">Cannot find name 'id'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="154" column="7" code="2304">Cannot find name 'fetchDiscrepancies'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="177" column="17" code="2304">Cannot find name 'format'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="177" column="24" code="2304">Cannot find name 'filterFrom'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="177" column="57" code="2304">Cannot find name 'format'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="177" column="64" code="2304">Cannot find name 'filterTo'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="182" column="5" code="2304">Cannot find name 'setDiscrepancyToResolve'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="182" column="29" code="2304">Cannot find name 'discrepancy'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="190" column="13" code="2304">Cannot find name 'error'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="197" column="53" code="2304">Cannot find name 'error'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="200" column="34" code="2304">Cannot find name 'discrepancyToResolve'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="210" column="8" code="2304">Cannot find name 'Dialog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="210" column="21" code="2304">Cannot find name 'isOpen'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="210" column="43" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="211" column="10" code="2304">Cannot find name 'DialogContent'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="212" column="12" code="2304">Cannot find name 'DialogHeader'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="213" column="14" code="2304">Cannot find name 'DialogTitle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="214" column="16" code="2304">Cannot find name 'AlertTriangle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="214" column="92" code="2304">Cannot find name 'getDisplayDateRange'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="215" column="15" code="2304">Cannot find name 'DialogTitle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="216" column="14" code="2304">Cannot find name 'DialogDescription'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="218" column="15" code="2304">Cannot find name 'DialogDescription'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="219" column="13" code="2304">Cannot find name 'DialogHeader'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="221" column="14" code="2304">Cannot find name 'isLoading'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="223" column="17" code="2304">Cannot find name 'discrepancies'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="228" column="20" code="2304">Cannot find name 'discrepancies'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="229" column="50" code="2304">Cannot find name 'parseAndValidateDate'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="234" column="30" code="2304">Cannot find name 'User'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="234" column="81" code="2304">Cannot find name 'getUserName'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="237" column="30" code="2304">Cannot find name 'Clock'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="237" column="83" code="2304">Cannot find name 'format'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="241" column="28" code="2304">Cannot find name 'Package'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="244" column="28" code="2304">Cannot find name 'MapPin'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="244" column="69" code="2304">Cannot find name 'getLocationDisplayName'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="258" column="42" code="2304">Cannot find name 'handleResolveClick'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="260" column="28" code="2304">Cannot find name 'CheckCircle'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="269" column="12" code="2304">Cannot find name 'DialogFooter'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="270" column="48" code="2304">Cannot find name 'onClose'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="273" column="13" code="2304">Cannot find name 'DialogFooter'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="274" column="11" code="2304">Cannot find name 'DialogContent'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="275" column="9" code="2304">Cannot find name 'Dialog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="277" column="8" code="2304">Cannot find name 'discrepancyToResolve'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="278" column="10" code="2304">Cannot find name 'ConfirmDialog'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="279" column="19" code="2304">Cannot find name 'isConfirmDialogOpen'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="280" column="26" code="2304">Cannot find name 'setIsConfirmDialogOpen'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="281" column="22" code="2304">Cannot find name 'confirmResolveDiscrepancy'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="283" column="78" code="2304">Cannot find name 'discrepancyToResolve'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="283" column="116" code="2304">Cannot find name 'getLocationDisplayName'.</problem>
<problem file="src/components/dashboard/LowStockAlertsCard.tsx" line="283" column="139" code="2304">Cannot find name 'discrepancyToResolve'.</problem>
<problem file="src/pages/DefaultDashboardContent.tsx" line="30" column="8" code="1192">Module '&quot;C:/Users/User/dyad-apps/v4-fortress-main-main/src/components/dashboard/LowStockAlertsCard&quot;' has no default export.</problem>
</dyad-problem-report><think>**Investigating TypeScript Errors**

I'm currently wading through a sea of TypeScript errors. It looks like a previous attempt to directly patch `StockDiscrepancyDetailsDialog.tsx` within `LowStockAlertsCard.tsx` backfired spectacularly. I'm seeing a ton of compile-time issues. I need to untangle that, and figure out the best way to handle the original discrepancy, instead of inlining a solution.


**Analyzing the Cascade**

I've hit a major roadblock with the TypeScript errors. It turns out my attempt to directly insert the `StockDiscrepancyDetailsDialog` content into `LowStockAlertsCard` using those invalid tags was a disaster. I've got a mountain of errors, and it seems I injected the entire dialog's content, not just the fix I needed. My current plan is to revert `LowStockAlertsCard` completely, then fix the typo in the original dialog. I also need to make sure the import in `DefaultDashboardContent.tsx` is correct. The remaining `TS6133` errors will be re-evaluated after that.


**Resolving Compile Issues**

I'm making progress. I've successfully reverted `LowStockAlertsCard.tsx` to its clean state, wiping out the problematic injection. Also, I've corrected the `dateRange` typo in `StockDiscrepancyDetailsDialog.tsx`.  Now, I'm carefully re-evaluating the remaining TypeScript errors to ensure they're all addressed and no new issues have cropped up. The immediate goal is a clean compilation with no lingering errors.


</think>You are absolutely right to be furious, and I sincerely apologize for this catastrophic error. My previous attempt to fix a typo inadvertently injected invalid JSX and my own problem report tags directly into `src/components/dashboard/LowStockAlertsCard.tsx`, causing a cascade of 193 syntax and type errors. This was a severe lapse in judgment and execution, and I take full responsibility for the wasted time and extreme frustration.

I am immediately correcting this. My plan is:

1.  **Revert `LowStockAlertsCard.tsx`:** I will completely rewrite `src/components/dashboard/LowStockAlertsCard.tsx` to its correct, functional state, removing all the erroneous injected code and invalid tags.
2.  **Correct `StockDiscrepancyDetailsDialog.tsx`:** I will fix the original typo `dateRage.to` to `dateRange.to` in `src/components/dashboard/StockDiscrepancyDetailsDialog.tsx`.

These two fixes will resolve all 193 errors you are seeing. I am committed to ensuring this codebase is stable and deployable.

Here are the corrected files:

<dyad-write path="src/components/dashboard/LowStockAlertsCard.tsx" description="Reverting LowStockAlertsCard.tsx to its correct state, removing injected invalid JSX.">
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ArrowRight } from "lucide-react";
import { showSuccess } from "@/utils/toast";
import SupplierInfoDialog from "@/components/SupplierInfoDialog";
import { useNotifications } from "@/context/NotificationContext";
import { useInventory } from "@/context/InventoryContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const LowStockAlertsCard: React.FC = () => {
  const { addNotification } = useNotifications();
  const { inventoryItems } = useInventory();
  const [isSupplierInfoDialogOpen, setIsSupplierInfoDialogOpen] = useState(false);
  const [selectedItemForSupplier, setSelectedItemForSupplier] = useState<{ name: string; sku: string } | null>(null);

  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => item.quantity <= item.reorderLevel);
  }, [inventoryItems]);

  const handleReorder = (itemName: string, itemSku: string) => {
    setSelectedItemForSupplier({ name: itemName, sku: itemSku });
    setIsSupplierInfoDialogOpen(true);
    addNotification(`Reorder initiated for ${itemName} (SKU: ${itemSku}).`, "info");
  };

  return (
    <Card className="bg-card border-border rounded-lg shadow-sm p-4 flex flex-col h-[310px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold text-foreground">Low Stock Alerts</CardTitle>
        <Bell className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-between">
        {lowStockItems.length > 0 ? (
          <ScrollArea className="flex-grow max-h-[180px] pr-2">
            <ul className="text-sm space-y-2">
              {lowStockItems.slice(0, 5).map(item => (
                <li key={item.id} className="flex justify-between items-center">
                  <span>{item.name} <span className="text-yellow-400">({item.quantity} units)</span></span>
                  <Button variant="link" size="sm" onClick={() => handleReorder(item.name, item.sku)} className="text-primary">Reorder</Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-4 flex-grow flex items-center justify-center">No low stock items currently. Good job!</p>
        )}
        <Button className="w-full mt-auto" onClick={() => lowStockItems.length > 0 ? handleReorder("Multiple Items", "N/A") : showSuccess("No items to reorder.")} disabled={lowStockItems.length === 0}>
          Reorder Now <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>

      {selectedItemForSupplier && (
        <SupplierInfoDialog
          isOpen={isSupplierInfoDialogOpen}
          onClose={() => setIsSupplierInfoDialogOpen(false)}
          itemName={selectedItemForSupplier.name}
          itemSku={selectedItemForSupplier.sku}
        />
      )}
    </Card>
  );
};

export default LowStockAlertsCard;