import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { Client } from '../services/dataService';
import Tooltip from './Tooltip';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  clients: Client[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}

export default function ClientSelector({ clients, selectedId, onSelect, placeholder = "Select Client..." }: Props) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => 
    clients.find(c => c.id === selectedId), 
    [clients, selectedId]
  );

  const filteredClients = useMemo(() => {
    const s = search.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(s) || 
      (c.short_code && c.short_code.toLowerCase().includes(s))
    );
  }, [clients, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef} id="client-selector-container">
      <Tooltip content="Select active client property">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between w-full md:w-64 px-4 py-2 border rounded-xl shadow-xl transition-all text-xs font-black uppercase tracking-widest ${
            theme === 'white' ? 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50' : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
          }`}
          id="client-selector-button"
        >
          <span className="truncate">
            {selectedClient ? (
              <span className="flex items-center gap-2">
                {selectedClient.short_code && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-lg font-black font-mono">
                    {selectedClient.short_code}
                  </span>
                )}
                {selectedClient.name}
              </span>
            ) : placeholder}
          </span>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </Tooltip>

      {isOpen && (
        <div className={`absolute z-[100] mt-2 w-full min-w-[320px] border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-100 backdrop-blur-xl ${
          theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/10'
        }`} id="client-selector-dropdown">
          <div className={`p-3 border-b flex items-center gap-3 ${
            theme === 'white' ? 'border-zinc-100' : 'border-white/5'
          }`}>
            <Search size={16} className="text-zinc-600 ml-2" />
            <input
              autoFocus
              type="text"
              placeholder="Filter nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full py-2 text-xs bg-transparent outline-none placeholder:text-zinc-700 font-black uppercase tracking-widest ${
                theme === 'white' ? 'text-zinc-900' : 'text-white'
              }`}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    onSelect(client.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[11px] flex items-center justify-between transition-all ${
                    selectedId === client.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-black' 
                      : theme === 'white' ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 font-black' : 'text-zinc-500 hover:bg-white/5 hover:text-white font-black'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate uppercase tracking-tight">
                    {client.short_code && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg ${
                        selectedId === client.id ? 'bg-white/20' : theme === 'white' ? 'bg-zinc-100 text-zinc-500 border border-zinc-200' : 'bg-zinc-800 text-zinc-500 border border-white/5'
                      }`}>
                        {client.short_code}
                      </span>
                    )}
                    <span className="truncate">{client.name}</span>
                  </div>
                  {selectedId === client.id && <Check size={14} />}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-[10px] text-zinc-700 text-center font-black uppercase tracking-widest italic">Zero matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
