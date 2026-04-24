/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ChevronRight, 
  Database, 
  FileText, 
  Layers, 
  LayoutDashboard, 
  Menu, 
  Settings, 
  TrendingUp, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Table as TableIcon,
  LineChart as ChartIcon,
  Archive,
  RotateCcw,
  Plus,
  MessageCircle,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WellDesign, PressurePoint, CasingSection, FluidPolicy } from './types';
import { analyzeWellData, chatWithWellAssistant } from './services/geminiService';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts';

const INITIAL_DATA: WellDesign[] = [
  {
    id: 'well-001',
    projectName: "ONGC_MUMBAI_HIGH",
    wellName: "EXP-X204 (OFFSET)",
    asset: 'Mumbai',
    reservoir: 'L-III',
    field: 'Mumbai High North',
    isArchived: false,
    casings: [
      { id: '1', name: 'Surface', holeSize: '26"', casingSize: '20"', depth: 1500, lithology: 'Unconsolidated Sands' },
      { id: '2', name: 'Intermediate', holeSize: '17 1/2"', casingSize: '13 3/8"', depth: 5000, lithology: 'Reactive Shales' },
      { id: '3', name: 'Production', holeSize: '12 1/4"', casingSize: '9 5/8"', depth: 9500, lithology: 'Carbonate Reservoir' },
    ],
    pressureProfile: [
      { depth: 0, porePressure: 8.3, fractureGradient: 12.5 },
      { depth: 1500, porePressure: 8.5, fractureGradient: 13.2 },
      { depth: 3000, porePressure: 9.2, fractureGradient: 14.1 },
      { depth: 5000, porePressure: 10.5, fractureGradient: 15.5 },
      { depth: 7500, porePressure: 11.2, fractureGradient: 17.2 },
      { depth: 9500, porePressure: 12.8, fractureGradient: 18.5 },
    ],
    fluidPolicies: [
      { section: 'Surface', fluidType: 'WBM', density: 9.2, funnelViscosity: 45, pv: 15, yp: 25, gels10s: 8, gels10m: 15, fluidLoss: 10 },
      { section: 'Intermediate', fluidType: 'OBM', density: 11.5, funnelViscosity: 55, pv: 28, yp: 22, gels10s: 12, gels10m: 22, fluidLoss: 4 },
      { section: 'Production', fluidType: 'OBM', density: 13.5, funnelViscosity: 65, pv: 35, yp: 18, gels10s: 15, gels10m: 30, fluidLoss: 2 },
    ]
  },
  {
    id: 'well-002',
    projectName: "GUJARAT_ONSHORE",
    wellName: "GJ-WEST-102",
    asset: 'Western',
    reservoir: 'Kalol',
    field: 'Mehsana',
    isArchived: true,
    casings: [],
    pressureProfile: [],
    fluidPolicies: []
  }
];

const ONGC_ASSETS = ['Mumbai', 'Western', 'Eastern', 'Southern', 'Cauvery', 'Assam'] as const;

