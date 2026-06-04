import { useState } from 'react';
import React from 'react';
import { Target, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { Client } from '../services/dataService';

interface NextActionModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
  editData?: { id: string, action_text: string, deadline: string | null };
}

export default function NextActionModal({ client, onClose, onSuccess, editData }: NextActionModalProps) {
  const { theme } = useTheme();
  const isWhite = theme === 'white';
  
  const [actionForm, setActionForm] = useState({ 
    text: editData?.action_text || '', 
    deadline: editData?.deadline ? editData.deadline.split('T')[0] : '' 
  });
  const [savingAction, setSavingAction] = useState(false);

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionForm.text || !actionForm.deadline) return;
    setSavingAction(true);
    
    try {
      let error;
      if (editData?.id) {
        // Update existing action
        const res = await supabase
          .from('client_actions')
          .update({
            action_text: actionForm.text,
            deadline: actionForm.deadline
          })
          .eq('id', editData.id);
        error = res.error;
      } else {
        // Insert new action(s) by splitting newlines
        const lines = actionForm.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const actionsToInsert = lines.map(line => ({
          client_id: client.id,
          action_text: line,
          deadline: actionForm.deadline,
          status: 'pending'
        }));
        
        if (actionsToInsert.length > 0) {
          const res = await supabase
            .from('client_actions')
            .insert(actionsToInsert);
          error = res.error;
        }
      }
        
      if (error) throw error;
      onSuccess();
      onClose(); // Automatically close the modal on success
    } catch (err) {
      console.error('Failed to save action:', err);
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl relative ${
        isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-950 border-white/10'
      }`}>
        <button 
          onClick={onClose}
          className={`absolute top-6 right-6 p-2 rounded-full transition-all ${
            isWhite ? 'hover:bg-zinc-100 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-400'
          }`}
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-2xl ${
            isWhite ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-blue-600/20 text-blue-400'
          }`}>
            <Target size={24} />
          </div>
          <div>
            <h3 className={`text-lg font-medium normal-case tracking-normal font-heading ${
              isWhite ? 'text-[#082a36]' : 'text-white'
            }`}>{editData ? 'Edit Action' : 'Next Action'}</h3>
            <p className={`text-sm font-medium normal-case tracking-normal ${
              isWhite ? 'text-[#607a80]' : 'text-zinc-500'
            }`}>For {client.name}</p>
          </div>
        </div>

        <form onSubmit={handleSaveAction} className="space-y-6">
          <div className="space-y-2">
            <label className={`text-sm font-medium normal-case tracking-normal ${
              isWhite ? 'text-zinc-500' : 'text-zinc-400'
            }`}>Action Description</label>
            <textarea 
              required
              value={actionForm.text}
              onChange={e => setActionForm({ ...actionForm, text: e.target.value })}
              className={`w-full px-4 py-3 border rounded-2xl text-sm font-medium resize-none h-24 outline-none focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/10 transition-all ${
                isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
              }`}
              placeholder="e.g. Optimize technical SEO issues on homepage..."
            />
          </div>
          
          <div className="space-y-2">
            <label className={`text-sm font-medium normal-case tracking-normal ${
              isWhite ? 'text-zinc-500' : 'text-zinc-400'
            }`}>Deadline Date</label>
            <input 
              type="date"
              required
              value={actionForm.deadline}
              onChange={e => setActionForm({ ...actionForm, deadline: e.target.value })}
              className={`w-full px-4 py-3 border rounded-2xl text-sm font-medium outline-none focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/10 transition-all ${
                isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
              }`}
            />
          </div>

          <button 
            disabled={savingAction}
            type="submit"
            className={`w-full py-4 rounded-2xl font-medium text-sm normal-case tracking-normal flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
              isWhite 
                ? 'bg-[#76c9be] text-white hover:bg-[#5bb8ad] shadow-lg shadow-[#76c9be]/20' 
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
            }`}
          >
            {savingAction ? (
              <span className="animate-pulse">{editData ? 'Updating...' : 'Injecting Action...'}</span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {editData ? 'Save Changes' : 'Confirm & Log Action'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
