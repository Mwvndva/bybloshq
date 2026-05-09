import SellerOrdersSection from '../../SellerOrdersSection';

export function OrdersTab() {
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="text-center px-2 sm:px-0">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 mb-1.5">Order Management</h2>
        <p className="text-slate-700 text-xs sm:text-sm lg:text-base font-medium">View and manage customer orders</p>
      </div>
      <SellerOrdersSection />
    </div>
  );
}
