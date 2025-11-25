
import React, { useState, useEffect, useRef } from 'react';
import { VenueMap, MapPin } from '../types';
import { getVenueMaps, saveVenueMap, deleteVenueMap } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { ImageUpload } from './ImageUpload';
import { Alert } from './Alert';

interface MapDashboardProps {
    adminToken: string;
}

export const MapDashboard: React.FC<MapDashboardProps> = ({ adminToken }) => {
    const [maps, setMaps] = useState<VenueMap[]>([]);
    const [activeMapId, setActiveMapId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit State
    const [formData, setFormData] = useState<Partial<VenueMap>>({});
    const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
    
    const mapImageRef = useRef<HTMLImageElement>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getVenueMaps(adminToken);
            setMaps(data);
            if (data.length > 0 && !activeMapId) {
                setActiveMapId(data[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleCreate = () => {
        setFormData({ name: 'New Floor Plan', imageUrl: '', pins: [] });
        setIsEditing(true);
        setActiveMapId(null);
    };

    const handleEdit = (map: VenueMap) => {
        setFormData({ ...map });
        setIsEditing(true);
        setActiveMapId(map.id);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Delete this map?")) {
            await deleteVenueMap(adminToken, id);
            fetchData();
            if (activeMapId === id) setActiveMapId(null);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.imageUrl) {
            alert("Name and Image are required");
            return;
        }
        await saveVenueMap(adminToken, formData);
        setIsEditing(false);
        fetchData();
    };

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!mapImageRef.current) return;
        
        const rect = mapImageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newPin: MapPin = {
            id: `pin_${Date.now()}`,
            x,
            y,
            label: 'New Pin',
            type: 'info'
        };

        setFormData(prev => ({
            ...prev,
            pins: [...(prev.pins || []), newPin]
        }));
        setSelectedPin(newPin);
    };

    const updatePin = (id: string, updates: Partial<MapPin>) => {
        setFormData(prev => ({
            ...prev,
            pins: prev.pins?.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
        if (selectedPin?.id === id) setSelectedPin(prev => prev ? { ...prev, ...updates } : null);
    };

    const deletePin = (id: string) => {
        setFormData(prev => ({
            ...prev,
            pins: prev.pins?.filter(p => p.id !== id)
        }));
        setSelectedPin(null);
    };

    if (isLoading) return <ContentLoader text="Loading maps..." />;

    if (isEditing) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold dark:text-white">{formData.id ? 'Edit Map' : 'Create Map'}</h3>
                    <div className="space-x-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded dark:border-gray-600 dark:text-gray-300">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">Save Map</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-900 rounded-xl p-4 flex items-center justify-center relative overflow-hidden min-h-[400px]">
                        {formData.imageUrl ? (
                            <div className="relative inline-block" onClick={handleMapClick}>
                                <img 
                                    ref={mapImageRef}
                                    src={formData.imageUrl} 
                                    alt="Map" 
                                    className="max-w-full h-auto rounded shadow-lg cursor-crosshair" 
                                />
                                {formData.pins?.map(pin => (
                                    <div 
                                        key={pin.id}
                                        className={`absolute w-6 h-6 -ml-3 -mt-6 transform transition-transform hover:scale-125 cursor-pointer ${selectedPin?.id === pin.id ? 'z-20' : 'z-10'}`}
                                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-full h-full drop-shadow-md ${selectedPin?.id === pin.id ? 'text-yellow-400' : 'text-red-500'}`}>
                                            <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400">Upload an image to start</div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
                            <label className="block text-sm font-medium mb-1">Map Name</label>
                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                            
                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-2">Floor Plan Image</label>
                                <ImageUpload label="" value={formData.imageUrl || ''} onChange={url => setFormData({...formData, imageUrl: url})} />
                            </div>
                        </div>

                        {selectedPin && (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-primary/50 dark:border-primary/50 animate-fade-in">
                                <h4 className="font-bold mb-3 text-primary">Edit Pin</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Label</label>
                                        <input type="text" value={selectedPin.label} onChange={e => updatePin(selectedPin.id, { label: e.target.value })} className="w-full p-2 text-sm border rounded dark:bg-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Type</label>
                                        <select value={selectedPin.type} onChange={e => updatePin(selectedPin.id, { type: e.target.value as any })} className="w-full p-2 text-sm border rounded dark:bg-gray-700">
                                            <option value="info">Info Point</option>
                                            <option value="room">Room / Session</option>
                                            <option value="sponsor">Sponsor Booth</option>
                                            <option value="facility">Facility (Food/Restroom)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Description</label>
                                        <textarea value={selectedPin.description || ''} onChange={e => updatePin(selectedPin.id, { description: e.target.value })} className="w-full p-2 text-sm border rounded dark:bg-gray-700" rows={2} />
                                    </div>
                                    <button onClick={() => deletePin(selectedPin.id)} className="w-full py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">Delete Pin</button>
                                </div>
                            </div>
                        )}
                        
                        {!selectedPin && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                                Click anywhere on the map image to drop a pin. Click an existing pin to edit it.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Venue Maps</h2>
                    <p className="mt-1 text-sm text-gray-500">Manage floor plans and interactive wayfinding.</p>
                </div>
                <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/90">+ Add Map</button>
            </div>

            {maps.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed dark:border-gray-700">
                    <p className="text-gray-500">No maps created yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {maps.map(map => (
                        <div key={map.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group">
                            <div className="h-48 bg-gray-100 dark:bg-gray-900 relative">
                                <img src={map.imageUrl} alt={map.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button onClick={() => handleEdit(map)} className="bg-white text-gray-900 px-4 py-2 rounded-full shadow-lg font-medium">Edit Map</button>
                                </div>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">{map.name}</h4>
                                    <p className="text-xs text-gray-500">{map.pins?.length || 0} Pins</p>
                                </div>
                                <button onClick={() => handleDelete(map.id)} className="text-red-500 hover:text-red-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
