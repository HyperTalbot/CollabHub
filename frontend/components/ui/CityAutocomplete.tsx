import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

// База городов (сокращенная для примера, в реальности это может быть отдельный JSON файл или API запрос)
const CITIES = [
    "Москва, Россия", "Санкт-Петербург, Россия", "Новосибирск, Россия", "Екатеринбург, Россия", "Казань, Россия",
    "Нижний Новгород, Россия", "Челябинск, Россия", "Самара, Россия", "Омск, Россия", "Ростов-на-Дону, Россия",
    "Уфа, Россия", "Красноярск, Россия", "Воронеж, Россия", "Пермь, Россия", "Волгоград, Россия",
    "Минск, Беларусь", "Киев, Украина", "Астана, Казахстан", "Алматы, Казахстан",
    "New York, USA", "London, UK", "Berlin, Germany", "Paris, France", "Tokyo, Japan"
];

interface Props {
    value: string;
    onChange: (val: string) => void;
}

export const CityAutocomplete: React.FC<Props> = ({ value, onChange }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Фильтрация
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);
        
        if (val.length > 1) {
            const filtered = CITIES.filter(city => 
                city.toLowerCase().includes(val.toLowerCase())
            );
            setSuggestions(filtered);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Выбор
    const handleSelect = (city: string) => {
        onChange(city);
        setIsOpen(false);
    };

    // Клик вне компонента закрывает список
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input 
                    type="text"
                    value={value}
                    onChange={handleInput}
                    placeholder="Город (начните вводить...)"
                    className="w-full p-2 pl-9 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>

            {isOpen && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((city) => (
                        <li 
                            key={city}
                            onClick={() => handleSelect(city)}
                            className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                        >
                            {city}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};