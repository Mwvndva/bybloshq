import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface SellerLayoutProps {
  children?: ReactNode;
}

export const SellerLayout: React.FC<SellerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content - Full width */}
      <main className="w-full p-4 md:p-8">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default SellerLayout;