const UnitConverter = () => {
  const [sg, setSg] = useState('');
  const [ppg, setPpg] = useState('');

  const handleSgChange = (val: string) => {
    setSg(val);
    if (!isNaN(Number(val)) && val !== '') {
      setPpg((Number(val) * 8.33).toFixed(2));
    } else {
      setPpg('');
    }
  };

  const handlePpgChange = (val: string) => {
    setPpg(val);
    if (!isNaN(Number(val)) && val !== '') {
      setSg((Number(val) / 8.33).toFixed(2));
    } else {
      setSg('');
    }
  };

  return (
    <div className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        <RotateCcw size={10} /> Unit Converter
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] text-slate-500 uppercase block mb-0.5">S.G.</label>
          <input 
            type="number" 
            value={sg} 
            onChange={(e) => handleSgChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-brand focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-[8px] text-slate-500 uppercase block mb-0.5">P.P.G.</label>
          <input 
            type="number" 
            value={ppg} 
            onChange={(e) => handlePpgChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-brand focus:outline-none focus:border-brand"
          />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'viz' | 'policy' | 'design' | 'archive' | 'historical'>('overview');
  const [projects, setProjects] = useState<WellDesign[]>(INITIAL_DATA);
  const [currentProjectId, setCurrentProjectId] = useState<string>(INITIAL_DATA[0].id);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [plannerId, setPlannerId] = useState('FD-SARAH-J');
  const [isEditingPlannerId, setIsEditingPlannerId] = useState(false);
  const [historicalViewMode, setHistoricalViewMode] = useState<'asset' | 'reservoir' | 'field'>('asset');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
    { role: 'model', content: 'Systems online. I am your Well Planning Assistant. How can I help with your design today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  const handleAnalyze = async () => {
    if (!uploadText) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeWellData(uploadText);
      if (result) {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p,
          wellName: result.wellName || "Extracted Design",
          casings: result.casings || p.casings,
          pressureProfile: result.pressureProfile || p.pressureProfile,
          fluidPolicies: result.fluidPolicies || p.fluidPolicies
        } : p));
        setActiveTab('viz');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleArchiveProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isArchived: true } : p));
  };

  const handleRestoreProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isArchived: false } : p));
  };

  const handleCreateProject = () => {
    const newProject: WellDesign = {
      ...INITIAL_DATA[0],
      id: `well-${Math.random().toString(36).substr(2, 9)}`,
      wellName: "New Well Design",
      asset: 'Mumbai',
      isArchived: false
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    setActiveTab('overview');
  };

  const handleRename = () => {
    if (tempName.trim()) {
      setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, wellName: tempName } : p));
      setIsEditingName(false);
    }
  };

  const handleAssetChange = (asset: typeof ONGC_ASSETS[number]) => {
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, asset } : p));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    const context = `
      Project: ${currentProject.wellName}
      Asset: ${currentProject.asset}
      Target Depth: ${Math.max(...currentProject.pressureProfile.map(p => p.depth), 0)} ft
      Casings: ${currentProject.casings.map(c => `${c.name} (${c.depth}ft)`).join(', ')}
      Fluid: ${currentProject.fluidPolicies.map(f => `${f.section}: ${f.density}ppg ${f.fluidType}`).join(' | ')}
    `;

    try {
      const result = await chatWithWellAssistant([...chatMessages, userMsg], context);
      setChatMessages(prev => [...prev, { role: 'model', content: result }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-navy text-white flex flex-col pt-6 pb-4 border-r border-slate-800 shadow-xl relative">
        <div className="px-6 mb-8 flex items-center gap-4">
          <div className="relative group">
            <div className="w-10 h-10 bg-brand rounded-sm flex items-center justify-center font-bold text-navy italic shadow-[4px_4px_0px_#0284c7,-2px_-2px_0px_#7dd3fc] transform -skew-x-6 hover:skew-x-0 transition-transform duration-300">
              FD
            </div>
            <div className="absolute -inset-1 bg-brand/30 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <div>
            <span className="font-mono text-xs tracking-widest font-extrabold text-brand block drop-shadow-sm">FLOW DYNAMICS</span>
            <span className="text-[10px] font-black text-white/50 tracking-[0.2em] uppercase bg-brand/20 px-1.5 py-0.5 rounded-sm border border-brand/30 mt-1 inline-block">IDWE - ONGC</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Projects</span>
              <button onClick={handleCreateProject} className="text-brand hover:text-brand-dark p-0.5">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {projects.filter(p => !p.isArchived).map(project => (
                <button
                  key={project.id}
                  onClick={() => setCurrentProjectId(project.id)}
                  className={`w-full text-left px-3 py-1.5 rounded text-[11px] truncate transition-colors ${
                    currentProjectId === project.id 
                      ? 'bg-navy-light text-brand font-bold border-l-2 border-brand' 
                      : 'text-slate-400 hover:bg-navy-light/50 hover:text-slate-200'
                  }`}
                >
                  {project.wellName}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mb-2"></div>

          <NavItem 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
            icon={<LayoutDashboard size={18} />} 
            label="Overview" 
          />
          <NavItem 
            active={activeTab === 'viz'} 
            onClick={() => setActiveTab('viz')} 
            icon={<ChartIcon size={18} />} 
            label="PP-FG Visualization" 
          />
          <NavItem 
            active={activeTab === 'design'} 
            onClick={() => setActiveTab('design')} 
            icon={<Layers size={18} />} 
            label="Well Design" 
          />
          <NavItem 
            active={activeTab === 'policy'} 
            onClick={() => setActiveTab('policy')} 
            icon={<TableIcon size={18} />} 
            label="Fluid Policy" 
          />
          <NavItem 
            active={activeTab === 'historical'} 
            onClick={() => setActiveTab('historical')} 
            icon={<TrendingUp size={18} />} 
            label="Historical Trends" 
          />
          <NavItem 
            active={activeTab === 'archive'} 
            onClick={() => setActiveTab('archive')} 
            icon={<Archive size={18} />} 
            label="Project Archive" 
          />
        </nav>

        <div className="px-4 mt-auto space-y-3">
          <UnitConverter />
          <div className="p-4 bg-slate-800/50 rounded border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-tighter mb-1">Planner ID</p>
            {isEditingPlannerId ? (
              <input
                autoFocus
                value={plannerId}
                onChange={(e) => setPlannerId(e.target.value)}
                onBlur={() => setIsEditingPlannerId(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingPlannerId(false)}
                className="bg-transparent text-brand text-sm font-medium border-b border-brand focus:outline-none w-full"
              />
            ) : (
              <p 
                onClick={() => setIsEditingPlannerId(true)}
                className="text-sm font-medium text-brand cursor-pointer hover:text-brand-dark flex items-center justify-between"
              >
                {plannerId}
                <Settings size={10} className="opacity-30" />
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-slate-300 flex items-center justify-between px-8 bg-white sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Planning Console</h1>
            <ChevronRight size={14} className="text-slate-300" />
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    className="bg-white border border-brand rounded px-2 py-0.5 text-sm font-semibold focus:outline-none"
                  />
                </div>
              ) : (
                <h2 
                  onClick={() => {
                    setTempName(currentProject.wellName);
                    setIsEditingName(true);
                  }}
                  className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-brand border-b border-transparent hover:border-brand transition-all"
                >
                  {currentProject.wellName}
                </h2>
              )}
              <select 
                value={currentProject.asset || 'Mumbai'}
                onChange={(e) => handleAssetChange(e.target.value as any)}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight focus:outline-none focus:border-brand transition-colors"
              >
                {ONGC_ASSETS.map(asset => (
                  <option key={asset} value={asset}>{asset} Asset</option>
                ))}
              </select>
            </div>
            {currentProject.isArchived ? (
              <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase border border-slate-200 flex items-center gap-1">
                <Archive size={10} />
                Archived
              </span>
            ) : (
              <span className="ml-2 px-2 py-0.5 bg-brand/10 text-brand-dark text-[10px] font-bold rounded uppercase border border-brand/20">Active Design</span>
            )}
          </div>
          <div className="flex gap-3">
            {!currentProject.isArchived && (
              <button 
                onClick={() => handleArchiveProject(currentProject.id)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors font-medium"
              >
                <Archive size={14} />
                Archive
              </button>
            )}
             <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              <Settings size={14} />
              Config
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 text-xs bg-brand text-white rounded hover:bg-brand-dark transition-all font-bold shadow-md shadow-brand/10 active:transform active:scale-95">
              GENERATE PLAN
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-12 gap-6"
              >
                {/* Stats */}
                <div className="col-span-12 grid grid-cols-4 gap-4 mb-2">
                  <StatCard label="Target Depth" value={`${Math.max(...currentProject.pressureProfile.map(p => p.depth))} ft`} icon={<Activity size={16} />} />
                  <StatCard label="Casing Sections" value={currentProject.casings.length.toString()} icon={<Database size={16} />} />
                  <StatCard label="Max Mud Weight" value={`${Math.max(...currentProject.fluidPolicies.map(p => p.density))} ppg`} icon={<TrendingUp size={16} />} />
                  <StatCard label="Asset Context" value={currentProject.asset || 'Mumbai'} icon={<FileText size={16} />} />
                </div>

                {/* Analysis Area */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase text-slate-500 flex items-center gap-2">
                      <FileText className="text-brand" size={16} />
                      Source Data Analysis
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea 
                        value={uploadText}
                        onChange={(e) => setUploadText(e.target.value)}
                        placeholder="Paste Offset Well Logs, PIT/LOT data, Formation Evaluation reports, or WCR strings here..."
                        className="w-full h-48 bg-slate-50/50 border border-slate-200 rounded p-4 text-[11px] font-mono text-slate-700 focus:outline-none focus:border-brand/50 transition-colors"
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <div className="p-1 px-2 text-[9px] bg-brand/10 text-brand-dark border border-brand/20 font-bold rounded">RAW DATA READY</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-slate-200 flex items-center justify-center">
                          <Upload size={18} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">Source Data Processor</p>
                          <p className="text-[10px] text-slate-500">Extracts lithology, casing seats, pressure data, and test results</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !uploadText}
                        className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-widest"
                      >
                        {isAnalyzing ? "Processing..." : "Process Data"}
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                  <div className="bg-white rounded border border-slate-300 p-6 shadow-sm">
                    <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                      <Settings size={16} />
                      Safety Invariants
                    </h3>
                    <div className="space-y-3">
                      <InvariantItem label="Safety Margin (PP)" value="0.5 ppg" />
                      <InvariantItem label="Safety Margin (FG)" value="0.8 ppg" />
                      <InvariantItem label="Max ECD" value="16.5 ppg" />
                      <InvariantItem label="Tolerance" value="2.5%" />
                    </div>
                  </div>

                  <div className="bg-brand-dark shadow-blue-900/40 text-white p-4 rounded shadow-lg flex items-center gap-3 border border-blue-800">
                    <div className="text-2xl font-bold flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center italic">i</div>
                    <div>
                      <div className="text-[10px] uppercase font-bold opacity-90">Formation Advisory</div>
                      <div className="text-[11px] font-medium leading-tight mt-0.5">Narrow drilling window detected in reservoir section. Monitor mud weight increments closely.</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'viz' && (
              <motion.div 
                key="viz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded border border-slate-200 p-8 h-[600px] flex flex-col shadow-sm"
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Pressure Gradient Analysis</h3>
                    <p className="text-xl font-bold text-slate-900 mt-1">PP-FG Formation Profile</p>
                  </div>
                  <div className="flex gap-6 items-center bg-slate-50 px-4 py-2 rounded border border-slate-200">
                    <LegendToggle color="#3b82f6" label="Pore Pressure" />
                    <LegendToggle color="#ef4444" label="Fracture Gradient" />
                    <LegendToggle color="#0ea5e9" label="Mud Weight" />
                  </div>
                </div>
                
                <div className="flex-1 -ml-4 bg-slate-50/30 rounded p-4 border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={currentProject.pressureProfile}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={true} />
                      <XAxis 
                        type="number" 
                        domain={[7, 20]} 
                        orientation="bottom" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickFormatter={(v) => `${v} ppg`}
                        label={{ value: 'PP / FG / MW (PPG)', position: 'insideBottom', offset: -10, fill: '#64748b', style: { fontSize: 10, fontWeight: '800' } }}
                      />
                      <YAxis 
                        dataKey="depth" 
                        type="number" 
                        reversed 
                        domain={[0, 'dataMax + 500']}
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold"
                        label={{ value: 'TRUE VERTICAL DEPTH (FT)', angle: -90, position: 'insideLeft', offset: -25, fill: '#64748b', style: { fontSize: 10, fontWeight: '800' } }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', fontSize: '11px', borderRadius: '4px', fontWeight: 'bold' }}
                        itemStyle={{ padding: '2px 0' }}
                        cursor={{ stroke: '#64748b', strokeWidth: 1 }}
                        formatter={(value: any) => [`${value} ppg`, '']}
                        labelFormatter={(label) => `Depth: ${label} ft`}
                      />

                      {/* Casing Indicators */}
                      {currentProject.casings.map((c) => (
                        <ReferenceLine 
                          key={c.id} 
                          y={c.depth} 
                          stroke="#94a3b8" 
                          strokeDasharray="5 5"
                          label={{ value: `${c.name} Shoe: ${c.depth}ft`, position: 'right', fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                        />
                      ))}

                      <Line 
                        name="Pore Pressure"
                        type="monotone" 
                        dataKey="porePressure" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        name="Fracture Gradient"
                        type="monotone" 
                        dataKey="fractureGradient" 
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        name="Mud Weight Policy"
                        type="stepAfter" 
                        data={currentProject.pressureProfile.map(p => ({
                          depth: p.depth,
                          mw: p.porePressure + 0.6
                        }))}
                        dataKey="mw" 
                        stroke="#0ea5e9" 
                        strokeWidth={4} 
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {activeTab === 'design' && (
              <motion.div 
                key="design"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white rounded border border-slate-300 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Prospective Well Design Table</h3>
                    <button className="text-[10px] font-bold text-brand hover:text-brand-dark bg-brand/10 px-2 py-1 rounded border border-brand/20 uppercase tracking-tighter">Add Section</button>
                  </div>
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter">Casing Section</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter">Hole Size</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter">Casing Size</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter">T.D. (ft)</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter">Lithology Analysis</th>
                        <th className="px-6 py-3 font-bold uppercase tracking-tighter text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium text-slate-800">
                      {currentProject.casings.map((c, i) => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold">{c.name}</td>
                          <td className="px-6 py-4">{c.holeSize}</td>
                          <td className="px-6 py-4">{c.casingSize}</td>
                          <td className="px-6 py-4 font-mono">{c.depth.toLocaleString()}</td>
                          <td className="px-6 py-4 text-slate-500 italic">{c.lithology}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 text-brand rounded-full border border-brand/20 font-bold uppercase text-[9px]">
                              <CheckCircle2 size={10} />
                              Validated
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'policy' && (
              <motion.div 
                key="policy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white rounded border border-slate-300 shadow-sm overflow-hidden">
                   <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Fluid Engineering Policy</h3>
                      <p className="text-lg font-bold text-slate-800 mt-1">Drilling Fluid Parameters</p>
                    </div>
                    <span className="text-[10px] bg-brand text-white font-bold px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">GTO COMPLIANT v2.4</span>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Section Phase</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Fluid System</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Weight (PPG)</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Funnel Vis (s/qt)</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">PV (cP)</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">YP (lb/100ft²)</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Gels (10s/10m)</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-tighter">Fluid Loss (cc)</th>
                        </tr>
                      </thead>
                      <tbody className="font-medium text-slate-800 divide-y divide-slate-100">
                        {currentProject.fluidPolicies.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 font-bold">{p.section}</td>
                            <td className="px-4 py-4 text-brand font-bold uppercase tracking-tighter">{p.fluidType}</td>
                            <td className="px-4 py-4 font-mono">{p.density}</td>
                            <td className="px-4 py-4 font-mono">{p.funnelViscosity}</td>
                            <td className="px-4 py-4 font-mono">{p.pv}</td>
                            <td className="px-4 py-4 font-mono">{p.yp}</td>
                            <td className="px-4 py-4 font-mono">{p.gels10s} / {p.gels10m}</td>
                            <td className="px-4 py-4 font-mono">{p.fluidLoss}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'historical' && (
              <motion.div 
                key="historical"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white rounded border border-slate-300 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Historical Trend Analysis</h3>
                      <p className="text-xl font-bold text-slate-900 mt-1">Cross-Project Data Visualizer</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => setHistoricalViewMode('asset')} className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${historicalViewMode === 'asset' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>ASSET WISE</button>
                       <button onClick={() => setHistoricalViewMode('field')} className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${historicalViewMode === 'field' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>FIELD WISE</button>
                       <button onClick={() => setHistoricalViewMode('reservoir')} className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${historicalViewMode === 'reservoir' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>RESERVOIR WISE</button>
                    </div>
                  </div>

                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={projects.map(p => ({
                          name: p.wellName,
                          maxDensity: Math.max(...p.fluidPolicies.map(fp => fp.density), 0),
                          category: p[historicalViewMode] || 'Unknown'
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" label={{ value: 'MAX MUD WEIGHT (PPG)', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 10, fontWeight: '800' } }} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', fontSize: '11px', borderRadius: '4px', fontWeight: 'bold' }} />
                        <Legend wrapperStyle={{ paddingTop: 10 }} />
                        <Line type="monotone" dataKey="maxDensity" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 6, fill: '#0ea5e9' }} strokeDasharray="5 5" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mt-8">
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Top Performers</p>
                        <p className="text-lg font-bold text-brand">{projects.length} wells analyzed</p>
                     </div>
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Mud Weight</p>
                        <p className="text-lg font-bold text-slate-800">
                          {(projects.reduce((acc, p) => acc + Math.max(...p.fluidPolicies.map(fp => fp.density), 0), 0) / (projects.length || 1)).toFixed(2)} PPG
                        </p>
                     </div>
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Assets Covered</p>
                        <p className="text-lg font-bold text-brand-dark">{new Set(projects.map(p => p.asset)).size} Regions</p>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {activeTab === 'archive' && (
            <motion.div 
              key="archive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {ONGC_ASSETS.map(asset => {
                const assetProjects = projects.filter(p => p.isArchived && p.asset === asset);
                if (assetProjects.length === 0) return null;

                return (
                  <div key={asset} className="bg-white rounded border border-slate-300 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        {asset} Asset Archive
                      </h3>
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded">
                        {assetProjects.length} RECORDS
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {assetProjects.map(project => (
                        <div key={project.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                              <Database size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800">{project.wellName}</h4>
                              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{project.projectName}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setCurrentProjectId(project.id);
                                setActiveTab('overview');
                              }}
                              className="px-3 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded border border-slate-200 hover:bg-slate-200 transition-colors uppercase"
                            >
                              View
                            </button>
                            <button 
                              onClick={() => handleRestoreProject(project.id)}
                              className="px-3 py-1 text-[10px] font-bold bg-blue-50 text-brand rounded border border-blue-100 hover:bg-blue-100 transition-colors uppercase flex items-center gap-1"
                            >
                              <RotateCcw size={10} />
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {projects.filter(p => p.isArchived).length === 0 && (
                <div className="bg-white rounded border border-slate-300 overflow-hidden shadow-sm p-12 text-center">
                  <Archive size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-500 font-medium lowercase">No projects archived in historical records</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Chatbot Interface */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="bg-navy p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-navy font-bold text-xs italic shadow-sm shadow-brand/50">FD</div>
                  <div>
                    <p className="text-xs font-bold leading-none tracking-tight">AI Planning Assistant</p>
                    <p className="text-[9px] text-brand font-bold mt-1 uppercase tracking-widest">IDWE-ONGC Systems Active</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="h-96 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs font-medium shadow-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-brand text-white rounded-tr-none' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 text-slate-400 rounded-2xl rounded-tl-none px-4 py-2 text-[10px] font-bold animate-pulse">
                      Processing technical query...
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about design, fluid loss, or casing seats..."
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-brand/50 transition-colors bg-slate-50/50"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                    className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center hover:bg-brand transition-all active:scale-90 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
            chatOpen ? 'bg-white text-navy rotate-90 border border-slate-100' : 'bg-brand text-white hover:bg-navy'
          }`}
        >
          {chatOpen ? <X size={24} /> : <MessageCircle size={24} />}
          {!chatOpen && (
             <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce"></div>
          )}
        </button>
      </div>

    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-all text-sm group ${
        active 
          ? 'bg-brand text-white font-bold shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-navy-light hover:text-brand'
      }`}
    >
      <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-brand'} transition-colors`}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
        <div className="text-brand group-hover:scale-110 transition-transform">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900 font-mono">{value}</div>
    </div>
  );
}

function InvariantItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-tighter">{label}</span>
      <span className="text-xs font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">{value}</span>
    </div>
  );
}

function LegendToggle({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{label}</span>
    </div>
  );
}

const FluidCard = ({ policy }: { policy: FluidPolicy }) => {
  return (
    <div className="bg-white border border-slate-200 rounded p-5 hover:border-brand/50 transition-all group shadow-sm hover:shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-800 tracking-tight">{policy.section} SECTION</h4>
          <p className="text-[10px] text-brand font-bold uppercase tracking-widest mt-1">{policy.fluidType} System</p>
        </div>
        <div className="w-8 h-8 rounded bg-navy flex items-center justify-center shadow-md">
           <Activity size={14} className="text-brand" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-y-4 gap-x-6 border-y border-slate-100 py-4">
        <FluidStat label="Density" value={`${policy.density} ppg`} />
        <FluidStat label="Yield Point" value={`${policy.yp} lb/100ft²`} />
        <FluidStat label="Viscosity" value={`${policy.pv} cp`} />
        <FluidStat label="Fluid Loss" value={`${policy.fluidLoss} cc`} />
      </div>

      <div className="mt-4 flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Offset Ref: FD-WCR-X204</span>
          <div className="text-brand opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1">
            <ChevronRight size={14} />
          </div>
      </div>
    </div>
  );
}

function FluidStat({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter mb-0.5">{label}</p>
      <p className="text-xs font-mono font-bold text-slate-800">{value}</p>
    </div>
  );
}
