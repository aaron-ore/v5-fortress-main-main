import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Printer, Copy, Loader2 } from "lucide-react";
import { usePrint } from "@/context/PrintContext";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "@/context/ProfileContext";

interface AiSummarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string | null;
  isSummarizing: boolean;
  onGenerateSummary: () => void;
  reportTitle: string;
  activeReportId: string;
}

const loadingMessages = [
  "Getting those report insights for you!",
  "Crunching numbers, AI style!",
  "Almost there, just a moment!",
  "Brewing up some brilliant bullet points!",
  "Making sense of the data chaos!",
];

const AiSummarySidebar: React.FC<AiSummarySidebarProps> = ({
  isOpen,
  onClose,
  summaryText,
  isSummarizing,
  onGenerateSummary,
  reportTitle,
  activeReportId,
}) => {
  void onGenerateSummary; // Suppress TS6133: 'onGenerateSummary' is declared but its value is never read.
  void activeReportId; // Suppress TS6133: 'activeReportId' is declared but its value is never read.

  const { initiatePrint } = usePrint();
  const { profile } = useProfile();

  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSummarizing) {
      interval = setInterval(() => {
        setCurrentLoadingMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
      }, 3000); // Change message every 3 seconds
    } else {
      setCurrentLoadingMessageIndex(0); // Reset when not summarizing
    }
    return () => clearInterval(interval);
  }, [isSummarizing]);

  const handleCopySummary = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      showSuccess("AI summary copied to clipboard!");
    } else {
      showError("No summary to copy.");
    }
  };

  const handlePrintSummary = () => {
    if (!summaryText) {
      showError("No summary to print.");
      return;
    }
    if (!profile?.companyProfile) {
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    const printProps = {
      reportTitle: reportTitle,
      summaryText: summaryText,
      reportDate: new Date().toISOString(),
    };

    initiatePrint({ type: "ai-summary", props: printProps });
    showSuccess("AI summary sent to printer!");
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Report Summary
          </SheetTitle>
          <SheetDescription>
            Concise insights and key takeaways for the "{reportTitle}" report.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-grow flex flex-col gap-4 py-4 overflow-hidden">
          {isSummarizing ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg font-semibold">{loadingMessages[currentLoadingMessageIndex]}</p>
            </div>
          ) : summaryText ? (
            <ScrollArea className="flex-grow border border-border rounded-md p-4 bg-muted/20">
              <p className="whitespace-pre-wrap text-foreground">{summaryText}</p>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
              <Brain className="h-12 w-12 mb-4" />
              <p>Click "Generate AI Summary" to get insights for this report.</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-auto">
          <Button onClick={handleCopySummary} disabled={!summaryText || isSummarizing} className="flex-grow">
            <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
          </Button>
          <Button onClick={handlePrintSummary} disabled={!summaryText || isSummarizing} variant="outline" className="flex-grow">
            <Printer className="h-4 w-4 mr-2" /> Export as PDF
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiSummarySidebar;