import { ReactNode } from "react";
import { AppProviders as LegacyAppProviders } from "@/components/AppProviders";

interface Props {
  children: ReactNode;
}

export default function AppProviders({ children }: Props) {
  return <LegacyAppProviders>{children}</LegacyAppProviders>;
}


