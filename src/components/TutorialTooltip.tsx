"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronRight } from "lucide-react";
import { TutorialStep, useTutorial } from "@/context/TutorialContext";
import { cn } from "@/lib/utils";

interface TutorialTooltipProps {
  step: TutorialStep;
}

const TutorialTooltip: React.FC<TutorialTooltipProps> = ({ step }) => {
  const { nextStep, dismissTutorial } = useTutorial();
  const [position, setPosition] = useState<{ top: number; left: number; transform?: string; width?: string }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    const targetElement = document.querySelector(step.targetSelector);
    if (!targetElement || !tooltipRef.current) {
      // If target not found, try to center it or dismiss
      if (step.targetSelector === "body") {
        setPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
          transform: "translate(-50%, -50%)",
          width: "300px",
        });
      } else {
        console.warn(`Tutorial target element not found: ${step.targetSelector}. Attempting to center.`);
        setPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
          transform: "translate(-50%, -50%)",
          width: "300px",
        });
      }
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let newTop = 0;
    let newLeft = 0;
    let newTransform = "";
    let newWidth = "300px"; // Default width

    // Adjust width for better readability on smaller targets
    if (targetRect.width < 300 && step.placement !== 'center') {
      newWidth = `${Math.max(200, targetRect.width + 50)}px`;
    }

    switch (step.placement) {
      case 'top':
        newTop = targetRect.top - tooltipRect.height - 10;
        newLeft = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        newTransform = "translateY(0)";
        break;
      case 'bottom':
        newTop = targetRect.bottom + 10;
        newLeft = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        newTransform = "translateY(0)";
        break;
      case 'left':
        newTop = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        newLeft = targetRect.left - tooltipRect.width - 10;
        newTransform = "translateX(0)";
        break;
      case 'right':
        newTop = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        newLeft = targetRect.right + 10;
        newTransform = "translateX(0)";
        break;
      case 'center':
      default:
        newTop = window.innerHeight / 2;
        newLeft = window.innerWidth / 2;
        newTransform = "translate(-50%, -50%)";
        break;
    }

    // Ensure tooltip stays within viewport
    if (newLeft < 10) newLeft = 10;
    if (newTop < 10) newTop = 10;
    if (newLeft + tooltipRect.width > window.innerWidth - 10) {
      newLeft = window.innerWidth - tooltipRect.width - 10;
    }
    if (newTop + tooltipRect.height > window.innerHeight - 10) {
      newTop = window.innerHeight - tooltipRect.height - 10;
    }

    setPosition({ top: newTop, left: newLeft, transform: newTransform, width: newWidth });
  };

  useEffect(() => {
    // Recalculate position after render to get correct tooltipRect.height
    const timeout = setTimeout(() => {
      calculatePosition();
    }, 50); // Small delay to ensure tooltip content is rendered

    window.addEventListener('resize', calculatePosition);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [step]); // Recalculate when step changes

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-50 transition-all duration-300 ease-out",
        "bg-card border-border shadow-xl rounded-lg",
        "max-w-xs p-4"
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
        width: position.width,
      }}
    >
      <Card className="border-none shadow-none p-0">
        <CardHeader className="flex flex-row items-center justify-between p-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">{step.title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={dismissTutorial} className="h-6 w-6 text-muted-foreground hover:bg-muted/20">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 text-sm text-muted-foreground">
          {step.content}
        </CardContent>
        <CardFooter className="flex justify-between items-center p-0 pt-4">
          <Button variant="link" onClick={dismissTutorial} className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
            Hide these tips
          </Button>
          <Button onClick={nextStep} size="sm">
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TutorialTooltip;