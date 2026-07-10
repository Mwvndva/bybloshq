import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function GuestGuard({ children }: Props) {
  return <>{children}</>;
}


