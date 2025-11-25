
import React, { useState, useEffect } from 'react';
import { VenueMap, MapPin } from '../types';
import { getVenueMaps } from '../server/api';
import { ContentLoader } from './ContentLoader';

interface VenueMapViewProps {
    delegateToken: string;
}

export const VenueMapView: React.FC<VenueMapViewProps> = ({ delegateToken }) => {
    const [maps, setMaps] = useState<VenueMap[]>([]);
    const [activeMap, setActiveMap] = useState<VenueMap | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getVenueMaps(delegateToken);
                setMaps(data);
                if (data.length > 0) setActiveMap(data[0]);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [delegateToken]);

    if (isLoading) return <ContentLoader text="Loading maps..." />;

    if (maps.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 3.618 9.553 4.553 15 7z" /></svg>
                <p className="text-gray-500">No venue maps available.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-[600px]">
            {/* Map Selector */}
            <div className="mb-4 flex overflow-x-auto space-x-2 pb-2">
                {maps.map(map => (
                    <button
                        key={map.id}
                        onClick={() => { setActiveMap(map); setSelectedPin(null); }}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeMap?.id === map.id ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700'}`}
                    >
                        {map.name}
                    </button>
                ))}
            </div>

            {/* Map Viewer */}
            <div className="relative bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden shadow-inner flex-1 border border-gray-200 dark:border-gray-700">
                {activeMap && (
                    <div className="relative w-full h-full min-h-[500px] overflow-auto">
                        {/* Image Container - In a real app, integrate pan/zoom library here */}
                        <div className="relative inline-block min-w-full min-h-full">
                            <img src={activeMap.imageUrl} alt={activeMap.name} className="max-w-none w-full" />
                            
                            {activeMap.pins.map(pin => (
                                <button
                                    key={pin.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                                    className={`absolute -ml-3 -mt-6 transform transition-transform hover:scale-125 z-10 drop-shadow-md ${selectedPin?.id === pin.id ? 'scale-125 z-20' : ''}`}
                                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-8 h-8 ${
                                        pin.type === 'info' ? 'text-blue-500' :
                                        pin.type === 'room' ? 'text-purple-500' :
                                        pin.type === 'sponsor' ? 'text-yellow-500' : 'text-green-500'
                                    }`}>
                                        <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                    </svg>
                                    {selectedPin?.id !== pin.id && (
                                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                                            {pin.label}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pin Detail Overlay */}
                {selectedPin && (
                    <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-30 animate-fade-in-up">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selectedPin.label}</h3>
                                    <span className="text-xs uppercase font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">{selectedPin.type}</span>
                                </div>
                                {selectedPin.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{selectedPin.description}</p>}
                            </div>
                            <button onClick={() => setSelectedPin(null)} className="text-gray-400 hover:text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
