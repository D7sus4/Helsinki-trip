import React, { useState, useEffect } from 'react';
import { 
  Plane, Calendar, CheckSquare, Heart, MapPin, Coffee, ShoppingBag, 
  Camera, Sun, Trash2, Plus, ChevronRight, Luggage, X, Link as LinkIcon, 
  ArrowLeft, ExternalLink, Globe, AlertCircle, Edit2, Save, ArrowRightLeft, 
  Wallet, CreditCard, Banknote, Coins, RefreshCw, Sparkles, Loader2, MessageCircle
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

// --- Types ---
type TabType = 'home' | 'schedule' | 'packing' | 'spots' | 'expenses';
type SpotCategory = 'sightseeing' | 'shopping' | 'food' | 'cafe' | 'other';
type ItemCategory = 'essential' | 'clothing' | 'beauty' | 'electronics' | 'other';
type IconType = 'plane' | 'map' | 'shopping' | 'sun' | 'camera' | 'coffee' | 'heart' | 'luggage';
type Currency = 'JPY' | 'EUR';
type Payer = 'Misaki' | 'Yutaro';
type PaymentMethod = 'Credit Card' | 'Cashless' | 'Cash';
type ExpenseCategory = 'Food' | 'Transport' | 'Shopping' | 'Stay' | 'Ticket' | 'Other';

interface Flight {
  type: 'outbound' | 'inbound';
  date: string;
  depTime: string;
  arrTime: string;
  from: string;
  to: string;
  flightNo: string;
  duration?: string;
}

interface PackingItem {
  id: string;
  text: string;
  checked: boolean;
  category: ItemCategory;
}

interface LinkItem {
  id: string;
  title: string;
  url: string;
}

interface Spot {
  id: string;
  title: string;
  category: SpotCategory;
  description: string;
  imageColor: string;
  links: LinkItem[];
}

interface ScheduleEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  location?: string;
  link?: string;
}

interface ScheduleDay {
  id: string;
  date: string;
  dayOfWeek: string;
  title: string;
  iconType: IconType;
  content: string;
  events: ScheduleEvent[];
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  payer: Payer;
  method: PaymentMethod;
  category: ExpenseCategory;
  date: string;
}

// --- Initial Data ---
const FLIGHTS: Flight[] = [
  { type: 'outbound', date: '6/19 (Fri)', depTime: '22:50', arrTime: '05:55', from: 'NGO (Nagoya)', to: 'HEL (Helsinki)', flightNo: 'AY0080', duration: '13h 05m' },
  { type: 'inbound', date: '6/28 (Sun)', depTime: '00:45', arrTime: '19:35', from: 'HEL (Helsinki)', to: 'NGO (Nagoya)', flightNo: 'AY0079', duration: '12h 50m' }
];

const INITIAL_PACKING_LIST: PackingItem[] = [
  { id: '1', text: 'パスポート', checked: false, category: 'essential' },
  { id: '2', text: 'eチケット控え', checked: false, category: 'essential' },
  { id: '3', text: 'クレジットカード', checked: false, category: 'essential' },
  { id: '4', text: '変換プラグ (Cタイプ)', checked: false, category: 'electronics' },
  { id: '5', text: 'モバイルバッテリー', checked: false, category: 'electronics' },
  { id: '6', text: '保湿クリーム', checked: false, category: 'beauty' },
  { id: '7', text: '日焼け止め', checked: false, category: 'beauty' },
  { id: '8', text: '歯ブラシセット', checked: false, category: 'essential' },
  { id: '9', text: 'ウルトラライトダウン', checked: false, category: 'clothing' },
  { id: '10', text: '歩きやすいスニーカー', checked: false, category: 'clothing' },
];

const INITIAL_SPOTS: Spot[] = [
  { id: '1', title: 'Marimekko本社アウトレット', category: 'shopping', description: '絶対行きたい！社員食堂「Maritori」でランチも。', imageColor: 'bg-red-400', links: [{ id: 'l1', title: '公式サイト', url: 'https://www.marimekko.com/' }] },
  { id: '2', title: 'Cafe Aalto', category: 'cafe', description: '映画「かもめ食堂」のロケ地。', imageColor: 'bg-amber-700', links: [] },
  { id: '3', title: 'ヘルシンキ大聖堂', category: 'sightseeing', description: '白亜の美しい大聖堂。', imageColor: 'bg-blue-400', links: [] },
  { id: '4', title: 'Löyly (ロウリュ)', category: 'sightseeing', description: '海に入れるおしゃれサウナ。', imageColor: 'bg-stone-600', links: [] },
];

