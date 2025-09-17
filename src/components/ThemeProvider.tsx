import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props} attribute="class" themes={['dark', 'emerald', 'deep-forest', 'tropical-indigo', 'light-grey-indigo']}>{children}</NextThemesProvider>;
}