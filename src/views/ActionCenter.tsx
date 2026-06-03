import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { getClients, Client } from '../services/dataService';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Trash2,
  Edit2
} from 'lucide-react';
import { format, isPast, parseISO, isToday, subDays } from 'date-fns';
import { DateRange, DatePreset, getDatePresetRange } from '../lib/seoUtils';
import DateRangeSelector from '../components/DateRangeSelector';
import ClientSelector from '../components/ClientSelector';
import NextActionModal from '../components/NextActionModal';

interface ClientAction {
  id: string;
  client_id: string;
  action_text: string;
  deadline: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  client?: Client;
}

export default function ActionCenter() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';
  
  const [actions, setActions] = useState<ClientAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('pending');
  const [selectedClient, setSelectedClient] = useState('');
  const [range, setRange] = useState<DateRange>(getDatePresetRange('last_28_days'));
  const [preset, setPreset] = useState<DatePreset>('last_28_days');
  const [clients, setClients] = useState<Client[]>([]);
  
  // For Editing
  const [editingActionFor, setEditingActionFor] = useState<Client | null>(null);
  const [editActionData, setEditActionData] = useState<{ id: string, text: string, deadline: string | null } | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const [clientsData, actionsData] = await Promise.all([
        getClients(),
        supabase.from('client_actions').select('*').order('created_at', { ascending: false })
      ]);

      if (actionsData.error) throw actionsData.error;

      setClients(clientsData);

      const clientsMap = new Map(clientsData.map(c => [c.id, c]));
      const enrichedActions = (actionsData.data || []).map(action => ({
        ...action,
        client: clientsMap.get(action.client_id)
      }));

      setActions(enrichedActions);
    } catch (e) {
      console.error('Failed to fetch actions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      // Optimistic update
      setActions(prev => prev.map(a => a.id === id ? { 
        ...a, 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      } : a));

      const { error } = await supabase
        .from('client_actions')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', id);
        
      if (error) throw error;
    } catch (e) {
      alert('Failed to update status');
      fetchActions(); // Revert on failure
    }
  };

  const deleteAction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this action?')) return;
    try {
      setActions(prev => prev.filter(a => a.id !== id));
      await supabase.from('client_actions').delete().eq('id', id);
    } catch (e) {
      alert('Failed to delete action');
      fetchActions();
    }
  };

  const filteredActions = actions.filter(action => {
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchText = action.action_text.toLowerCase().includes(term);
      const matchClient = action.client?.name.toLowerCase().includes(term) || action.client?.short_code.toLowerCase().includes(term);
      if (!matchText && !matchClient) return false;
    }

    // Client Filter
    if (selectedClient && action.client_id !== selectedClient) {
      return false;
    }

    const isCompleted = action.status === 'completed';

    // Status filter
    if (filter === 'pending' && isCompleted) return false;
    if (filter === 'completed' && !isCompleted) return false;
    if (filter === 'overdue') {
      if (isCompleted || !action.deadline || !isPast(parseISO(action.deadline)) || isToday(parseISO(action.deadline))) {
        return false;
      }
    }

    // Date Filter:
    // 1. Pending and Overdue tasks should ALWAYS be visible regardless of date range so they aren't forgotten
    // 2. Completed tasks or 'All' tasks use the date range, but we adjust for the 2-day GSC lag to include today's actions
    if (filter === 'completed' || filter === 'all') {
      const actionDate = action.created_at;
      // If the endDate is set to 2 days ago (due to GSC presets), we still want to show actions created today
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const adjustedEndDate = (range.endDate === format(subDays(new Date(), 2), 'yyyy-MM-dd')) 
        ? todayStr 
        : range.endDate;

      if (actionDate < range.startDate || actionDate > adjustedEndDate + 'T23:59:59') {
        // Only hide if it's completed. If it's pending/overdue, we keep it in 'all' view too
        if (isCompleted) return false;
      }
    }
    
    return true;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className={`p-8 rounded-[40px] border shadow-2xl relative z-50 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 ${
        isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/40 border-white/5'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
            isWhite ? 'bg-[#76c9be] shadow-[#76c9be]/20' : 'bg-blue-600 shadow-blue-600/20'
          }`}>
            <CheckCircle2 className="text-white" size={28} />
          </div>
          <div>
            <h2 className={`text-3xl font-medium font-heading tracking-tighter  italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
              Action Center
            </h2>
            <p className={`text-sm font-medium   mt-1 ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
              Manage cross-client execution tasks
            </p>
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto pb-2 md:pb-0">
            <div className="relative">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`} size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-12 pr-6 py-2.5 border rounded-2xl text-sm font-medium   outline-none w-48 ${
                  isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500'
                }`}
              />
            </div>
            
            <div className="shrink-0">
              <ClientSelector 
                clients={clients} 
                selectedId={selectedClient} 
                onSelect={setSelectedClient} 
              />
            </div>
            
            <div className="shrink-0">
              <DateRangeSelector 
                currentRange={range} 
                currentPreset={preset} 
                onRangeChange={(r, p) => { setRange(r); setPreset(p); }} 
              />
            </div>

            <div className={`flex rounded-2xl border p-1 shrink-0 ${isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800 border-white/5'}`}>
              {[
                { id: 'pending', label: 'Pending' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'completed', label: 'Completed' },
                { id: 'all', label: 'All' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium   transition-all ${
                    filter === f.id
                      ? isWhite ? 'bg-[#082a36] text-white shadow-md' : 'bg-blue-600 text-white shadow-md'
                      : isWhite ? 'text-[#607a80] hover:bg-[#76c9be]/10' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
      </div>

      {/* Action List */}
      <div className="grid gap-4">
        {loading ? (
          <div className={`p-12 text-center rounded-[24px] border border-dashed ${isWhite ? 'border-zinc-200 text-zinc-400' : 'border-white/10 text-zinc-500'}`}>
            <Clock className="mx-auto animate-spin mb-2" size={24} />
            <p className="text-sm font-medium  ">Loading Actions...</p>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className={`p-12 text-center rounded-[24px] border border-dashed ${isWhite ? 'bg-white border-zinc-200 text-zinc-400' : 'bg-zinc-900/50 border-white/10 text-zinc-500'}`}>
            <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm font-medium  ">No actions found.</p>
          </div>
        ) : (
          filteredActions.map(action => {
            const isCompleted = action.status === 'completed';
            const isOverdue = !isCompleted && action.deadline && isPast(parseISO(action.deadline)) && !isToday(parseISO(action.deadline));
            const statusColor = isCompleted 
              ? (isWhite ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20')
              : isOverdue 
                ? (isWhite ? 'text-red-600 bg-red-50 border-red-200' : 'text-red-400 bg-red-500/10 border-red-500/20')
                : (isWhite ? 'text-[#607a80] bg-zinc-50 border-zinc-200' : 'text-blue-400 bg-blue-500/10 border-blue-500/20');

            return (
              <div 
                key={action.id}
                className={`p-6 rounded-[24px] border transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group hover:scale-[1.01] ${
                  isWhite ? 'bg-white border-[#163f4d]/10 hover:shadow-lg' : 'bg-zinc-900/50 border-white/5 hover:border-white/10'
                } ${isCompleted ? 'opacity-60 grayscale-[50%]' : ''}`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <button 
                    onClick={() => toggleStatus(action.id, action.status)}
                    className={`mt-1 rounded-full flex-shrink-0 transition-colors ${isCompleted ? (isWhite ? 'text-emerald-500' : 'text-emerald-400') : (isWhite ? 'text-zinc-300 hover:text-[#76c9be]' : 'text-zinc-600 hover:text-blue-400')}`}
                  >
                    {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${isWhite ? 'text-[#082a36]' : 'text-white'} ${isCompleted ? 'line-through opacity-70' : ''}`}>
                      {action.action_text}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md border text-sm font-medium   flex items-center gap-1 ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-800 border-white/5 text-zinc-400'
                      }`}>
                        {action.client?.short_code || 'Unknown'} - {action.client?.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-sm font-medium   flex items-center gap-1 ${statusColor}`}>
                        <Calendar size={10} />
                        {action.deadline ? format(parseISO(action.deadline), 'MMM dd, yyyy') : 'No Deadline'}
                        {isOverdue && <AlertCircle size={10} className="ml-1" />}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (action.client) {
                        setEditActionData({ id: action.id, text: action.action_text, deadline: action.deadline });
                        setEditingActionFor(action.client);
                      }
                    }}
                    className={`p-2 rounded-xl border opacity-0 group-hover:opacity-100 transition-all ${
                      isWhite ? 'bg-zinc-50 border-zinc-200 text-[#607a80] hover:bg-[#76c9be]/10' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:bg-blue-500/10'
                    }`}
                    title="Edit action"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => deleteAction(action.id)}
                    className={`p-2 rounded-xl border opacity-0 group-hover:opacity-100 transition-all ${
                      isWhite ? 'bg-zinc-50 border-zinc-200 text-red-500 hover:bg-red-50' : 'bg-zinc-800 border-white/5 text-red-400 hover:bg-red-500/10'
                    }`}
                    title="Delete action"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingActionFor && editActionData && (
        <NextActionModal 
          client={editingActionFor} 
          onClose={() => {
            setEditingActionFor(null);
            setEditActionData(null);
          }}
          onSuccess={fetchActions}
          editData={{
            id: editActionData.id,
            action_text: editActionData.text,
            deadline: editActionData.deadline
          }}
        />
      )}
    </div>
  );
}