const INITIAL_SCHEDULE: ScheduleDay[] = [
  { id: 'd1', date: '6/19', dayOfWeek: 'Fri', title: '出発 & 機内泊', iconType: 'plane', content: '夜、セントレアから出発！機内では寝て時差ボケ対策。', events: [] },
  { id: 'd2', date: '6/20', dayOfWeek: 'Sat', title: 'ヘルシンキ到着', iconType: 'map', content: '早朝到着。荷物を預けてエスプラナーディ公園を散歩。', events: [] },
  { id: 'd3', date: '6/21', dayOfWeek: 'Sun', title: 'マリメッコDay', iconType: 'shopping', content: 'マリメッコ本社へ！(日曜営業要確認)', events: [] },
  { id: 'd4', date: '6/22', dayOfWeek: 'Mon', title: 'タリン日帰り旅行', iconType: 'luggage', content: 'フェリーでエストニアのタリンへ。', events: [] },
  { id: 'd5', date: '6/23', dayOfWeek: 'Tue', title: 'サウナ & 自然', iconType: 'sun', content: 'Löylyでサウナ体験。', events: [] },
  { id: 'd6', date: '6/24', dayOfWeek: 'Wed', title: '美術館巡り', iconType: 'camera', content: 'アモス・レックスやキアズマ現代美術館へ。', events: [] },
  { id: 'd7', date: '6/25', dayOfWeek: 'Thu', title: 'お土産探し', iconType: 'shopping', content: 'ストックマンデパートやスーパーへ。', events: [] },
  { id: 'd8', date: '6/26', dayOfWeek: 'Fri', title: 'のんびりDay', iconType: 'coffee', content: '気に入ったカフェ再訪。', events: [] },
  { id: 'd9', date: '6/27', dayOfWeek: 'Sat', title: '最終日ディナー', iconType: 'heart', content: '最後の夜は美味しいサーモンを。', events: [] },
  { id: 'd10', date: '6/28', dayOfWeek: 'Sun', title: '帰国', iconType: 'plane', content: '00:45発。機内で爆睡。', events: [] },
];

const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', title: '航空券 (2人分)', amount: 267560, currency: 'JPY', payer: 'Misaki', method: 'Credit Card', category: 'Ticket', date: '2026-01-10' },
  { id: 'e2', title: 'ホテル予約', amount: 450, currency: 'EUR', payer: 'Yutaro', method: 'Credit Card', category: 'Stay', date: '2026-02-15' },
];

// --- Gemini API Helper ---
const apiKey = ""; 

const callGemini = async (prompt: string): Promise<string> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    if (!response.ok) throw new Error('API call failed');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "";
  }
};

// --- Firebase Init ---
let app, auth, db;
let isFirebaseAvailable = false;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseAvailable = true;
    if (typeof __app_id !== 'undefined') appId = __app_id;
  }
} catch (e) {
  console.error("Firebase init failed:", e);
  isFirebaseAvailable = false;
}

// --- Components ---

