
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Mail, MapPin, Building2, Crown, 
  Clock, CheckCircle2, FileText, FileBadge, 
  TrendingUp, Edit2, Calendar, Save, X, Phone,
  ExternalLink, Send, Wallet, Trash2, Tag, StickyNote, Plus, Check, Sparkles
} from 'lucide-react';
import { Invoice, InvoiceStatus, DbClient } from '../types';

interface ClientDetailProps {
  clientName: string;
  invoices: Invoice[];
  dbClientData?: DbClient; // NEW: Rich Data from DB
  onBack: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onUpdateClientContact: (oldName: string, newContact: DbClient) => void;
  onCreateDocument?: (type: 'Invoice' | 'Quote') => void; // New prop for direct creation
  currencySymbol: string;
}

const ClientDetail: React.FC<ClientDetailProps> = ({ 
  clientName, 
  invoices, 
  dbClientData,
  onBack, 
  onSelectInvoice,
  onUpdateClientContact,
  onCreateDocument,
  currencySymbol 
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Local states for quick edits
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNote, setTempNote] = useState('');

  // Aggregate Client Data
  const { clientData, activeDocs, historyDocs, stats } = useMemo(() => {
    const clientDocs = invoices.filter(i => i.clientName === clientName);
    
    // Sort: Newest first
    clientDocs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Extract latest contact info from most recent doc or DB
    const latestDoc: Partial<Invoice> = clientDocs[0] || {};
    
    // Stats: Total Revenue Logic with Partial Payments
    const totalRevenue = clientDocs
      .filter(i => i.type === 'Invoice')
      .reduce((acc, curr) => {
          let collected = 0;
          if (curr.amountPaid && curr.amountPaid > 0) {
              collected = curr.amountPaid;
          } else if (curr.status === 'Pagada' || curr.status === 'Aceptada') {
              collected = curr.total;
          }
          return acc + collected;
      }, 0);

    // Stats: Total Quoted (For Prospects/Pipeline)
    const totalQuoted = clientDocs
      .filter(i => i.type === 'Quote' && i.status !== 'Rechazada')
      .reduce((acc, curr) => acc + curr.total, 0);
      
    const openQuotes = clientDocs.filter(i => i.type === 'Quote' && (i.status === 'Enviada' || i.status === 'Negociacion'));
    const pendingInvoices = clientDocs.filter(i => i.type === 'Invoice' && (i.status === 'Enviada' || i.status === 'Seguimiento'));
    
    const active = [...openQuotes, ...pendingInvoices].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const history = clientDocs.filter(d => !active.includes(d));

    // Determine status
    // If dbClientData.status exists, use it. Otherwise guess based on invoices.
    const isProspect = dbClientData?.status === 'PROSPECT' || (!dbClientData && clientDocs.length > 0 && !clientDocs.some(i => i.type === 'Invoice'));

    // VIP Logic
    const isVip = totalRevenue > 5000 || clientDocs.length > 10;

    return {
      clientData: {
        name: clientName,
        // Priority to DB Data, fallback to invoices
        email: dbClientData?.email || latestDoc.clientEmail || '',
        taxId: dbClientData?.taxId || latestDoc.clientTaxId || '',
        address: dbClientData?.address || latestDoc.clientAddress || '',
        phone: dbClientData?.phone || '',
        tags: dbClientData?.tags || '',
        notes: dbClientData?.notes || '',
      },
      activeDocs: active,
      historyDocs: history,
      stats: {
        totalRevenue,
        totalQuoted,
        docCount: clientDocs.length,
        isVip,
        isProspect,
        lastInteraction: latestDoc.date || new Date().toISOString()
      }
    };
  }, [invoices, clientName, dbClientData]);

  // Edit State for Profile
  const [editForm, setEditForm] = useState(clientData);

  // Sync form when client changes
  useEffect(() => {
    setEditForm(clientData);
    setTempNote(clientData.notes || '');
  }, [clientData]);

  // --- HANDLERS ---

  // 1. General Profile Save
  const handleProfileSave = () => {
    onUpdateClientContact(clientName, {
      ...dbClientData, 
      name: clientName,
      email: editForm.email,
      address: editForm.address,
      taxId: editForm.taxId,
      phone: editForm.phone,
      // Keep existing tags/notes when saving profile info
      tags: clientData.tags,
      notes: clientData.notes
    });
    setIsEditingProfile(false);
  };

  // 2. Tag Logic
  const handleAddTag = () => {
    if (!newTag.trim()) {
        setIsAddingTag(false);
        return;
    }
    const currentTags = clientData.tags ? clientData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (!currentTags.includes(newTag.trim())) {
        const updatedTags = [...currentTags, newTag.trim()].join(',');
        
        onUpdateClientContact(clientName, {
            ...dbClientData,
            name: clientName,
            tags: updatedTags
        });
    }
    setNewTag('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = clientData.tags ? clientData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove).join(',');
    
    onUpdateClientContact(clientName, {
        ...dbClientData,
        name: clientName,
        tags: updatedTags
    });
  };

  // 3. Note Logic
  const handleNoteSave = () => {
    onUpdateClientContact(clientName, {
        ...dbClientData,
        name: clientName,
        notes: tempNote
    });
    setIsEditingNote(false);
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch(status) {
      case 'Aceptada': return 'text-green-600 bg-green-50 border-green-100';
      case 'Pagada': return 'text-green-600 bg-green-50 border-green-100';
      case 'Abonada': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'Negociacion': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'Rechazada': return 'text-red-600 bg-red-50 border-red-100';
      case 'Incobrable': return 'text-red-600 bg-red-50 border-red-100';
      case 'PendingSync': return 'text-amber-600 bg-amber-50 border-amber-100';
      default: return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full animate-in slide-in-from-right-4 duration-300">
      
      {/* HEADER: VISCERAL & IDENTITY */}
      <div className="relative mb-8 group">
        <div className={`absolute inset-0 rounded-[2.5rem] opacity-10 transition-colors duration-500 ${stats.isVip ? 'bg-amber-400' : 'bg-slate-800'}`}></div>
        <div className={`relative bg-white rounded-[2.5rem] p-8 border shadow-xl overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${stats.isVip ? 'border-amber-100' : 'border-slate-100'}`}>
           
           {/* Decor */}
           <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 opacity-20 pointer-events-none ${stats.isVip ? 'bg-amber-400' : 'bg-blue-600'}`}></div>

           <div className="flex items-center gap-6 relative z-10">
              <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
                 <ArrowLeft className="w-6 h-6 text-slate-500" />
              </button>
              
              <div className="flex items-center gap-4">
                 <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center text-2xl font-bold shadow-sm ${stats.isVip ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {stats.isVip ? <Crown className="w-8 h-8 fill-amber-700" /> : clientName.substring(0,2).toUpperCase()}
                 </div>
                 <div>
                    <h1 className="text-3xl font-bold text-[#1c2938] flex items-center gap-3">
                       {clientName}
                       {stats.isVip && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-lg border border-amber-200 uppercase tracking-widest font-bold flex items-center gap-1"><Crown className="w-3 h-3" /> VIP</span>}
                       {stats.isProspect && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-lg border border-purple-200 uppercase tracking-widest font-bold flex items-center gap-1"><Sparkles className="w-3 h-3" /> Prospecto</span>}
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                       <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Última actividad: {new Date(stats.lastInteraction).toLocaleDateString()}</span>
                       <span>•</span>
                       <span>{stats.docCount} Documentos</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="text-right relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {stats.isProspect ? 'Proyección (Pipeline)' : 'Valor de Vida (LTV)'}
              </p>
              <h2 className="text-4xl font-bold text-[#1c2938] tracking-tight">
                  {currencySymbol}{stats.isProspect ? stats.totalQuoted.toLocaleString() : stats.totalRevenue.toLocaleString()}
              </h2>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* LEFT COLUMN: CONTACT & INFO */}
         <div className="lg:col-span-1 space-y-6">
            
            {/* CONTACT CARD */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-[#1c2938] flex items-center gap-2">
                     <Building2 className="w-5 h-5 text-slate-400" /> Perfil
                  </h3>
                  <button 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className={`p-2 rounded-xl transition-all ${isEditingProfile ? 'bg-slate-100 text-[#1c2938]' : 'text-slate-400 hover:text-[#27bea5] hover:bg-slate-50'}`}
                  >
                     {isEditingProfile ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </button>
               </div>

               <div className="space-y-5">
                  {/* Email */}
                  <div className="group">
                     <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                        <Mail className="w-3 h-3" /> Email
                     </label>
                     {isEditingProfile ? (
                        <input 
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:border-[#27bea5]"
                        />
                     ) : (
                        <div className="flex justify-between items-center">
                           <p className="font-medium text-[#1c2938] truncate">{clientData.email || 'No registrado'}</p>
                           {clientData.email && <a href={`mailto:${clientData.email}`} className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-50 hover:bg-blue-50 text-blue-500 rounded-lg transition-all"><Send className="w-3 h-3" /></a>}
                        </div>
                     )}
                  </div>

                  {/* Phone */}
                  <div className="group">
                     <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                        <Phone className="w-3 h-3" /> Teléfono
                     </label>
                     {isEditingProfile ? (
                        <input 
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:border-[#27bea5]"
                          placeholder="+507 6000-0000"
                        />
                     ) : (
                        <div className="flex justify-between items-center">
                           <p className="font-medium text-[#1c2938] truncate">{clientData.phone || 'No registrado'}</p>
                        </div>
                     )}
                  </div>

                  {/* Tax ID */}
                  <div>
                     <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                        <FileText className="w-3 h-3" /> ID Fiscal
                     </label>
                     {isEditingProfile ? (
                        <input 
                          value={editForm.taxId}
                          onChange={(e) => setEditForm({...editForm, taxId: e.target.value})}
                          className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:border-[#27bea5]"
                        />
                     ) : (
                        <p className="font-mono font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block text-sm">{clientData.taxId || 'N/A'}</p>
                     )}
                  </div>

                  {/* Address */}
                  <div>
                     <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3" /> Dirección
                     </label>
                     {isEditingProfile ? (
                        <textarea 
                          value={editForm.address}
                          onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:border-[#27bea5] h-20 resize-none"
                        />
                     ) : (
                        <p className="text-sm text-slate-500 leading-relaxed">{clientData.address || 'No registrada'}</p>
                     )}
                  </div>

                  {isEditingProfile && (
                     <button 
                       onClick={handleProfileSave}
                       className="w-full py-3 bg-[#1c2938] text-white rounded-xl font-bold text-sm hover:bg-[#27bea5] transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg"
                     >
                        <Save className="w-4 h-4" /> Guardar Perfil
                     </button>
                  )}
               </div>
            </div>

            {/* TAGS CARD (OPERATIONAL) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#1c2938] flex items-center gap-2 text-sm uppercase tracking-wider">
                        <Tag className="w-4 h-4 text-slate-400" /> Etiquetas
                    </h3>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    {clientData.tags ? clientData.tags.split(',').filter(Boolean).map((tag, idx) => (
                        <span key={idx} className="pl-3 pr-1 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-1 group">
                            {tag.trim()}
                            <button 
                                onClick={() => handleRemoveTag(tag.trim())}
                                className="p-0.5 rounded-full hover:bg-slate-300 hover:text-red-500 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )) : (
                        <p className="text-xs text-slate-400 italic">Sin etiquetas.</p>
                    )}

                    {/* Quick Add Tag */}
                    {isAddingTag ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
                            <input 
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                className="w-24 px-2 py-1 text-xs bg-white border border-[#27bea5] rounded-lg outline-none focus:ring-1 focus:ring-[#27bea5]"
                                placeholder="Nueva..."
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                autoFocus
                            />
                            <button onClick={handleAddTag} className="p-1 bg-[#27bea5] text-white rounded-full hover:scale-110 transition-transform">
                                <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setIsAddingTag(false)} className="p-1 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsAddingTag(true)}
                            className="p-1 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-[#27bea5] hover:border-[#27bea5] transition-all"
                            title="Agregar etiqueta"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* NOTES CARD (OPERATIONAL) */}
            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <StickyNote className="w-4 h-4" /> Notas Internas
                    </h3>
                    {!isEditingNote && (
                        <button 
                            onClick={() => setIsEditingNote(true)}
                            className="text-amber-600 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                
                {isEditingNote ? (
                    <div className="animate-in fade-in">
                        <textarea 
                           value={tempNote}
                           onChange={(e) => setTempNote(e.target.value)}
                           className="w-full p-3 bg-white/80 border border-amber-200 rounded-xl text-sm outline-none focus:border-amber-400 h-24 resize-none text-amber-900 mb-2"
                           placeholder="Preferencias, recordatorios..."
                           autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsEditingNote(false)} className="text-xs font-bold text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">Cancelar</button>
                            <button onClick={handleNoteSave} className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Guardar Nota</button>
                        </div>
                    </div>
                ) : (
                    <p 
                        className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-amber-100/50 p-1 -m-1 rounded transition-colors"
                        onClick={() => setIsEditingNote(true)}
                        title="Clic para editar"
                    >
                        {clientData.notes || <span className="italic text-amber-700/50">Escribe aquí notas privadas sobre el cliente...</span>}
                    </p>
                )}
            </div>

            {/* QUICK ACTIONS CARD */}
            <div className="bg-[#27bea5]/5 p-6 rounded-[2rem] border border-[#27bea5]/20">
               <h3 className="font-bold text-[#1c2938] mb-4 text-sm uppercase tracking-wider">Acciones Rápidas</h3>
               <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => onCreateDocument && onCreateDocument('Quote')} 
                    className="bg-white p-3 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                  >
                     <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors"><FileBadge className="w-4 h-4" /></div>
                     <span className="text-xs font-bold text-slate-600 block">Nueva Cotización</span>
                  </button>
                  <button 
                    onClick={() => onCreateDocument && onCreateDocument('Invoice')} 
                    className="bg-white p-3 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                  >
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText className="w-4 h-4" /></div>
                     <span className="text-xs font-bold text-slate-600 block">Nueva Factura</span>
                  </button>
               </div>
            </div>
         </div>

         {/* RIGHT COLUMN: BITACORA & HISTORY */}
         <div className="lg:col-span-2 space-y-8">
            
            {/* BITACORA (Active Log) */}
            <div className="space-y-4">
               <h3 className="font-bold text-[#1c2938] text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#27bea5]" /> Bitácora Activa
                  <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{activeDocs.length}</span>
               </h3>

               {activeDocs.length > 0 ? (
                  <div className="space-y-3">
                     {activeDocs.map(doc => (
                        <div 
                          key={doc.id}
                          onClick={() => onSelectInvoice(doc)}
                          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-[#27bea5] hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                        >
                           <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${doc.type === 'Quote' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                 {doc.type === 'Quote' ? <FileBadge className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                              </div>
                              <div>
                                 <h4 className="font-bold text-[#1c2938] group-hover:text-[#27bea5] transition-colors">
                                    {doc.type === 'Quote' ? 'Cotización' : 'Factura'} #{doc.id}
                                 </h4>
                                 <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> {new Date(doc.date).toLocaleDateString()}
                                 </p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-lg text-[#1c2938]">{currencySymbol}{doc.total.toLocaleString()}</p>
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${getStatusColor(doc.status)}`}>
                                 {doc.status}
                              </span>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                     <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                     <p className="text-slate-500 font-medium">Todo al día</p>
                     <p className="text-slate-400 text-sm">No hay documentos pendientes con este cliente.</p>
                  </div>
               )}
            </div>

            {/* HISTORY */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
               <h3 className="font-bold text-slate-400 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Historial Cerrado
               </h3>
               
               <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-50">
                  {historyDocs.map(doc => (
                     <div 
                       key={doc.id}
                       onClick={() => onSelectInvoice(doc)}
                       className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer first:rounded-t-3xl last:rounded-b-3xl"
                     >
                        <div className="flex items-center gap-4">
                           <div className={`w-2 h-2 rounded-full ${doc.status === 'Aceptada' || doc.status === 'Pagada' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                           <div>
                              <p className="font-medium text-[#1c2938] text-sm">{doc.type === 'Quote' ? 'Cotización' : 'Factura'} #{doc.id}</p>
                              <p className="text-xs text-slate-400">{new Date(doc.date).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-slate-600 text-sm">{currencySymbol}{doc.total.toLocaleString()}</p>
                           {doc.status === 'Rechazada' && <span className="text-[10px] text-red-400 font-bold">Rechazada</span>}
                           {doc.status === 'Incobrable' && <span className="text-[10px] text-red-400 font-bold">Incobrable</span>}
                        </div>
                     </div>
                  ))}
                  {historyDocs.length === 0 && (
                     <div className="p-8 text-center text-slate-400 text-sm">
                        Sin historial previo.
                     </div>
                  )}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default ClientDetail;
