
import React from 'react';
import { type RegistrationData, type EventConfig } from '../types';

interface BadgePrintLayoutProps {
  user: RegistrationData;
  config: EventConfig;
}

export const BadgePrintLayout: React.FC<BadgePrintLayoutProps> = ({ user, config }) => {
  if (!user || !config) return null;

  const { printConfig, badgeConfig, theme } = config;
  
  // Defaults if not set
  const width = printConfig?.width || 4;
  const height = printConfig?.height || 3;
  const orientation = printConfig?.orientation || 'landscape';
  
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(user.id || 'unknown')}`;

  return (
    <div id="print-badge-container" className="hidden print:block fixed inset-0 bg-white z-[9999]">
      <style>
        {`
          @media print {
            @page {
              size: ${width}in ${height}in ${orientation};
              margin: 0;
            }
            body * {
              visibility: hidden;
            }
            #print-badge-container, #print-badge-container * {
              visibility: visible;
            }
            #print-badge-container {
              position: absolute;
              left: 0;
              top: 0;
              width: ${width}in;
              height: ${height}in;
              overflow: hidden;
              background: white;
              display: flex !important;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              box-sizing: border-box;
              border: 1px solid #ddd; /* Helper border, might be cut off */
            }
          }
        `}
      </style>
      
      <div className="w-full h-full p-4 flex flex-col justify-between items-center relative">
          {/* Header */}
          <div className="w-full text-center border-b-2 pb-2 mb-2" style={{ borderColor: theme.colorPrimary }}>
              <h1 className="text-xl font-bold uppercase tracking-widest">{config.event.name}</h1>
              <p className="text-xs text-gray-500">{config.event.date}</p>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col justify-center items-center w-full">
              {badgeConfig.showName && (
                  <h2 className="text-4xl font-extrabold leading-tight mb-2 uppercase break-words w-full">
                      {user.name}
                  </h2>
              )}
              
              {badgeConfig.showCompany && user.company && (
                  <p className="text-lg font-semibold text-gray-700 uppercase mb-1">
                      {user.company}
                  </p>
              )}
              
              {badgeConfig.showRole && user.role && (
                  <p className="text-sm text-gray-500 uppercase tracking-wide">
                      {user.role}
                  </p>
              )}
          </div>

          {/* Footer / QR */}
          <div className="w-full flex justify-between items-end mt-2 pt-2 border-t border-gray-200">
              <div className="text-left">
                  {badgeConfig.showEmail && <p className="text-[10px] text-gray-400">{user.email}</p>}
                  <p className="text-[10px] text-gray-400">ID: {user.id?.slice(-6)}</p>
              </div>
              <img src={qrCodeUrl} alt="QR" className="w-16 h-16" />
          </div>
          
          {/* Accent Bar */}
          <div className="absolute bottom-0 left-0 w-full h-2" style={{ backgroundColor: theme.colorPrimary }}></div>
      </div>
    </div>
  );
};