const Header = ({ activeTab, setActiveTab }: { activeTab: TabType, setActiveTab: (t: TabType) => void }) => (
  <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 border-b border-blue-100 h-16 flex items-center justify-between px-4 shadow-sm overflow-x-auto no-scrollbar">
    <div className="flex items-center gap-2 cursor-pointer flex-shrink-0 mr-4" onClick={() => setActiveTab('home')}>
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-blue-200 shadow-lg">M</div>
      <span className="font-bold text-blue-900 text-lg tracking-tight hidden sm:block">Helsinki Trip</span>
    </div>
    <div className="flex gap-1 bg-slate-100 p-1 rounded-full text-xs font-medium text-slate-500 flex-shrink-0">
      <button onClick={() => setActiveTab('schedule')} className={`px-3 py-1.5 rounded-full ${activeTab === 'schedule' ? 'bg-white text-blue-600 shadow-sm' : ''}`}>Plan</button>
      <button onClick={() => setActiveTab('spots')} className={`px-3 py-1.5 rounded-full ${activeTab === 'spots' ? 'bg-white text-blue-600 shadow-sm' : ''}`}>Spots</button>
      <button onClick={() => setActiveTab('packing')} className={`px-3 py-1.5 rounded-full ${activeTab === 'packing' ? 'bg-white text-blue-600 shadow-sm' : ''}`}>Items</button>
      <button onClick={() => setActiveTab('expenses')} className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${activeTab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : ''}`}><Wallet className="w-3 h-3" />Wallet</button>
    </div>
  </nav>
);

const FlightCard = ({ flight }: { flight: Flight }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50 mb-4 relative overflow-hidden group hover:shadow-md transition-all">
    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500" />
    <div className="flex justify-between items-center mb-4">
      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">{flight.type === 'outbound' ? 'Going' : 'Return'}</span>
      <span className="text-gray-400 text-xs font-mono">{flight.date}</span>
    </div>
    <div className="flex justify-between items-center">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-800">{flight.depTime}</div>
        <div className="text-xs text-gray-500 font-medium">{flight.from}</div>
      </div>
      <div className="flex-1 px-4 flex flex-col items-center">
        <div className="text-xs text-gray-400 mb-1">{flight.duration}</div>
        <div className="w-full h-px bg-gray-300 relative flex items-center justify-center">
          <Plane className="w-4 h-4 text-blue-500 absolute bg-white p-0.5 rotate-90" />
        </div>
        <div className="text-[10px] text-blue-400 mt-1 font-mono">{flight.flightNo}</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-800">{flight.arrTime}</div>
        <div className="text-xs text-gray-500 font-medium">{flight.to}</div>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <div className="relative pt-24 pb-10 px-6 bg-gradient-to-b from-blue-50 to-white overflow-hidden">
    <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-yellow-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob"></div>
    <div className="absolute top-20 left-[-30px] w-48 h-48 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-2000"></div>
    <div className="relative z-10">
      <div className="inline-block px-3 py-1 bg-white border border-blue-100 rounded-full text-blue-600 text-xs font-bold mb-4 shadow-sm">🇫🇮 FINLAND TRIP 2026</div>
      <h1 className="text-4xl font-extrabold text-slate-800 leading-tight mb-2">Misaki's<br/><span className="text-blue-600">Nordic Holiday</span></h1>
      <p className="text-slate-500 mb-6 flex items-center gap-2 text-sm"><Calendar className="w-4 h-4" /> June 19 - June 28</p>
    </div>
  </div>
);

const ExpensesView = ({ expenses, setExpenses }: { expenses: Expense[], setExpenses: (e: Expense[]) => void }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(165);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ title: '', amount: '' as any, currency: 'JPY', payer: 'Misaki', method: 'Credit Card', category: 'Food', date: new Date().toISOString().split('T')[0] });
  
  const misakiTotalJPY = expenses.filter(e => e.payer === 'Misaki').reduce((acc, cur) => acc + Number(cur.amount) * (cur.currency === 'EUR' ? exchangeRate : 1), 0);
  const yutaroTotalJPY = expenses.filter(e => e.payer === 'Yutaro').reduce((acc, cur) => acc + Number(cur.amount) * (cur.currency === 'EUR' ? exchangeRate : 1), 0);
  const grandTotal = misakiTotalJPY + yutaroTotalJPY;
  const balance = misakiTotalJPY - (grandTotal / 2);

  const handleAdd = () => {
    if (!newExpense.title || !newExpense.amount) return;
    setExpenses([{ id: Date.now().toString(), title: newExpense.title!, amount: Number(newExpense.amount), currency: newExpense.currency as Currency, payer: newExpense.payer as Payer, method: newExpense.method as PaymentMethod, category: newExpense.category as ExpenseCategory, date: newExpense.date! }, ...expenses]);
    setIsAdding(false);
    setNewExpense({ ...newExpense, title: '', amount: '' as any });
  };

  return (
    <div className="px-4 pb-20 pt-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-green-600" /> Expenses</h2>
        <div className="flex items-center gap-2 text-xs bg-slate-100 px-2 py-1 rounded-full">
           <RefreshCw className="w-3 h-3 text-slate-400" />
           <span className="text-slate-500 font-bold">1€ =</span>
           <input type="number" className="w-10 bg-transparent font-bold text-center border-b border-slate-300" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} />
           <span className="text-slate-500">¥</span>
        </div>
      </div>
      <div className="bg-slate-800 rounded-2xl p-5 text-white shadow-lg mb-6">
        <div className="flex justify-between items-start mb-4 border-b border-slate-600 pb-4">
           <div><div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total Spent</div><div className="text-2xl font-bold">¥{Math.round(grandTotal).toLocaleString()}</div></div>
           <div className="text-right"><div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Per Person</div><div className="text-xl font-bold">¥{Math.round(grandTotal/2).toLocaleString()}</div></div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-3 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg">{balance > 0 ? 'M' : 'Y'}</div>
             <div><div className="text-xs text-slate-400">Receives</div><div className="font-bold text-green-400 text-lg">¥{Math.round(Math.abs(balance)).toLocaleString()}</div></div>
           </div>
           <div className="text-right text-xs text-slate-400">From {balance > 0 ? 'Yutaro' : 'Misaki'}</div>
        </div>
      </div>
      {!isAdding ? (
        <button onClick={() => setIsAdding(true)} className="w-full py-3 bg-green-50 text-green-600 border border-green-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-100 mb-6"><Plus className="w-4 h-4" /> Add Expense</button>
      ) : (
        <div className="bg-white p-4 rounded-xl border-2 border-green-100 shadow-lg mb-6">
           <div className="grid grid-cols-2 gap-3 mb-3">
             <input type="text" placeholder="Item Name" className="col-span-2 p-2 border rounded" value={newExpense.title} onChange={e => setNewExpense({...newExpense, title: e.target.value})} autoFocus />
             <input type="number" placeholder="Amount" className="w-full p-2 border rounded" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value as any})} />
             <select className="p-2 border rounded" value={newExpense.currency} onChange={e => setNewExpense({...newExpense, currency: e.target.value as Currency})}><option value="JPY">JPY</option><option value="EUR">EUR</option></select>
           </div>
           <div className="flex gap-2 mb-4">
             {['Misaki', 'Yutaro'].map((p) => (<button key={p} onClick={() => setNewExpense({...newExpense, payer: p as Payer})} className={`flex-1 py-1 text-xs rounded font-bold border ${newExpense.payer === p ? 'bg-green-500 text-white' : 'bg-white'}`}>{p}</button>))}
           </div>
           <div className="flex gap-2 justify-end">
             <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-full">Cancel</button>
             <button onClick={handleAdd} className="px-4 py-2 text-xs font-bold bg-green-600 text-white rounded-full">Save</button>
           </div>
        </div>
      )}
      <div className="space-y-3">
        {expenses.map(e => (
          <div key={e.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${e.payer === 'Misaki' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{e.payer[0]}</div>
                <div><div className="font-bold text-sm">{e.title}</div><div className="text-xs text-slate-400">{e.method} • {e.date}</div></div>
             </div>
             <div className="text-right">
                <div className="font-bold">{e.currency === 'JPY' ? '¥' : '€'}{e.amount.toLocaleString()}</div>
                {e.currency === 'EUR' && <div className="text-[10px] text-slate-400">≈ ¥{Math.round(e.amount * exchangeRate).toLocaleString()}</div>}
             </div>
             <button onClick={() => setExpenses(expenses.filter(ex => ex.id !== e.id))} className="text-slate-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const DayDetailView = ({ day, allDays, onBack, onUpdate, onMove }: { day: ScheduleDay, allDays: ScheduleDay[], onBack: () => void, onUpdate: (d: ScheduleDay) => void, onMove: (id: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [editTitle, setEditTitle] = useState(day.title);
  const [editContent, setEditContent] = useState(day.content);
  const [editIcon, setEditIcon] = useState<IconType>(day.iconType);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '', title: '', description: '', link: '' });

  const handleSave = () => { onUpdate({ ...day, title: editTitle, content: editContent, iconType: editIcon }); setIsEditing(false); };
  const handleAdd = () => { 
    if(!newEvent.title) return;
    onUpdate({ ...day, events: [...day.events, { id: Date.now().toString(), ...newEvent }].sort((a,b)=>a.time.localeCompare(b.time)) });
    setIsAddingEvent(false); setNewEvent({ time: '', title: '', description: '', link: '' });
  };
  
  return (
    <div className="fixed inset-0 bg-white z-[60] overflow-y-auto animate-in slide-in-from-right">
      <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b px-4 py-4 flex justify-between items-center">
        <div className="flex gap-4 items-center"><button onClick={onBack} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><ArrowLeft className="w-6 h-6"/></button>{!isEditing && <div><div className="text-xs font-bold text-blue-500">{day.date}</div><h2 className="font-bold text-lg">{day.title}</h2></div>}</div>
        <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold flex gap-1 items-center">{isEditing ? <><Save className="w-3 h-3"/> Done</> : <><Edit2 className="w-3 h-3"/> Edit</>}</button>
      </div>
      <div className="p-6">
        {isEditing ? (
          <div className="space-y-4">
             <input className="w-full p-2 border rounded font-bold" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
             <textarea className="w-full p-2 border rounded" rows={3} value={editContent} onChange={e => setEditContent(e.target.value)} />
             <div className="flex gap-2 overflow-x-auto">
               {['plane', 'map', 'shopping', 'luggage', 'sun', 'camera', 'coffee', 'heart'].map((icon: any) => (
                 <button key={icon} onClick={() => setEditIcon(icon)} className={`p-2 border rounded-full ${editIcon === icon ? 'bg-blue-500 text-white' : ''}`}>{icon}</button>
               ))}
             </div>
             {!isMoving ? (
               <button onClick={() => setIsMoving(true)} className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold rounded flex justify-center gap-2"><ArrowRightLeft className="w-4 h-4"/> Change Date</button>
             ) : (
               <div className="bg-indigo-50 p-3 rounded">
                 <div className="text-xs font-bold text-indigo-900 mb-2">Swap with...</div>
                 <div className="grid grid-cols-2 gap-2">{allDays.filter(d => d.id !== day.id).map(d => (<button key={d.id} onClick={() => { onMove(d.id); setIsMoving(false); setIsEditing(false); }} className="bg-white p-2 rounded border text-xs text-left">{d.date} {d.title}</button>))}</div>
               </div>
             )}
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8 text-sm text-blue-800">{day.content}</div>
        )}
        <div className="border-l-2 border-slate-100 ml-3 space-y-6 pb-10">
          {day.events.map(e => (
            <div key={e.id} className="pl-8 relative">
              <div className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white"/>
              <div className="bg-white p-3 rounded-xl border shadow-sm">
                <div className="flex justify-between"><div className="font-bold text-blue-600">{e.time} <span className="text-slate-800">{e.title}</span></div><button onClick={() => onUpdate({...day, events: day.events.filter(ev => ev.id !== e.id)})} className="text-slate-300"><Trash2 className="w-4 h-4"/></button></div>
                {e.description && <div className="text-sm text-slate-500 mt-1">{e.description}</div>}
              </div>
            </div>
          ))}
        </div>
        {!isAddingEvent ? (
          <button onClick={() => setIsAddingEvent(true)} className="w-full py-3 border-dashed border rounded-xl text-slate-500 text-sm font-bold flex justify-center gap-2"><Plus className="w-4 h-4"/> Add Plan</button>
        ) : (
           <div className="bg-white p-4 rounded border shadow-lg">
             <div className="flex gap-2 mb-2"><input type="time" className="border rounded p-1" value={newEvent.time} onChange={e=>setNewEvent({...newEvent, time:e.target.value})}/><input className="border rounded p-1 flex-1" placeholder="Title" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title:e.target.value})}/></div>
             <textarea className="w-full border rounded p-1 mb-2" placeholder="Details" value={newEvent.description} onChange={e=>setNewEvent({...newEvent, description:e.target.value})}/>
             <div className="flex justify-end gap-2"><button onClick={()=>setIsAddingEvent(false)} className="text-xs font-bold text-slate-400">Cancel</button><button onClick={handleAdd} className="text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded">Add</button></div>
           </div>
        )}
      </div>
    </div>
  );
};

const ScheduleView = ({ schedule, setSchedule }: { schedule: ScheduleDay[], setSchedule: (s: ScheduleDay[]) => void }) => {
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const handleMove = (targetId: string) => {
    if(!selectedId) return;
    const sIdx = schedule.findIndex(d => d.id === selectedId);
    const tIdx = schedule.findIndex(d => d.id === targetId);
    if(sIdx === -1 || tIdx === -1) return;
    const newSched = [...schedule];
    
    const contentS = { title: newSched[sIdx].title, icon: newSched[sIdx].iconType, content: newSched[sIdx].content, events: newSched[sIdx].events };
    const contentT = { title: newSched[tIdx].title, icon: newSched[tIdx].iconType, content: newSched[tIdx].content, events: newSched[tIdx].events };
    
    newSched[sIdx] = { ...newSched[sIdx], title: contentT.title, iconType: contentT.icon, content: contentT.content, events: contentT.events };
    newSched[tIdx] = { ...newSched[tIdx], title: contentS.title, iconType: contentS.icon, content: contentS.content, events: contentS.events };
    setSchedule(newSched);
    setSelectedId(targetId);
  };
  const selectedDay = schedule.find(d => d.id === selectedId);
  if(selectedId && selectedDay) return <DayDetailView day={selectedDay} allDays={schedule} onBack={()=>setSelectedId(null)} onUpdate={(d)=>setSchedule(schedule.map(c=>c.id===d.id?d:c))} onMove={handleMove}/>;

  return (
    <div className="px-4 pb-20 pt-20">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500"/> Itinerary</h2>
      <div className="border-l-2 border-blue-100 ml-3 space-y-6">
        {schedule.map(d => (
          <div key={d.id} className="relative pl-8 cursor-pointer group" onClick={()=>setSelectedId(d.id)}>
             <div className="absolute -left-[9px] top-0 w-4 h-4 bg-blue-500 rounded-full border-4 border-white shadow-sm group-hover:scale-110 transition-transform"/>
             <div className="text-blue-900 font-bold mb-1">{d.date} <span className="text-xs text-blue-400">{d.dayOfWeek}</span></div>
             <div className="bg-white p-4 rounded-xl border hover:border-blue-300 shadow-sm transition-all">
                <div className="flex justify-between items-start">
                   <div><div className="font-bold text-slate-800 mb-1">{d.title}</div><div className="text-sm text-slate-500 line-clamp-2">{d.content}</div></div>
                   <ChevronRight className="w-5 h-5 text-slate-300"/>
                </div>
                {d.events.length > 0 && <div className="mt-3 pt-2 border-t flex gap-2 overflow-hidden">{d.events.slice(0,3).map(e=><span key={e.id} className="text-[10px] bg-slate-50 px-2 py-1 rounded text-slate-500">{e.time} {e.title}</span>)}</div>}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PackingView = ({ items, setItems }: any) => {
  const [text, setText] = useState('');
  const [cat, setCat] = useState<ItemCategory>('essential');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const add = () => { if(!text) return; setItems([...items, {id: Date.now().toString(), text, checked: false, category: cat}]); setText(''); };
  
  const suggestItems = async () => {
    setIsAiLoading(true);
    setAiSuggestions([]);
    const currentItems = items.map((i: any) => i.text).join(", ");
    const prompt = `I am a 20s female traveler going to Helsinki in late June. My packing list currently has: ${currentItems}. Suggest 5-6 highly specific, useful items I might be missing (e.g., related to Finnish weather, culture, sauna). Return ONLY the item names separated by commas (e.g., Swimsuit, Portable Charger). No explanations.`;
    const res = await callGemini(prompt);
    if(res) {
      const suggestions = res.split(',').map(s => s.trim()).filter(s => s.length > 0);
      setAiSuggestions(suggestions);
    }
    setIsAiLoading(false);
  };

  const addSuggestion = (s: string) => {
    setItems([...items, {id: Date.now().toString(), text: s, checked: false, category: 'other'}]);
    setAiSuggestions(aiSuggestions.filter(item => item !== s));
  };

  return (
    <div className="px-4 pb-20 pt-20">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-400 p-6 rounded-2xl text-white mb-6 shadow-lg"><h2 className="font-bold text-xl">Packing List</h2><div className="text-right font-bold text-2xl">{items.length>0?Math.round((items.filter((i:any)=>i.checked).length/items.length)*100):0}%</div></div>
      
      {/* AI Suggestion Area */}
      <div className="mb-6">
        <button 
          onClick={suggestItems} 
          disabled={isAiLoading}
          className="w-full py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:from-purple-100 hover:to-indigo-100 transition-all shadow-sm"
        >
          {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-amber-400"/>} 
          {isAiLoading ? "Asking AI..." : "Suggest Missing Items"}
        </button>
        {aiSuggestions.length > 0 && (
          <div className="mt-3 bg-white border border-indigo-100 p-3 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="text-xs font-bold text-indigo-400 uppercase mb-2">AI Suggestions (Tap to add)</div>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.map((s, idx) => (
                <button key={idx} onClick={() => addSuggestion(s)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3"/> {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4"><input className="border rounded-full px-4 py-2 flex-1" value={text} onChange={e=>setText(e.target.value)} placeholder="Add item..."/><button onClick={add} className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center"><Plus className="w-5 h-5"/></button></div>
      <div className="space-y-4">
        {['essential','clothing','beauty','electronics','other'].map(c => {
          const catItems = items.filter((i:any)=>i.category===c);
          if(catItems.length===0) return null;
          return <div key={c}><h3 className="font-bold text-xs uppercase text-slate-400 mb-2">{c}</h3>
            {catItems.map((i:any)=>(<div key={i.id} className="flex gap-3 items-center bg-white p-3 rounded-xl border mb-2"><button onClick={()=>setItems(items.map((it:any)=>it.id===i.id?{...it,checked:!it.checked}:it))} className={`w-5 h-5 border rounded flex items-center justify-center ${i.checked?'bg-blue-500 border-blue-500':''}`}>{i.checked&&<CheckSquare className="w-3 h-3 text-white"/>}</button><span className={i.checked?'line-through text-slate-300':'text-slate-700'}>{i.text}</span><button onClick={()=>setItems(items.filter((it:any)=>it.id!==i.id))} className="ml-auto text-slate-200 hover:text-red-400"><Trash2 className="w-4 h-4"/></button></div>))}
          </div>
        })}
      </div>
    </div>
  );
};

const SpotsView = ({ spots, setSpots }: any) => {
  const [form, setForm] = useState(false);
  const [newS, setNewS] = useState({title:'', description:'', category:'sightseeing'});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<any[]>([]);

  const add = () => { if(!newS.title)return; setSpots([...spots, {id:Date.now().toString(),...newS, imageColor:'bg-indigo-400',links:[]}]); setForm(false); setNewS({title:'',description:'',category:'sightseeing'}); };
  
  const recommendSpots = async () => {
    setIsAiLoading(true);
    const current = spots.map((s:any) => s.title).join(", ");
    const prompt = `I am visiting Helsinki and I like these places: ${current}. Suggest 3 OTHER specific places (shops, cafes, or sights) that fit this vibe. Return strictly a JSON array of objects with keys: title, description, category (one of: sightseeing, shopping, food, cafe). Do not include markdown formatting.`;
    const res = await callGemini(prompt);
    try {
      const cleanJson = res.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleanJson);
      if(Array.isArray(data)) setAiRecs(data);
    } catch(e) { console.error(e); }
    setIsAiLoading(false);
  };

  const addRec = (rec: any) => {
    setSpots([...spots, {id:Date.now().toString(), title: rec.title, description: rec.description, category: rec.category, imageColor:'bg-pink-400', links:[]}]);
    setAiRecs(aiRecs.filter(r => r.title !== rec.title));
  };

  return (
    <div className="px-4 pb-20 pt-20">
      <div className="flex justify-between mb-6"><h2 className="font-bold text-xl flex gap-2 items-center"><Heart className="w-5 h-5 text-pink-500"/> Wish List</h2><button onClick={()=>setForm(!form)} className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">{form?'Cancel':'+ Add'}</button></div>
      
      {/* AI Recommendations */}
      <div className="mb-6">
         <button 
          onClick={recommendSpots} 
          disabled={isAiLoading}
          className="w-full py-3 bg-gradient-to-r from-pink-50 to-orange-50 border border-orange-100 text-orange-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:from-pink-100 hover:to-orange-100 transition-all shadow-sm"
        >
          {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-pink-400"/>} 
          {isAiLoading ? "Scouting..." : "Find New Gems"}
        </button>
        {aiRecs.length > 0 && (
          <div className="mt-4 grid gap-3 animate-in fade-in slide-in-from-top-4">
             <div className="text-center text-xs font-bold text-orange-400 uppercase tracking-widest">AI Recommended</div>
             {aiRecs.map((rec, i) => (
               <div key={i} className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex justify-between items-center">
                 <div>
                   <div className="text-[10px] font-bold text-orange-400 uppercase">{rec.category}</div>
                   <div className="font-bold text-sm text-slate-800">{rec.title}</div>
                   <div className="text-xs text-slate-500 line-clamp-1">{rec.description}</div>
                 </div>
                 <button onClick={() => addRec(rec)} className="bg-white text-orange-500 p-2 rounded-full shadow-sm hover:scale-110 transition-transform"><Plus className="w-4 h-4"/></button>
               </div>
             ))}
          </div>
        )}
      </div>

      {form && <div className="bg-white p-4 rounded-xl border shadow-lg mb-6"><input className="w-full border rounded p-2 mb-2" placeholder="Name" value={newS.title} onChange={e=>setNewS({...newS,title:e.target.value})}/><textarea className="w-full border rounded p-2 mb-2" placeholder="Memo" value={newS.description} onChange={e=>setNewS({...newS,description:e.target.value})}/><button onClick={add} className="w-full bg-blue-600 text-white font-bold py-2 rounded">Save</button></div>}
      <div className="grid grid-cols-2 gap-4">{spots.map((s:any) => (
        <div key={s.id} className="bg-white rounded-2xl overflow-hidden border shadow-sm relative"><div className={`h-24 ${s.imageColor} flex items-center justify-center`}>{s.category==='food'?<Heart className="text-white/50"/>:<Camera className="text-white/50"/>}</div><div className="p-3"><div className="text-xs font-bold text-blue-500 uppercase">{s.category}</div><div className="font-bold text-sm mb-1">{s.title}</div><div className="text-xs text-slate-500 line-clamp-2">{s.description}</div><button onClick={()=>setSpots(spots.filter((sp:any)=>sp.id!==s.id))} className="absolute top-2 right-2 bg-black/20 text-white p-1 rounded-full"><X className="w-3 h-3"/></button></div></div>
      ))}</div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [items, setItems] = useState<PackingItem[]>(INITIAL_PACKING_LIST);
  const [spots, setSpots] = useState<Spot[]>(INITIAL_SPOTS);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(INITIAL_SCHEDULE);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(!isFirebaseAvailable) { setLoading(false); return; }
    const initAuth = async () => { try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token); else await signInAnonymously(auth); } catch(e){ setLoading(false); } };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if(!isFirebaseAvailable || !user) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'planner', 'main'), (snap) => {
      if(snap.exists()) { const d = snap.data(); if(d.items) setItems(d.items); if(d.spots) setSpots(d.spots); if(d.schedule) setSchedule(d.schedule); if(d.expenses) setExpenses(d.expenses); }
      setLoading(false);
    });
  }, [user]);

  const save = async (data: any) => { if(isFirebaseAvailable && user) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'planner', 'main'), data, {merge:true}); };
  
  const content = () => {
    switch(activeTab) {
      case 'schedule': return <ScheduleView schedule={schedule} setSchedule={(s)=>{setSchedule(s); save({schedule:s});}}/>;
      case 'packing': return <PackingView items={items} setItems={(i:any)=>{setItems(i); save({items:i});}}/>;
      case 'spots': return <SpotsView spots={spots} setSpots={(s:any)=>{setSpots(s); save({spots:s});}}/>;
      case 'expenses': return <ExpensesView expenses={expenses} setExpenses={(e)=>{setExpenses(e); save({expenses:e});}}/>;
      default: return (
        <div className="pb-20 animate-in fade-in">
          <Hero />
          {!isFirebaseAvailable && <div className="px-6 mb-4"><div className="bg-amber-50 p-3 rounded text-xs text-amber-800 flex gap-2"><AlertCircle className="w-4 h-4"/> Demo Mode: Changes not saved.</div></div>}
          <div className="px-6 -mt-6 relative z-20"><h3 className="text-sm font-bold text-slate-400 mb-3 pl-1">SCHEDULE</h3>{FLIGHTS.map((f,i)=><FlightCard key={i} flight={f}/>)}</div>
          <div className="px-6 mt-8"><div onClick={()=>setActiveTab('spots')} className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative cursor-pointer"><h3 className="font-bold text-lg mb-1">Must-Do List</h3><p className="text-indigo-100 text-sm mb-4">やりたいことリスト</p><div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full text-xs">Check <ChevronRight className="w-3 h-3"/></div><Heart className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10 rotate-12"/></div></div>
        </div>
      );
    }
  };

  if(loading && isFirebaseAvailable) return <div className="min-h-screen flex items-center justify-center text-blue-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-safe">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative">{content()}</main>
    </div>
  );
}