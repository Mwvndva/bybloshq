import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBuyerAuth } from '@/features/auth/contexts';
import { useToast } from '@/hooks/use-toast';

export function useBuyerResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const email = searchParams.get('email') || '';
    const { toast } = useToast();
    const { resetPassword, isLoading } = useBuyerAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

    // Password strength checker function
    const checkPasswordStrength = (password: string) => {
        return {
            minLength: password.length >= 8,
            hasNumber: /\d/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
        };
    };

    // Verify token on component mount
    useEffect(() => {
        if (!token) {
            setIsValidToken(false);
            toast({
                title: 'Invalid Token',
                description: 'No reset token provided. Please use the link from your email.',
                variant: 'destructive',
            });
            return;
        }

        // For buyer tokens, we'll check if it looks like a valid hex token (not JWT)
        const isValidHexToken = /^[a-f0-9]{64}$/.test(token);
        setIsValidToken(isValidHexToken);

        if (!isValidHexToken) {
            toast({
                title: 'Invalid Token',
                description: 'Invalid reset token format. Please use the link from your email.',
                variant: 'destructive',
            });
        }
    }, [token, toast]);

    const validatePasswords = (password: string, confirmPassword: string, showToast = true): boolean => {
        if (password !== confirmPassword) {
            if (showToast) {
                setPasswordError('Passwords do not match');
                toast({
                    title: "Validation Error",
                    description: "Passwords do not match",
                    variant: 'destructive',
                });
            }
            return false;
        }

        const strength = checkPasswordStrength(password);
        const unmetRequirements: string[] = [];

        if (!strength.minLength) unmetRequirements.push("at least 8 characters");
        if (!strength.hasNumber) unmetRequirements.push("a number");
        if (!strength.hasSpecial) unmetRequirements.push("a special character");
        if (!strength.hasUpper) unmetRequirements.push("an uppercase letter");
        if (!strength.hasLower) unmetRequirements.push("a lowercase letter");

        if (unmetRequirements.length > 0) {
            const errorMsg = `Password needs ${unmetRequirements.join(', ')}`;
            setPasswordError(errorMsg);
            if (showToast) {
                toast({
                    title: "Weak Password",
                    description: errorMsg,
                    variant: 'destructive',
                });
            }
            return false;
        }

        setPasswordError('');
        return true;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token || !isValidToken) {
            toast({
                title: 'Invalid Token',
                description: 'Please use the reset link from your email.',
                variant: 'destructive',
            });
            return;
        }

        if (!email) {
            toast({
                title: 'Missing Email',
                description: 'Reset link is missing your email address. Please request a new link.',
                variant: 'destructive',
            });
            return;
        }

        if (!validatePasswords(formData.password, formData.confirmPassword)) {
            return;
        }

        try {
            await resetPassword(token, formData.password, email);
            toast({
                title: 'Success',
                description: 'Your password has been reset successfully.',
            });
            navigate('/buyer/login');
        } catch (error) {
            // Error is already handled by the auth context
        }
    };

    const strength = checkPasswordStrength(formData.password);


    return {
        isValidToken,
        formData,
        handleInputChange,
        handleSubmit,
        showPassword,
        setShowPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        passwordError,
        isLoading,
        strength,
    };
}
