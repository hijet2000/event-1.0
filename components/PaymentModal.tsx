
import React, { useState, useEffect } from 'react';
import { Spinner } from './Spinner';
import { createPaymentIntent, purchaseEventCoins, createPublicPaymentIntent } from '../server/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with public key (mock key for dev, replace with env var in prod)
const stripePromise = loadStripe('pk_test_51MOCK_KEY_REPLACE_THIS');

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    delegateToken: string | null; // Allow null for public checkout
    onSuccess: () => void;
    fixedAmount?: number; // Optional fixed amount for direct checkout (e.g. tickets)
    description?: string; // Description for fixed checkout
}

const PACKAGES = [
    { id: 'basic', coins: 50, price: 50 },
    { id: 'standard', coins: 100, price: 90 }, // 10% discount
    { id: 'premium', coins: 250, price: 200 }, // 20% discount
];

const CheckoutForm: React.FC<{ 
    amount: number, 
    coins: number, 
    delegateToken: string | null, 
    onSuccess: () => void,
    isPublicCheckout?: boolean
}> = ({ amount, coins, delegateToken, onSuccess, isPublicCheckout }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        // Allow bypassing Stripe elements check if we are in a purely mock environment where stripe failed to load
        // But ideally, we need stripe loaded.
        
        setProcessing(true);
        setError(null);

        try {
            // 1. Create PaymentIntent on Server
            let clientSecret;
            
            if (isPublicCheckout) {
                const res = await createPublicPaymentIntent(amount);
                clientSecret = res.clientSecret;
            } else if (delegateToken) {
                const res = await createPaymentIntent(delegateToken, amount);
                clientSecret = res.clientSecret;
            } else {
                throw new Error("Authentication required for wallet top-up.");
            }

            // 2. Check for Mock Environment
            // If the backend returns a mock secret (starts with 'mock_'), skip Stripe confirmation
            if (clientSecret && clientSecret.startsWith('mock_')) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Direct Success
                if (!isPublicCheckout && delegateToken) {
                    await purchaseEventCoins(delegateToken, coins, amount);
                }
                onSuccess();
                return; 
            }

            // Real Stripe Flow
            if (!stripe || !elements) {
                throw new Error("Stripe not initialized. Check your connection.");
            }

            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement)!,
                }
            });

            if (result.error) {
                setError(result.error.message || "Payment failed");
            } else if (result.paymentIntent?.status === 'succeeded') {
                // 3. Fulfill Order 
                if (!isPublicCheckout && delegateToken) {
                    await purchaseEventCoins(delegateToken, coins, amount);
                }
                // For public checkout, fulfillment happens in parent component via onSuccess
                onSuccess();
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "An error occurred during payment processing.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border rounded bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardElement options={{
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#424770',
                            '::placeholder': { color: '#aab7c4' },
                        },
                        invalid: { color: '#9e2146' },
                    },
                }} />
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <button 
                type="submit" 
                disabled={processing}
                className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center disabled:opacity-70"
            >
                {processing ? <Spinner /> : `Pay $${amount.toFixed(2)}`}
            </button>
        </form>
    );
};

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, delegateToken, onSuccess, fixedAmount, description }) => {
    const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]);
    const [step, setStep] = useState<'select' | 'pay' | 'success'>(fixedAmount ? 'pay' : 'select');

    useEffect(() => {
        if (isOpen && fixedAmount) {
            setStep('pay');
        } else if (isOpen) {
            setStep('select');
        }
    }, [isOpen, fixedAmount]);

    if (!isOpen) return null;

    const handleSuccess = () => {
        setStep('success');
        setTimeout(() => {
            onSuccess();
            onClose();
            // Reset for next time if not fixedAmount
            if (!fixedAmount) setStep('select');
        }, 2000);
    };

    const isPublicCheckout = !!fixedAmount;
    const finalAmount = fixedAmount || selectedPkg.price;
    const finalCoins = fixedAmount ? 0 : selectedPkg.coins; // No coins for direct ticket purchase

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] md:h-[500px]" onClick={e => e.stopPropagation()}>
                
                {/* Left Side: Package Selection or Summary */}
                <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-8 flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                        {fixedAmount ? 'Order Summary' : 'Top Up Wallet'}
                    </h3>
                    
                    {fixedAmount ? (
                        <div className="flex-1 flex flex-col justify-center space-y-6">
                            <div className="bg-white dark:bg-gray-700 p-6 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-2">Item</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{description || 'Event Purchase'}</p>
                            </div>
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-600 dark:text-gray-300">Total</span>
                                <span className="text-2xl font-bold text-primary">${fixedAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {PACKAGES.map(pkg => (
                                <div 
                                    key={pkg.id} 
                                    onClick={() => setSelectedPkg(pkg)}
                                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPkg.id === pkg.id ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-lg text-gray-900 dark:text-white">{pkg.coins} Coins</p>
                                            {pkg.id === 'standard' && <span className="text-xs text-green-600 font-bold">Most Popular</span>}
                                            {pkg.id === 'premium' && <span className="text-xs text-green-600 font-bold">Best Value</span>}
                                        </div>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">${pkg.price}</p>
                                    </div>
                                    {selectedPkg.id === pkg.id && (
                                        <div className="absolute -right-2 -top-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!fixedAmount && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Total due</span>
                                <span className="font-bold text-lg text-gray-900 dark:text-white">${selectedPkg.price.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Payment Form */}
                <div className="md:w-1/2 p-8 bg-white dark:bg-gray-900 relative">
                    {step === 'success' ? (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Successful!</h3>
                            <p className="text-gray-500 mt-2">
                                {fixedAmount ? "Thank you for your purchase." : `${selectedPkg.coins} coins have been added to your wallet.`}
                            </p>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Secure Payment</h3>
                            <Elements stripe={stripePromise}>
                                <CheckoutForm 
                                    amount={finalAmount} 
                                    coins={finalCoins} 
                                    delegateToken={delegateToken} 
                                    onSuccess={handleSuccess} 
                                    isPublicCheckout={isPublicCheckout}
                                />
                            </Elements>
                            <button onClick={onClose} className="mt-auto py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
