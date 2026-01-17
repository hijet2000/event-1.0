
import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
    className = "", 
    variant = 'rect', 
    width, 
    height 
}) => {
    const baseStyles = "animate-pulse bg-gray-200 dark:bg-gray-700";
    const variantStyles = {
        text: "rounded h-4 my-1",
        rect: "rounded-xl",
        circle: "rounded-full"
    };

    const style: React.CSSProperties = {};
    if (width) style.width = width;
    if (height) style.height = height;

    return (
        <div 
            className={`${baseStyles} ${variantStyles[variant]} ${className}`} 
            style={style}
        />
    );
};

export const SessionSkeleton: React.FC = () => (
    <div className="flex items-start space-x-6 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <div className="flex-shrink-0 w-24 text-right space-y-2">
            <Skeleton variant="text" width="100%" height="1.25rem" />
            <Skeleton variant="text" width="70%" className="ml-auto" />
        </div>
        <div className="flex-grow border-l-2 border-gray-100 dark:border-gray-700 pl-6 space-y-4">
            <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                    <Skeleton variant="rect" width="120px" height="18px" />
                    <Skeleton variant="text" width="60%" height="1.5rem" />
                </div>
                <Skeleton variant="circle" width="2rem" height="2rem" />
            </div>
            <div className="space-y-2">
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="90%" />
            </div>
            <div className="flex gap-3">
                <Skeleton variant="rect" width="60px" height="20px" />
                <Skeleton variant="rect" width="60px" height="20px" />
            </div>
        </div>
    </div>
);

export const SpeakerSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex flex-col items-center space-y-4">
            <Skeleton variant="circle" width="8rem" height="8rem" />
            <div className="w-full space-y-2 flex flex-col items-center">
                <Skeleton variant="text" width="60%" height="1.75rem" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="30%" />
            </div>
        </div>
        <div className="space-y-2">
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
        </div>
    </div>
);

export const SponsorSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <Skeleton variant="rect" width="8rem" height="8rem" className="flex-shrink-0" />
        <div className="flex-1 w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Skeleton variant="text" width="40%" height="2rem" />
                <Skeleton variant="rect" width="80px" height="24px" className="rounded-full" />
            </div>
            <div className="space-y-2">
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="90%" />
            </div>
            <Skeleton variant="text" width="100px" height="1rem" />
        </div>
    </div>
);
