import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const parseDate = (str: string) => {
        // Try direct parsing first
        const direct = new Date(str);
        if (!isNaN(direct.getTime())) return direct;

        try {
            // Handle "Month Day-Day, Year" format (e.g. "October 26-28, 2025")
            const yearMatch = str.match(/\d{4}/);
            const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
            
            // Remove year and comma
            let clean = str.replace(year.toString(), '').replace(/,/g, '').trim();
            
            // Handle range "October 26-28" -> "October 26" by splitting at dash
            clean = clean.split(/[-–]/)[0].trim();
            
            const dateStr = `${clean}, ${year}`;
            const date = new Date(dateStr);
            
            if (!isNaN(date.getTime())) return date;
        } catch (e) {
            return null;
        }
        return null;
    };

    const eventDate = parseDate(targetDate);

    if (!eventDate) {
        setStatus('');
        return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = eventDate.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft(null);
        setStatus('Event Started');
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
        setStatus('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (status) {
      return <div className="text-xl font-bold text-primary mt-6 text-center animate-fade-in">{status}</div>;
  }

  if (!timeLeft) return null;

  return (
    <div className="flex justify-center gap-3 sm:gap-4 mt-8 text-center animate-fade-in">
        <div className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm min-w-[70px] sm:min-w-[80px]">
            <span className="text-2xl sm:text-3xl font-bold text-primary">{timeLeft.days}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Days</span>
        </div>
        <div className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm min-w-[70px] sm:min-w-[80px]">
            <span className="text-2xl sm:text-3xl font-bold text-primary">{timeLeft.hours}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</span>
        </div>
        <div className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm min-w-[70px] sm:min-w-[80px]">
            <span className="text-2xl sm:text-3xl font-bold text-primary">{timeLeft.minutes}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mins</span>
        </div>
        <div className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm min-w-[70px] sm:min-w-[80px]">
            <span className="text-2xl sm:text-3xl font-bold text-primary">{timeLeft.seconds}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Secs</span>
        </div>
    </div>
  );
};
