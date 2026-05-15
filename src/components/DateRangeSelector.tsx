import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DateRange, DatePreset, getDatePresetRange } from '../lib/seoUtils';
import { useState } from 'react';
import Tooltip from './Tooltip';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onRangeChange: (range: DateRange, preset: DatePreset) => void;
  currentRange: DateRange;
  currentPreset: DatePreset;
}

export default function DateRangeSelector({ onRangeChange, currentRange, currentPreset }: Props) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const presets: { label: string; value: DatePreset }[] = [
    { label: 'Rolling 7D (GSC Sync)', value: 'rolling_7d' },
    { label: 'Last Week (Mon-Sun)', value: 'last_week' },
    { label: 'Last 28 Days', value: 'last_28_days' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'Last 3 Months', value: 'last_3_months' },
  ];

  const handlePresetSelect = (preset: DatePreset) => {
    const range = getDatePresetRange(preset);
    onRangeChange(range, preset);
    if (preset !== 'custom') setIsOpen(false);
  };

  return (
    <div className="relative">
      <Tooltip content="Adjust analysis time window">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-3 px-4 py-2 border rounded-xl shadow-xl transition-all text-xs font-black uppercase tracking-widest ${
            theme === 'white' ? 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50' : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
          }`}
        >
          <CalendarIcon size={16} className="text-blue-500" />
          {currentPreset === 'custom' 
            ? `${currentRange.startDate} - ${currentRange.endDate}`
            : presets.find(p => p.value === currentPreset)?.label || 'Select Date'}
          <ChevronDown size={14} className={`transition-transform text-zinc-500 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </Tooltip>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute right-0 mt-2 w-64 border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden backdrop-blur-xl ${
            theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/10'
          }`}>
            <div className="p-3 space-y-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    currentPreset === preset.value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : theme === 'white' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className={`border-t my-3 pt-3 ${theme === 'white' ? 'border-zinc-100' : 'border-white/5'}`}>
                <p className="px-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3">Custom Range</p>
                <div className="px-4 space-y-4 pb-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-zinc-500 font-black uppercase tracking-widest ml-0.5">Start Date</label>
                    <input
                      type="date"
                      value={currentRange.startDate}
                      onChange={(e) => onRangeChange({ ...currentRange, startDate: e.target.value }, 'custom')}
                      className={`w-full text-[11px] border rounded-xl p-2 font-mono focus:outline-none focus:border-blue-500 ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-zinc-500 font-black uppercase tracking-widest ml-0.5">End Date</label>
                    <input
                      type="date"
                      value={currentRange.endDate}
                      onChange={(e) => onRangeChange({ ...currentRange, endDate: e.target.value }, 'custom')}
                      className={`w-full text-[11px] border rounded-xl p-2 font-mono focus:outline-none focus:border-blue-500 ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
