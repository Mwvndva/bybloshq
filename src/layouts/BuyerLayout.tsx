import { Outlet } from 'react-router-dom';

const BuyerLayout = () => {
    return (
        <div className="min-h-screen bg-black">
            <Outlet />
        </div>
    );
};

export default BuyerLayout;
