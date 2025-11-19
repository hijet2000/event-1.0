import React, { useState } from 'react';
import { type RegistrationData } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { jsPDF } from 'jspdf';
import { Spinner } from './Spinner';

interface EventPassViewProps {
  user: RegistrationData;
}

// Helper to convert image URL to base64 for PDF
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching image for PDF:", error);
        return "";
    }
};

export const EventPassView: React.FC<EventPassViewProps> = ({ user }) => {
  const { config } = useTheme();
  const [isGenerating, setIsGenerating] = useState(false);

  if (!user || !user.id) {
    return <p>Could not load your event pass. Please try again later.</p>;
  }

  // Generate the same QR code URL as the backend
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user.id}`;

  const handleDownloadPDF = async () => {
      if (!config) return;
      setIsGenerating(true);

      try {
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const margin = 20;

          // --- Header Background ---
          doc.setFillColor(config.theme.colorPrimary);
          doc.rect(0, 0, pageWidth, 50, 'F');

          // --- Event Name ---
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(24);
          doc.setFont("helvetica", "bold");
          doc.text(config.event.name, margin, 25);

          // --- Event Details (Header) ---
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(`${config.event.date} | ${config.event.location}`, margin, 35);

          // --- Ticket Title ---
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("OFFICIAL DELEGATE PASS", margin, 70);
          
          // --- Delegate Name ---
          doc.setFontSize(28);
          doc.setTextColor(config.theme.colorPrimary);
          doc.text(user.name.toUpperCase(), margin, 85);

          // --- Delegate Role & Company ---
          doc.setFontSize(14);
          doc.setTextColor(80, 80, 80);
          const roleText = [];
          if (user.role) roleText.push(user.role);
          if (user.company) roleText.push(user.company);
          doc.text(roleText.join(' - '), margin, 95);
          
          // --- Email ---
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text(user.email, margin, 102);

          // --- QR Code ---
          // Fetch base64
          const qrBase64 = await getBase64ImageFromUrl(qrCodeUrl);
          if (qrBase64) {
              const qrSize = 80;
              const qrX = (pageWidth - qrSize) / 2;
              const qrY = 120;
              doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
              
              // Frame around QR
              doc.setDrawColor(200, 200, 200);
              doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
          }
          
          // --- Footer ID ---
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`ID: ${user.id}`, pageWidth / 2, 210, { align: "center" });

          // --- Footer Note ---
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text("Please present this ticket at the registration desk.", pageWidth / 2, 280, { align: "center" });

          doc.save(`Ticket-${user.name.replace(/\s+/g, '_')}.pdf`);

      } catch (e) {
          console.error("PDF generation failed", e);
          alert("Failed to generate PDF ticket. Please try again.");
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Event Pass</h2>
      <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.name}</p>
        <p className="text-sm text-gray-500 mb-4">{user.email}</p>
        
        <div className="bg-white p-2 rounded-lg shadow-sm">
             <img src={qrCodeUrl} alt="Your Event QR Code" className="w-64 h-64 rounded-md" />
        </div>

        <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="mt-6 flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-md shadow-md transition-colors disabled:opacity-70"
        >
            {isGenerating ? (
                <>
                    <Spinner />
                    <span className="ml-2">Generating PDF...</span>
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Ticket (PDF)
                </>
            )}
        </button>

        <div className="mt-6 text-center max-w-md">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">How to Use Your Pass</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Present this QR code at event check-in, meal redemption points, and hotel check-in for quick and easy access. This is your all-in-one pass for the event.
            </p>
        </div>
      </div>
    </div>
  );
};