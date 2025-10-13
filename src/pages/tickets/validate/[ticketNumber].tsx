import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { purchaseApi } from '../../../api/purchaseApi';
import { Button } from '../../../components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface TicketValidationState {
  status: 'loading' | 'valid' | 'not_found' | 'already_scanned' | 'error';
  message: string;
  ticket?: {
    id: string;
    ticketNumber: string;
    eventName: string;
    customerName: string;
    scanned: boolean;
    scannedAt?: string;
  };
}

export function TicketValidationPage() {
  const { ticketNumber = '' } = useParams<{ ticketNumber: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [validationState, setValidationState] = useState<TicketValidationState>({
    status: 'loading',
    message: 'Validating ticket...',
  });

  const validateTicket = async (ticketNum: string) => {
    if (!ticketNum) {
      setValidationState({
        status: 'error',
        message: 'No ticket number provided',
      });
      return;
    }

    try {
      setValidationState({
        status: 'loading',
        message: 'Validating ticket...',
      });

      const result = await purchaseApi.validateTicket(ticketNum);
      
      if (result.valid && result.status === 'valid' && result.ticket) {
        setValidationState({
          status: 'valid',
          message: 'Ticket is valid!',
          ticket: result.ticket,
        });
      } else if (result.status === 'already_scanned') {
        setValidationState({
          status: 'already_scanned',
          message: 'This ticket has already been scanned',
          ticket: result.ticket,
        });
      } else {
        setValidationState({
          status: 'not_found',
          message: 'Ticket not found',
        });
      }
    } catch (error) {
      console.error('Error validating ticket:', error);
      setValidationState({
        status: 'error',
        message: 'Error validating ticket. Please try again.',
      });
    }
  };

  // Handle initial load and QR code scan
  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams(location.search);
    const fromQr = params.get('qr') === 'true';
    
    const validate = async () => {
      if (ticketNumber) {
        if (isMounted) {
          setValidationState({
            status: 'loading',
            message: 'Validating ticket...',
          });
        }
        
        try {
          const result = await purchaseApi.validateTicket(ticketNumber);
          
          if (!isMounted) return;
          
          if (result.valid && result.status === 'valid' && result.ticket) {
            setValidationState({
              status: 'valid',
              message: 'Ticket is valid!',
              ticket: result.ticket,
            });
          } else if (result.status === 'already_scanned') {
            setValidationState({
              status: 'already_scanned',
              message: 'This ticket has already been scanned',
              ticket: result.ticket,
            });
          } else {
            setValidationState({
              status: 'not_found',
              message: 'Ticket not found',
            });
          }
        } catch (error) {
          if (!isMounted) return;
          console.error('Error validating ticket:', error);
          setValidationState({
            status: 'error',
            message: 'Error validating ticket. Please try again.',
          });
        }
      } else if (!ticketNumber && isMounted) {
        setValidationState({
          status: 'error',
          message: 'No ticket number provided',
        });
      }
    };
    
    validate();
    
    return () => {
      isMounted = false;
    };
  }, [ticketNumber]);

  const renderStatusIcon = () => {
    switch (validationState.status) {
      case 'valid':
        return <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />;
      case 'already_scanned':
        return <AlertCircle className="h-16 w-16 text-yellow-500 mb-4" />;
      case 'not_found':
      case 'error':
        return <XCircle className="h-16 w-16 text-red-500 mb-4" />;
      default:
        return <Loader2 className="h-16 w-16 text-blue-500 mb-4 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (validationState.status) {
      case 'valid':
        return 'Confirmed';
      case 'already_scanned':
        return 'Already Scanned';
      case 'not_found':
        return 'Not Found';
      case 'error':
        return 'Error';
      default:
        return 'Validating...';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          {renderStatusIcon()}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {getStatusText()}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {validationState.message}
          </p>

          {validationState.ticket && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900">Ticket Details</h3>
              <dl className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Event</dt>
                  <dd className="text-sm text-gray-900">{validationState.ticket.eventName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Ticket #</dt>
                  <dd className="text-sm text-gray-900">{validationState.ticket.ticketNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Customer</dt>
                  <dd className="text-sm text-gray-900">{validationState.ticket.customerName}</dd>
                </div>
                {validationState.ticket.scannedAt && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Scanned at</dt>
                    <dd className="text-sm text-gray-900">
                      {new Date(validationState.ticket.scannedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="mt-8">
            <Button
              onClick={() => window.close()}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketValidationPage;
