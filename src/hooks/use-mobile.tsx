import React from "react";
import * as React_2 from "react";

const MOBILE_BREAKPOINT = 1024; // Changed from 768 to 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React_2.useState<boolean | undefined>(
    undefined,
  );

  React_2.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}