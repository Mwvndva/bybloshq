import AppProviders from "./AppProviders";
import AppLayout from "./layouts/AppLayout";
import AppRoutes from "./AppRoutes";

export default function AppShell() {
  return (
    <AppProviders>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </AppProviders>
  );
}
