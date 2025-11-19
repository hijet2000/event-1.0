
import React, { useState, useEffect } from 'react';
import { Spinner } from './Spinner';
import { purchaseEventCoins } from '../server/api';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    delegateToken: string;
    onSuccess: () => void;
}

const PACKAGES = [
    { id: 'basic', coins: 50, price: 50 },
    { id: 'standard', coins: 100, price: 90 }, // 10% discount
    { id: 'premium', coins: 250, price: 200 }, // 20% discount
];

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, delegateToken, onSuccess }) => {
    const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]);
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'select' | 'pay' | 'success'>('select');

    if (!isOpen) return null;

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 16) val = val.slice(0, 16);
        // Add spaces every 4 digits for display
        const formatted = val.replace(/(.{4})/g, '$1 ').trim();
        setCardNumber(formatted);
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2);
        setExpiry(val);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            // Remove spaces from card number for "validation"
            const rawNum = cardNumber.replace(/\s/g, '');
            if (rawNum.length < 16 || expiry.length < 5 || cvc.length < 3 || !cardName) {
                throw new Error("Please fill in all card details.");
            }

            await purchaseEventCoins(delegateToken, selectedPkg.coins, selectedPkg.price);
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
                // Reset state after close
                setTimeout(() => {
                    setStep('select');
                    setCardNumber('');
                    setCardName('');
                    setExpiry('');
                    setCvc('');
                }, 500);
            }, 2000);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Payment failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] md:h-[500px]" onClick={e => e.stopPropagation()}>
                
                {/* Left Side: Package Selection */}
                <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800 p-8 flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Top Up Wallet</h3>
                    <div className="space-y-4 flex-1">
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
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total due</span>
                            <span className="font-bold text-lg text-gray-900 dark:text-white">${selectedPkg.price.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Payment Form */}
                <div className="md:w-1/2 p-8 bg-white dark:bg-gray-900 relative">
                    {step === 'success' ? (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Successful!</h3>
                            <p className="text-gray-500 mt-2">{selectedPkg.coins} coins have been added to your wallet.</p>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Card Details</h3>
                            
                            {/* Credit Card Visual */}
                            <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="w-12 h-8 bg-yellow-500/80 rounded-md"></div>
                                    <span className="text-xs font-mono opacity-70">DEBIT</span>
                                </div>
                                <div className="font-mono text-xl tracking-widest mb-6">{cardNumber || '•••• •••• •••• ••••'}</div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] opacity-60 uppercase">Card Holder</div>
                                        <div className="font-medium tracking-wide uppercase text-sm">{cardName || 'YOUR NAME'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] opacity-60 uppercase">Expires</div>
                                        <div className="font-medium tracking-wide text-sm">{expiry || 'MM/YY'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Card Number</label>
                                        <input 
                                            type="text" 
                                            value={cardNumber}
                                            onChange={handleCardNumberChange}
                                            className="block w-full border-b border-gray-300 dark:border-gray-700 bg-transparent py-2 px-1 focus:outline-none focus:border-primary transition-colors"
                                            placeholder="0000 0000 0000 0000"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Cardholder Name</label>
                                        <input 
                                            type="text" 
                                            value={cardName}
                                            onChange={e => setCardName(e.target.value)}
                                            className="block w-full border-b border-gray-300 dark:border-gray-700 bg-transparent py-2 px-1 focus:outline-none focus:border-primary transition-colors"
                                            placeholder="Jane Doe"
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                                            <input 
                                                type="text" 
                                                value={expiry}
                                                onChange={handleExpiryChange}
                                                className="block w-full border-b border-gray-300 dark:border-gray-700 bg-transparent py-2 px-1 focus:outline-none focus:border-primary transition-colors"
                                                placeholder="MM/YY"
                                                required
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">CVC</label>
                                            <input 
                                                type="password" 
                                                value={cvc}
                                                onChange={e => setCvc(e.target.value.slice(0,3))}
                                                className="block w-full border-b border-gray-300 dark:border-gray-700 bg-transparent py-2 px-1 focus:outline-none focus:border-primary transition-colors"
                                                placeholder="123"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 flex gap-3">
                                    <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                                    <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center disabled:opacity-70">
                                        {isProcessing ? <Spinner /> : `Pay $${selectedPkg.price}`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
