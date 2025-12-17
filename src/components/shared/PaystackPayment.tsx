import React, { useEffect, useState } from 'react';

interface PaystackPaymentProps {
  email: string;
  amount: number;
  reference: string;
  onSuccess: (response: any) => void;
  onClose: () => void;
  onOpen?: () => void; // New prop for when modal opens
  publicKey?: string;
  currency?: string;
  metadata?: Record<string, any>;
}

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
  email,
  amount,
  reference,
  onSuccess,
  onClose,
  onOpen, // Add the new onOpen prop
  publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  currency = 'KES',
  metadata = {}
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [modalInitialized, setModalInitialized] = useState(false); // NEW: Track modal initialization

  // Debug environment variables at component mount
  useEffect(() => {
    console.log('=== ENVIRONMENT DEBUG ===');
    console.log('process.env:', process.env);
    console.log('VITE_PAYSTACK_PUBLIC_KEY from process.env:', process.env.VITE_PAYSTACK_PUBLIC_KEY);
    console.log('publicKey prop:', publicKey);
    console.log('import.meta.env:', import.meta.env);
    console.log('import.meta.env.VITE_PAYSTACK_PUBLIC_KEY:', import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
  }, [publicKey]);

  useEffect(() => {
    // Check if Paystack script is already loaded
    if (window.PaystackPop) {
      console.log('Paystack script already loaded');
      setScriptLoaded(true);
      setError(null);
      return;
    }

    // Load Paystack script only if not already loaded
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Paystack script loaded successfully');
      console.log('Window object after load:', Object.keys(window).filter(key => key.toLowerCase().includes('paystack')));
      
      // Check if PaystackPop is available
      if (window.PaystackPop) {
        console.log('PaystackPop is available, type:', typeof window.PaystackPop);
        setScriptLoaded(true);
        setError(null);
      } else {
        console.error('PaystackPop not found after script load');
        console.log('Available window properties:', Object.keys(window));
        setError('Paystack library not loaded properly');
      }
    };
    
    script.onerror = (error) => {
      console.error('Failed to load Paystack script:', error);
      setError('Failed to load Paystack payment gateway');
    };
    
    document.body.appendChild(script);
    
    return () => {
      // Don't remove the script if it exists, as other components might need it
      // Only remove if we added it and it's not loaded
      if (document.body.contains(script) && !window.PaystackPop) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Auto-open payment modal when script is loaded
  useEffect(() => {
    // Auto-initialize payment when script loads and payment hasn't completed AND modal hasn't been initialized
    if (scriptLoaded && !paymentCompleted && !modalInitialized) {
      console.log('Script loaded, auto-initializing payment...');
      console.log('Modal initialized status:', modalInitialized);
      
      // Call onOpen callback when modal is about to open
      if (onOpen) {
        onOpen();
      }
      
      const timer = setTimeout(() => {
        // Mark as initialized only when actually attempting to open
        setModalInitialized(true);
        initializePayment();
      }, 1000); // Small delay to ensure everything is loaded
      
      return () => clearTimeout(timer);
    }
  }, [scriptLoaded, paymentCompleted, modalInitialized, onOpen]);

  const initializePayment = () => {
    console.log('Initializing Paystack payment...');
    console.log('Payment completed status:', paymentCompleted);
    console.log('Modal initialized status:', modalInitialized);
    
    if (paymentCompleted) {
      console.log('Payment already completed, skipping initialization');
      return;
    }
    
    console.log('window.PaystackPop available:', !!window.PaystackPop);
    console.log('PaystackPop type:', typeof window.PaystackPop);
    console.log('Public key:', publicKey);
    console.log('import.meta.env.VITE_PAYSTACK_PUBLIC_KEY:', import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
    
    if (!scriptLoaded) {
      setError('Payment gateway is still loading...');
      return;
    }

    // Validate public key
    if (!publicKey || !publicKey.startsWith('pk_')) {
      setError('Invalid Paystack public key. Please configure VITE_PAYSTACK_PUBLIC_KEY');
      console.error('Invalid public key:', publicKey);
      console.error('Available in import.meta.env:', import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
      return;
    }

    try {
      const paymentData = {
        key: publicKey,
        email: email,
        amount: Math.round(amount * 100), // Ensure it's an integer in kobo/cents
        currency: currency,
        ref: reference,
        metadata: metadata,
        callback: (response: any) => {
          console.log('Payment successful:', response);
          setPaymentCompleted(true); // Mark payment as completed
          onSuccess(response);
        },
        onClose: () => {
          console.log('Payment closed');
          if (!paymentCompleted) {
            onClose();
          }
        }
      };

      console.log('Creating Paystack popup with:', paymentData);

      // Try different Paystack initialization methods
      if (window.PaystackPop && typeof window.PaystackPop === 'function') {
        console.log('Using PaystackPop constructor');
        const paystack = new window.PaystackPop(paymentData);
        if (paystack.openIframe) {
          paystack.openIframe();
        } else if (paystack.open) {
          paystack.open();
        }
      } else if (window.PaystackPop && typeof window.PaystackPop.setup === 'function') {
        console.log('Using PaystackPop.setup method');
        const paystack = window.PaystackPop.setup(paymentData);
        if (paystack.openIframe) {
          paystack.openIframe();
        } else if (paystack.open) {
          paystack.open();
        }
      } else {
        console.error('PaystackPop is not available or not a function');
        console.log('window.PaystackPop:', window.PaystackPop);
        setError('Paystack initialization failed - API not available');
      }
    } catch (err) {
      setError('Failed to initialize payment');
      console.error('Paystack error:', err);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Payment Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hidden component - modal opens automatically */}
      {paymentCompleted ? (
        <div className="text-center text-sm text-green-600 py-2">
          Payment completed successfully!
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-2">
          Opening Paystack payment modal...
        </div>
      )}
    </div>
  );
};

export default PaystackPayment;
