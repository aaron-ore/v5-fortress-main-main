import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

interface AnnouncementBarProps {
  message: string;
  linkTo: string;
  linkText: string;
}

const useTypingEffect = (text: string, speed: number = 50) => {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeoutId);
    }
  }, [text, speed, index]);

  return displayedText;
};

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ message, linkText }) => {
  const { profile } = useProfile(); // NEW: Use profile from ProfileContext

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("fortress_announcement_dismissed") === "true";
    }
    return false;
  });

  // NEW: Announcement bar is visible if not dismissed AND onboarding wizard is NOT completed
  const isVisible = !isDismissed && !profile?.hasOnboardingWizardCompleted;

  const typedMessage = useTypingEffect(message);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem("fortress_announcement_dismissed", "true");
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="relative bg-primary text-primary-foreground p-3 text-center text-sm flex items-center justify-center overflow-hidden">
      <p className="flex-grow">
        {typedMessage}
        {typedMessage.length === message.length && (
          <>
            {" "}
            <Link to="/onboarding" className="underline font-semibold hover:opacity-80">
              {linkText}
            </Link>
          </>
        )}
      </p>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-foreground hover:bg-primary/80"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default AnnouncementBar;