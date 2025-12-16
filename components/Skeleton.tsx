
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
        rect: "rounded-md",
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
    <div className="flex items-start space-x-4 py-4">
        <div className="flex-shrink-0 w-32 space-y-2">
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
        </div>
        <div className="flex-grow border-l-2 border-gray-200 dark:border-gray-700 pl-4 space-y-3">
            <Skeleton variant="text" width="40%" height="1.25rem" />
            <div className="space-y-1">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="50%" />
            </div>
            <Skeleton variant="rect" height="4rem" />
        </div>
    </div>
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center space-x-4">
            <Skeleton variant="circle" width="4rem" height="4rem" />
            <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" height="1.25rem" />
                <Skeleton variant="text" width="40%" />
            </div>
        </div>
        <div className="space-y-2">
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
        </div>
    </div>
);
