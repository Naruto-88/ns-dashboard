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
          className={`flex items-center gap-3 px-4 py-2 border rounded-xl shadow-xl transition-all text-sm font-medium normal-case tracking-normal ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10 text-[#082a36] hover:bg-[#76c9be]/5' : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
          }`}
        >
          <CalendarIcon size={16} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
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
            theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-950 border-white/10'
          }`}>
            <div className="p-3 space-y-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium normal-case tracking-normal rounded-xl transition-all ${
                    currentPreset === preset.value
                      ? (theme === 'white' ? 'bg-[#76c9be] text-white shadow-lg shadow-[#76c9be]/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20')
                      : theme === 'white' ? 'text-[#607a80] hover:bg-[#76c9be]/5 hover:text-[#082a36]' : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className={`border-t my-3 pt-3 ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
                <p className={`px-4 text-sm font-medium normal-case tracking-normal mb-3 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-600'}`}>Custom Range</p>
                <div className="px-4 space-y-4 pb-2">
                  <div className="space-y-1.5">
                    <label className={`text-sm font-medium normal-case tracking-normal ml-0.5 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Start Date</label>
                    <input
                      type="date"
                      value={currentRange.startDate}
                      onChange={(e) => onRangeChange({ ...currentRange, startDate: e.target.value }, 'custom')}
                      className={`w-full text-sm border rounded-xl p-2 font-mono outline-none transition-all ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-sm font-medium normal-case tracking-normal ml-0.5 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>End Date</label>
                    <input
                      type="date"
                      value={currentRange.endDate}
                      onChange={(e) => onRangeChange({ ...currentRange, endDate: e.target.value }, 'custom')}
                      className={`w-full text-sm border rounded-xl p-2 font-mono outline-none transition-all ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`w-full py-3 rounded-xl text-sm font-medium normal-case tracking-normal transition-all shadow-xl active:scale-95 ${
                      theme === 'white' ? 'bg-[#76c9be] text-white shadow-[#76c9be]/20 hover:bg-[#76c9be]/90' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                    }`}
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
