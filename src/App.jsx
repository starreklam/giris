import { useState, useEffect, useMemo, useRef } from "react";
import { buluttanDinle, buluttaKaydet } from "./firebase";

/* ═══════════════════════════════════════════════════════════
   STAR REKLAM — FİNANSAL TAKİP
   Modüller: Kasa · Cari (alacak/borç) · Personel · Ortaklar · Vade · Rapor · Yedek
   Veriler Firebase'de bulutta saklanır — tüm cihazlar anlık senkron.
   localStorage yerel yedek olarak da tutulur (internet kesilse de çalışır).
   ═══════════════════════════════════════════════════════════ */

const SK = { islemler:"sr_islemler_v4", alacaklar:"sr_alacaklar_v4", borclar:"sr_borclar_v4", personel:"sr_personel_v4", ortaklar:"sr_ortaklar_v1" };
const load = (k,f) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):f; } catch { return f; } };
const save = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };

const TL = n => new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(n||0);
const today = () => new Date().toISOString().split("T")[0];
const ayAd = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const suAy = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const ayStr = (ay) => { const [y,m]=ay.split("-"); return `${ayAd[+m-1]} ${y}`; };
const ayKisa = (ay) => { const [y,m]=ay.split("-"); return `${ayAd[+m-1].slice(0,3)} ${y.slice(2)}`; };
const gunFark = (tarih) => { if(!tarih) return null; const d=new Date(tarih); const t=new Date(today()); return Math.round((d-t)/86400000); };

/* Örnek veriler — vade tarihleri eklendi */
const DEF_ISLEMLER = [];
const DEF_ALACAKLAR = [];
const DEF_BORCLAR = [];
const DEF_PERSONEL = [
  {id:"p1",ad:"Serdar Aydemir",maas:40000,prim:false,baslangic:suAy(),aylar:{}},
  {id:"p2",ad:"Metin Şirin",maas:52000,prim:false,baslangic:suAy(),aylar:{}},
  {id:"p3",ad:"Barış Bektaş",maas:50000,prim:true,baslangic:suAy(),aylar:{}},
];
/* Ortaklar: her ortağın "aldığı" (kasadan kişisel çekiş) ve "harcadığı"
   (şirket için cepten ödediği) hareketleri. Her hareket: {tutar,tarih,aciklama} */
const DEF_ORTAKLAR = [
  {id:"o2",ad:"Mustafa",aldi:[],harcadi:[]},
  {id:"o1",ad:"Sadi",aldi:[],harcadi:[]},
];
const SIFRE = "star4136";

const C = {
  bg:"#F5F4F0",surface:"#FFFFFF",border:"#E8E5DC",
  gold:"#FFC107",text:"#1E1E1E",mid:"#666",light:"#999",
  green:"#065F46",greenBg:"#D1FAE5",red:"#B91C1C",redBg:"#FEE2E2",
};

const inp = {background:"#F7F7F5",border:"1px solid #E0DDD5",borderRadius:8,padding:"9px 12px",fontSize:14,color:"#1E1E1E",width:"100%",boxSizing:"border-box",outline:"none"};

function Logo() {
  return (
    <svg width="156" height="38" viewBox="0 0 156 38" fill="none">
      <path d="M5 26 Q38 4 78 11" stroke="#FFC107" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <polygon points="82,2 84,8 91,8 85.5,12 87.5,18 82,14 76.5,18 78.5,12 73,8 80,8" fill="#FFC107"/>
      <text x="1" y="35" fontFamily="'Arial Black',sans-serif" fontWeight="900" fontSize="16" fill="#1E1E1E">st</text>
      <text x="19" y="35" fontFamily="'Arial Black',sans-serif" fontWeight="900" fontSize="16" fill="#FFC107">a</text>
      <text x="27" y="35" fontFamily="'Arial Black',sans-serif" fontWeight="900" fontSize="16" fill="#1E1E1E">r reklam</text>
    </svg>
  );
}

function Modal({title,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:440,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.15)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontSize:17,fontWeight:700}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#999"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Btn = ({onClick,children,variant="primary",small}) => (
  <button onClick={onClick} style={{
    background: variant==="primary"?"#FFC107":variant==="ghost"?"transparent":variant==="green"?"#D1FAE5":variant==="red"?"#FEE2E2":"#F3F4F6",
    color: variant==="primary"?"#1E1E1E":variant==="green"?"#065F46":variant==="red"?"#B91C1C":"#555",
    border: variant==="ghost"?"1px solid #E0DDD5":variant==="green"?"1px solid #A7F3D0":variant==="red"?"1px solid #FECACA":"none",
    borderRadius:8, padding:small?"5px 12px":"9px 18px", fontWeight:600, fontSize:small?12:13, cursor:"pointer", whiteSpace:"nowrap"
  }}>{children}</button>
);

function KalanBar({toplam, odenen}) {
  const kalan = toplam - odenen;
  const pct = toplam > 0 ? Math.round((odenen/toplam)*100) : 0;
  if (toplam === 0) return null;
  return (
    <div style={{marginTop:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
        <span style={{color:"#065F46",fontWeight:600}}>Ödenen: {TL(odenen)}</span>
        <span style={{color: kalan>0?"#B91C1C":"#065F46", fontWeight:700}}>Kalan: {TL(kalan)}</span>
      </div>
      <div style={{background:"#E5E7EB",borderRadius:4,height:6,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:pct>=100?"#059669":"#FFC107",transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

/* Vade rozeti: yaklaşan / geçmiş ödeme uyarısı */
function VadeRozet({vade, tur="borc"}) {
  const g = gunFark(vade);
  if (g === null) return null;
  let bg, col, txt;
  if (g < 0) { bg="#FEE2E2"; col="#B91C1C"; txt=`${Math.abs(g)} gün gecikti`; }
  else if (g === 0) { bg="#FEF3C7"; col="#92400E"; txt="Bugün"; }
  else if (g <= 7) { bg="#FEF3C7"; col="#92400E"; txt=`${g} gün kaldı`; }
  else { bg="#F3F4F6"; col="#666"; txt=`${g} gün kaldı`; }
  return <span style={{background:bg,color:col,borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>⏱ {txt}</span>;
}

export default function App() {
  const [tab,setTab] = useState("özet");
  const [islemler,setIslemler] = useState(()=>load(SK.islemler,DEF_ISLEMLER));
  const [alacaklar,setAlacaklar] = useState(()=>load(SK.alacaklar,DEF_ALACAKLAR));
  const [borclar,setBorclar] = useState(()=>load(SK.borclar,DEF_BORCLAR));
  const [personel,setPersonel] = useState(()=>load(SK.personel,DEF_PERSONEL));
  const [modal,setModal] = useState(null);
  const [form,setForm] = useState({});
  const [seciliAy,setSeciliAy] = useState(suAy());
  const [acikKalem,setAcikKalem] = useState(null);
  const [odemeFiltre,setOdemeFiltre] = useState("all");
  const [ortaklar,setOrtaklar] = useState(()=>load(SK.ortaklar,DEF_ORTAKLAR));
  const [alacakArama,setAlacakArama] = useState("");
  const [borcArama,setBorcArama] = useState("");
  const [rapGorunum,setRapGorunum] = useState("kategori");
  const [acikGrup,setAcikGrup] = useState(null);
  const [cariAy,setCariAy] = useState(suAy());
  const [silOnay,setSilOnay] = useState(null);
  const [duzenle,setDuzenle] = useState(null);
  const [girisYapildi,setGirisYapildi] = useState(false);
  const [sifreGiris,setSifreGiris] = useState("");
  const [sifreHata,setSifreHata] = useState(false);
  const [sifreGoster,setSifreGoster] = useState(false);
  const [rapAy,setRapAy] = useState(suAy());

  /* ═══ FIREBASE SENKRON ═══
     Kritik: ilk bulut verisi gelmeden buluta YAZMA. Yoksa açılıştaki boş/eski
     veri, buluttaki dolu verinin üzerine biner ve veri kaybolur.
     buluttanGeldi: gelen güncellemeyi tekrar yazıp döngü yapmayı engeller.
     ilkYuklemeBitti: ilk bulut okuması bitmeden yazma useEffect'i çalışmaz. */
  const buluttanGeldi = useRef(false);
  const ilkYuklemeBitti = useRef(false);

  useEffect(()=>{
    const durdur = buluttanDinle((veri)=>{
      buluttanGeldi.current = true;
      if(veri.islemler) setIslemler(veri.islemler);
      if(veri.alacaklar) setAlacaklar(veri.alacaklar);
      if(veri.borclar) setBorclar(veri.borclar);
      if(veri.personel) setPersonel(veri.personel);
      if(veri.ortaklar) setOrtaklar(veri.ortaklar);
      ilkYuklemeBitti.current = true;
      setTimeout(()=>{ buluttanGeldi.current = false; }, 150);
    });
    /* Bulut hiç veri döndürmezse (ilk kurulum, boş veritabanı) 3 sn sonra
       yazmaya izin ver ki mevcut cihaz verisi buluta ilk kez yazılabilsin. */
    const zaman = setTimeout(()=>{ ilkYuklemeBitti.current = true; }, 3000);
    return ()=>{ durdur(); clearTimeout(zaman); };
  },[]);

  /* Her değişiklikte: yerel yedek + bulut. Ama ilk bulut okuması bitmeden
     ve bulut kaynaklı güncellemede buluta yazma. */
  useEffect(()=>{
    save(SK.islemler,islemler); save(SK.alacaklar,alacaklar); save(SK.borclar,borclar);
    save(SK.personel,personel); save(SK.ortaklar,ortaklar);
    if(ilkYuklemeBitti.current && !buluttanGeldi.current) {
      buluttaKaydet({ islemler, alacaklar, borclar, personel, ortaklar });
    }
  },[islemler,alacaklar,borclar,personel,ortaklar]);

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const closeModal = () => { setModal(null); setForm({}); };

  /* ═══ MERKEZİ NAKİT DEFTERİ ═══
     Her hareket buraya düşer: manuel işlemler + tahsilatlar + ödemeler + personel ödemeleri.
     "Elimde şu an ne kadar nakit var" tek yerden hesaplanır. */
  const nakitHareketler = useMemo(()=>{
    const h = [];
    islemler.forEach(i=>h.push({tarih:i.tarih,tip:i.tip,tutar:+i.tutar||0,aciklama:i.aciklama,kaynak:"İşlem",kategori:i.kategori}));
    alacaklar.forEach(a=>(a.tahsilat||[]).forEach(t=>h.push({tarih:t.tarih,tip:"gelir",tutar:+t.tutar||0,aciklama:`Tahsilat — ${a.musteri}`,kaynak:"Cari"})));
    borclar.forEach(b=>(b.odeme||[]).forEach(o=>h.push({tarih:o.tarih,tip:"gider",tutar:+o.tutar||0,aciklama:`Ödeme — ${b.alacakli}`,kaynak:"Cari"})));
    personel.forEach(p=>Object.entries(p.aylar||{}).forEach(([ay,d])=>(d.odemeler||[]).forEach(o=>h.push({tarih:o.tarih,tip:"gider",tutar:+o.tutar||0,aciklama:`Maaş/mesai — ${p.ad}`,kaynak:"Personel"}))));
    ortaklar.forEach(o=>{
      (o.aldi||[]).forEach(x=>h.push({tarih:x.tarih,tip:"gider",tutar:+x.tutar||0,aciklama:`${o.ad} kasadan aldı${x.aciklama?" — "+x.aciklama:""}`,kaynak:"Ortak"}));
      (o.harcadi||[]).forEach(x=>h.push({tarih:x.tarih,tip:"gider",tutar:+x.tutar||0,aciklama:`${o.ad} şirket için harcadı${x.aciklama?" — "+x.aciklama:""}`,kaynak:"Ortak",kategori:"Ortak harcaması"}));
    });
    return h.sort((x,y)=>(y.tarih||"").localeCompare(x.tarih||""));
  },[islemler,alacaklar,borclar,personel,ortaklar]);

  const nakitGiris = nakitHareketler.filter(h=>h.tip==="gelir").reduce((s,h)=>s+h.tutar,0);
  const nakitCikis = nakitHareketler.filter(h=>h.tip==="gider").reduce((s,h)=>s+h.tutar,0);
  const netKasa = nakitGiris - nakitCikis;

  const topAlacak = alacaklar.reduce((s,a)=>{ const od=a.tahsilat.reduce((x,t)=>x+(+t.tutar||0),0); return s+(a.toplam-od); },0);
  const topBorc = borclar.reduce((s,b)=>{ const od=b.odeme.reduce((x,o)=>x+(+o.tutar||0),0); return s+(b.toplam-od); },0);

  const ayPersonelToplam = personel.reduce((s,p)=>{
    const ay = p.aylar[seciliAy]||{maas:p.maas,avans:0,prim:0,odemeler:[]};
    return s+((+ay.maas||0)+(+ay.avans||0)+(p.prim?(+ay.prim||0):0));
  },0);

  /* ═══ CARİ AY GÖRÜNÜRLÜĞÜ ═══
     Bir alacak/borç, seçili ayda görünür mü?
     - Açılış ayı seçili aya eşitse (o ay eklendiyse) → görünür
     - Açılış ayı seçili aydan ÖNCEyse VE hâlâ kalanı varsa → devir olarak görünür
     - Açılış ayı seçili aydan SONRAysa → görünmez (henüz açılmamış)
     - Açılış ayı yoksa (eski/tarihsiz kayıt) → her ay görünür (geriye uyum) */
  const cariGorunur = (kalem, kalan, ay) => {
    const acilis = kalem.acilisAy;
    if(!acilis) return true;
    if(acilis === ay) return true;
    if(acilis < ay) return kalan > 0;
    return false;
  };
  const cariDevirMi = (kalem, ay) => kalem.acilisAy && kalem.acilisAy < ay;

  /* ═══ PERSONEL — AY BAĞIMSIZ ═══ Her ay kendi başına kapanır: sabit maaş,
     o ay yapılan ödemeler düşülür, kalan varsa bir SONRAKİ aya otomatik
     aktarılmaz — o ay geçmişte kalır, o ayın sekmesinde görünmeye devam eder. */
  const aySonraki = (ay)=>{ const d=new Date(ay+"-01"); d.setMonth(d.getMonth()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };

  /* ═══ VADE TAKVİMİ ═══ önümüzdeki nakit çıkış/girişleri tarihe göre sırala */
  const vadeliBorclar = useMemo(()=>borclar
    .map(b=>({...b,kalan:b.toplam-b.odeme.reduce((s,o)=>s+(+o.tutar||0),0)}))
    .filter(b=>b.kalan>0 && b.vade)
    .sort((a,b)=>a.vade.localeCompare(b.vade)),[borclar]);
  const vadeliAlacaklar = useMemo(()=>alacaklar
    .map(a=>({...a,kalan:a.toplam-a.tahsilat.reduce((s,t)=>s+(+t.tutar||0),0)}))
    .filter(a=>a.kalan>0 && a.vade)
    .sort((a,b)=>a.vade.localeCompare(b.vade)),[alacaklar]);

  const yakin7Borc = vadeliBorclar.filter(b=>{const g=gunFark(b.vade); return g!==null && g<=7;}).reduce((s,b)=>s+b.kalan,0);
  const projeksiyon30 = netKasa
    + vadeliAlacaklar.filter(a=>{const g=gunFark(a.vade); return g!==null && g<=30;}).reduce((s,a)=>s+a.kalan,0)
    - vadeliBorclar.filter(b=>{const g=gunFark(b.vade); return g!==null && g<=30;}).reduce((s,b)=>s+b.kalan,0);

  /* ═══ ÖDEME MERKEZİ ═══ borç ödemeleri + alacak tahsilatları tek listede.
     yon:"cikis"=ben ödeyeceğim (borç), yon:"giris"=bana ödenecek (tahsilat).
     Vadesi olan üstte ve gün sırasına göre; vadesiz olanlar altta. */
  const odemeSatirlari = useMemo(()=>{
    const rows = [];
    borclar.forEach(b=>{
      const od=b.odeme.reduce((s,o)=>s+(+o.tutar||0),0); const kalan=b.toplam-od;
      if(kalan>0) rows.push({id:b.id,tur:"borc",yon:"cikis",ad:b.alacakli,kalan,toplam:b.toplam,vade:b.vade,acil:b.aciklama==="Acil ödenecek"});
    });
    alacaklar.forEach(a=>{
      const od=a.tahsilat.reduce((s,t)=>s+(+t.tutar||0),0); const kalan=a.toplam-od;
      if(kalan>0) rows.push({id:a.id,tur:"alacak",yon:"giris",ad:a.musteri,kalan,toplam:a.toplam,vade:a.vade,acil:false});
    });
    return rows.sort((x,y)=>{
      const gx=gunFark(x.vade), gy=gunFark(y.vade);
      if(gx===null && gy===null) return y.kalan-x.kalan;
      if(gx===null) return 1; if(gy===null) return -1;
      return gx-gy;
    });
  },[borclar,alacaklar]);

  const gecikmisToplam = odemeSatirlari.filter(r=>r.yon==="cikis" && (gunFark(r.vade)??99)<0).reduce((s,r)=>s+r.kalan,0);
  const buHaftaCikis = odemeSatirlari.filter(r=>{ if(r.yon!=="cikis") return false; const g=gunFark(r.vade); return g!==null && g>=0 && g<=7; }).reduce((s,r)=>s+r.kalan,0);
  const toplamCikis = odemeSatirlari.filter(r=>r.yon==="cikis").reduce((s,r)=>s+r.kalan,0);
  const toplamGiris = odemeSatirlari.filter(r=>r.yon==="giris").reduce((s,r)=>s+r.kalan,0);

  /* ═══ AYLIK RAPOR ═══ seçili ayın gelir/gider/kâr özeti */
  const ayHareket = (ay) => nakitHareketler.filter(h=>(h.tarih||"").startsWith(ay));
  const rapor = useMemo(()=>{
    const h = ayHareket(rapAy);
    const giderH = h.filter(x=>x.tip==="gider");
    const gelirH = h.filter(x=>x.tip==="gelir");
    const gelir = gelirH.reduce((s,x)=>s+x.tutar,0);
    const gider = giderH.reduce((s,x)=>s+x.tutar,0);
    /* grupla: her grup {toplam, kayitlar:[]} */
    const grupla = (liste, anahtarFn) => {
      const g = {};
      liste.forEach(x=>{ const k=anahtarFn(x)||"Diğer"; if(!g[k]) g[k]={toplam:0,kayitlar:[]}; g[k].toplam+=x.tutar; g[k].kayitlar.push(x); });
      return g;
    };
    const kategoriler = grupla(giderH, x=>x.kategori||x.kaynak||"Diğer");
    const kaynaklar = grupla(giderH, x=>x.kaynak||"Diğer");
    const gelirKaynak = grupla(gelirH, x=>x.kaynak||"Diğer");
    /* ortak kırılımı: sadece Ortak kaynağı, isim aciklamadan */
    const ortakGider = grupla(giderH.filter(x=>x.kaynak==="Ortak"), x=>{
      const m=(x.aciklama||"").split(" ")[0]; return m||"Ortak";
    });
    return { gelir, gider, net:gelir-gider, kategoriler, kaynaklar, gelirKaynak, ortakGider };
  },[nakitHareketler,rapAy]);

  /* önceki ay ile kıyas */
  const oncekiAy = (ay)=>{ const d=new Date(ay+"-01"); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
  const oncekiRapor = useMemo(()=>{
    const h = ayHareket(oncekiAy(rapAy));
    const gelir = h.filter(x=>x.tip==="gelir").reduce((s,x)=>s+x.tutar,0);
    const gider = h.filter(x=>x.tip==="gider").reduce((s,x)=>s+x.tutar,0);
    return { gelir, gider, net:gelir-gider };
  },[nakitHareketler,rapAy]);

  const tarih = new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"});
  const TABS = [
    {id:"özet",label:"Özet"},
    {id:"odemeler",label:"Ödemeler"},
    {id:"islemler",label:"İşlemler"},
    {id:"alacaklar",label:"Alacaklar"},
    {id:"borclar",label:"Borçlar"},
    {id:"personel",label:"Personel"},
    {id:"ortaklar",label:"Ortaklar"},
    {id:"vade",label:"Vade Takvimi"},
    {id:"rapor",label:"Aylık Rapor"},
    {id:"yedek",label:"Yedek"},
  ];

  const mevcutAylar = () => {
    const set = new Set([suAy()]);
    personel.forEach(p => Object.keys(p.aylar||{}).forEach(a=>set.add(a)));
    return [...set].sort().reverse();
  };
  const raporAylar = () => {
    const set = new Set([suAy()]);
    nakitHareketler.forEach(h=>{ if(h.tarih) set.add(h.tarih.slice(0,7)); });
    return [...set].sort().reverse();
  };

  /* ═══ YEDEKLEME ═══ */
  const disaAktar = () => {
    const veri = { surum:5, tarih:new Date().toISOString(), islemler, alacaklar, borclar, personel, ortaklar };
    const blob = new Blob([JSON.stringify(veri,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `star-reklam-yedek-${today()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const iceAktar = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const v = JSON.parse(reader.result);
        if(v.islemler) setIslemler(v.islemler);
        if(v.alacaklar) setAlacaklar(v.alacaklar);
        if(v.borclar) setBorclar(v.borclar);
        if(v.personel) setPersonel(v.personel);
        if(v.ortaklar) setOrtaklar(v.ortaklar);
        alert("Yedek başarıyla yüklendi.");
      } catch { alert("Dosya okunamadı — geçerli bir yedek dosyası seçin."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const csvAktar = () => {
    const rows = [["Tarih","Tip","Tutar","Açıklama","Kaynak","Kategori"]];
    nakitHareketler.forEach(h=>rows.push([h.tarih||"",h.tip,h.tutar,h.aciklama,h.kaynak,h.kategori||""]));
    const csv = "\uFEFF"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `star-reklam-hareketler-${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ═══ GİRİŞ EKRANI (sadece şifre) ═══ */
  if (!girisYapildi) {
    const dene = () => {
      if (sifreGiris === SIFRE) { setGirisYapildi(true); setSifreHata(false); }
      else { setSifreHata(true); }
    };
    return (
      <div style={{fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",background:C.text,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:20,padding:"36px 28px",width:340,maxWidth:"92vw",boxShadow:"0 24px 64px rgba(0,0,0,0.35)",textAlign:"center"}}>
          <div style={{marginBottom:8}}><Logo/></div>
          <div style={{fontSize:13,color:C.mid,marginBottom:24}}>Finansal Takip — giriş</div>
          <div style={{position:"relative",marginBottom:12}}>
            <input type={sifreGoster?"text":"password"} inputMode="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoFocus placeholder="Şifre" value={sifreGiris}
              onChange={e=>{setSifreGiris(e.target.value);setSifreHata(false);}}
              onKeyDown={e=>{ if(e.key==="Enter") dene(); }}
              style={{...inp,textAlign:"center",fontSize:18,letterSpacing:"2px",padding:"14px 44px",border:sifreHata?"1px solid #B91C1C":"1px solid #E0DDD5"}}/>
            <button type="button" onClick={()=>setSifreGoster(g=>!g)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#999"}}>{sifreGoster?"🙈":"👁"}</button>
          </div>
          {sifreHata && <div style={{color:"#B91C1C",fontSize:13,marginBottom:12}}>Şifre hatalı, tekrar deneyin</div>}
          <button onClick={dene} style={{width:"100%",background:"#FFC107",color:"#1E1E1E",border:"none",borderRadius:10,padding:"14px",fontWeight:700,fontSize:15,cursor:"pointer"}}>Giriş yap</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text}}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        input, select, button { font-family: inherit; }
        @media (max-width: 620px) {
          .sr-net-tutar { font-size: 38px !important; }
          .sr-pad { padding: 16px !important; }
          .sr-header-label { display: none !important; }
        }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* HEADER */}
      <div style={{background:C.surface,borderBottom:"3px solid #FFC107",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <Logo/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right",background:netKasa>=0?"#D1FAE5":"#FEE2E2",border:`1px solid ${netKasa>=0?"#A7F3D0":"#FECACA"}`,borderRadius:8,padding:"5px 12px"}} title="Anlık nakit — sadece gerçekleşen (ödenmiş/tahsil edilmiş) hareketler; ödenmemiş borç/alacak dahil değil">
            <div style={{fontSize:9,color:netKasa>=0?"#065F46":"#B91C1C",textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:700}}>Anlık Nakit</div>
            <div style={{fontSize:14,fontWeight:800,color:netKasa>=0?"#065F46":"#B91C1C"}}>{TL(netKasa)}</div>
          </div>
          <div className="sr-header-label" style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:C.light,textTransform:"uppercase",letterSpacing:"0.8px"}}>Finansal Takip</div>
            <div style={{fontSize:12,color:C.mid}}>{tarih}</div>
          </div>
          <button onClick={()=>{setGirisYapildi(false);setSifreGiris("");}} title="Kilitle" style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:14,color:C.mid}}>🔒</button>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",gap:4,overflowX:"auto"}}>
        {TABS.map(t=>{
          const uyari = (t.id==="vade" && yakin7Borc>0) || (t.id==="odemeler" && (gecikmisToplam>0||buHaftaCikis>0));
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"14px 16px",border:"none",background:"none",cursor:"pointer",
              fontSize:13,fontWeight:tab===t.id?700:400,
              color:tab===t.id?"#FFC107":C.mid,
              borderBottom:tab===t.id?"3px solid #FFC107":"3px solid transparent",
              whiteSpace:"nowrap",transition:"all 0.15s",position:"relative",
            }}>
              {t.label}
              {uyari && <span style={{position:"absolute",top:9,right:6,width:7,height:7,borderRadius:"50%",background:"#B91C1C"}}/>}
            </button>
          );
        })}
      </div>

      <div className="sr-pad" style={{padding:"24px",maxWidth:960,margin:"0 auto"}}>

        {/* ═══════════ ÖZET ═══════════ */}
        {tab==="özet" && (
          <div>
            <div style={{background:C.text,borderRadius:16,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}>
              <div style={{fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8}}>Net Kasa — gerçek nakit</div>
              <div className="sr-net-tutar" style={{fontSize:52,fontWeight:800,color:netKasa>=0?"#4ADE80":"#F87171",letterSpacing:"-2.5px",lineHeight:1,marginBottom:16}}>{TL(netKasa)}</div>
              <div style={{display:"flex",gap:28,flexWrap:"wrap"}}>
                <div><div style={{fontSize:11,color:"#888",marginBottom:2}}>Nakit Giriş</div><div style={{fontSize:18,fontWeight:700,color:"#4ADE80"}}>{TL(nakitGiris)}</div></div>
                <div><div style={{fontSize:11,color:"#888",marginBottom:2}}>Nakit Çıkış</div><div style={{fontSize:18,fontWeight:700,color:"#F87171"}}>{TL(nakitCikis)}</div></div>
                <div><div style={{fontSize:11,color:"#888",marginBottom:2}}>30 Gün Projeksiyon</div><div style={{fontSize:18,fontWeight:700,color:projeksiyon30>=0?"#4ADE80":"#F87171"}}>{TL(projeksiyon30)}</div></div>
              </div>
              <div style={{position:"absolute",right:24,top:"50%",transform:"translateY(-50%)",fontSize:100,opacity:0.05,pointerEvents:"none"}}>★</div>
            </div>

            {/* Nakit uyarı şeridi */}
            {yakin7Borc>0 && (
              <div style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setTab("vade")}>
                <span style={{fontSize:20}}>⚠</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#B91C1C"}}>Önümüzdeki 7 günde {TL(yakin7Borc)} ödeme var</div>
                  <div style={{fontSize:12,color:"#991B1B"}}>Vade Takvimi'ni aç →</div>
                </div>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:20}}>
              {[
                {label:"Açık Alacak",val:topAlacak,color:"#065F46",bg:"#D1FAE5",border:"#A7F3D0"},
                {label:"Açık Borç",val:topBorc,color:"#B91C1C",bg:"#FEE2E2",border:"#FECACA"},
                {label:"Bu Ay Personel",val:ayPersonelToplam,color:"#92400E",bg:"#FEF3C7",border:"#FDE68A"},
              ].map(k=>(
                <div key={k.label} style={{background:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:"18px 20px"}}>
                  <div style={{fontSize:11,color:k.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:8}}>{k.label}</div>
                  <div style={{fontSize:26,fontWeight:800,color:k.color,letterSpacing:"-1px"}}>{TL(k.val)}</div>
                </div>
              ))}
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700}}>Son Nakit Hareketleri</span>
                <span style={{fontSize:12,color:C.light}}>Tüm kaynaklar birleşik</span>
              </div>
              {nakitHareketler.length===0 ? (
                <div style={{padding:32,textAlign:"center",color:C.light,fontSize:13}}>Henüz hareket yok — işlem, tahsilat veya ödeme ekleyin</div>
              ) : nakitHareketler.slice(0,6).map((h,i)=>(
                <div key={i} style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:h.tip==="gelir"?"#059669":"#B91C1C",flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{h.aciklama}</div>
                    <div style={{fontSize:12,color:C.light}}>{h.tarih||"—"} · {h.kaynak}</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:15,color:h.tip==="gelir"?"#065F46":"#B91C1C"}}>{h.tip==="gelir"?"+":"-"}{TL(h.tutar)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ ÖDEMELER (birleşik merkez) ═══════════ */}
        {tab==="odemeler" && (
          <div>
            {/* Özet kartlar */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:20}}>
              {[
                {label:"Gecikmiş ödeme",val:gecikmisToplam,color:"#B91C1C",bg:"#FEE2E2",border:"#FECACA"},
                {label:"Bu hafta ödenecek",val:buHaftaCikis,color:"#92400E",bg:"#FEF3C7",border:"#FDE68A"},
                {label:"Toplam borç kalan",val:toplamCikis,color:"#B91C1C",bg:"#fff",border:C.border},
                {label:"Toplam tahsilat kalan",val:toplamGiris,color:"#065F46",bg:"#fff",border:C.border},
              ].map(k=>(
                <div key={k.label} style={{background:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:"16px 18px"}}>
                  <div style={{fontSize:11,color:k.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{k.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:k.color,letterSpacing:"-0.5px"}}>{TL(k.val)}</div>
                </div>
              ))}
            </div>

            {/* Filtre */}
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {[
                {id:"all",label:"Tümü"},
                {id:"cikis",label:"Ödeyeceklerim"},
                {id:"giris",label:"Tahsil edeceklerim"},
                {id:"gecikmis",label:"Gecikmiş"},
              ].map(fl=>(
                <button key={fl.id} onClick={()=>setOdemeFiltre(fl.id)} style={{
                  background:odemeFiltre===fl.id?"#FFC107":"#fff",
                  border:`1px solid ${odemeFiltre===fl.id?"#FFC107":C.border}`,
                  borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:odemeFiltre===fl.id?700:400,cursor:"pointer",
                }}>{fl.label}</button>
              ))}
            </div>

            {/* Birleşik liste */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700}}>Ödeme & Tahsilat Listesi</span>
                <span style={{fontSize:12,color:C.light}}>En acil üstte</span>
              </div>
              {(() => {
                const list = odemeSatirlari.filter(r=>{
                  if(odemeFiltre==="cikis") return r.yon==="cikis";
                  if(odemeFiltre==="giris") return r.yon==="giris";
                  if(odemeFiltre==="gecikmis") return (gunFark(r.vade)??99)<0;
                  return true;
                });
                if(list.length===0) return <div style={{padding:36,textAlign:"center",color:C.light,fontSize:13}}>Bu filtrede bekleyen ödeme yok</div>;
                return list.map(r=>{
                  const cikis = r.yon==="cikis";
                  const anahtar = `oc_${r.tur}_${r.id}`;
                  const tanahtar = `oct_${r.tur}_${r.id}`;
                  return (
                    <div key={`${r.tur}_${r.id}`} style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:cikis?"#B91C1C":"#059669",minHeight:36}}/>
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,fontSize:14}}>{r.ad}</span>
                          {r.acil && <span style={{background:"#FEE2E2",color:"#B91C1C",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>⚠ Acil</span>}
                          <VadeRozet vade={r.vade} tur={r.tur}/>
                        </div>
                        <div style={{fontSize:12,color:C.light,marginTop:3}}>Kalan {TL(r.kalan)} / toplam {TL(r.toplam)}</div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" placeholder={cikis?"Ödeme":"Tahsilat"} style={{...inp,width:110}} value={form[anahtar]||""} onChange={e=>f(anahtar,e.target.value)}/>
                        <input type="date" style={{...inp,width:140}} value={form[tanahtar]||today()} onChange={e=>f(tanahtar,e.target.value)}/>
                        <Btn small variant={cikis?"red":"green"} onClick={()=>{
                          const tutar=+form[anahtar]||0; if(!tutar) return;
                          const trh=form[tanahtar]||today();
                          if(cikis) setBorclar(p=>p.map(x=>x.id===r.id?{...x,odeme:[...x.odeme,{tutar,tarih:trh}]}:x));
                          else setAlacaklar(p=>p.map(x=>x.id===r.id?{...x,tahsilat:[...x.tahsilat,{tutar,tarih:trh}]}:x));
                          f(anahtar,"");
                        }}>{cikis?"− Öde":"+ Tahsil et"}</Btn>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{fontSize:12,color:C.light,marginTop:12,textAlign:"center"}}>
              Buraya girdiğin her ödeme/tahsilat kasaya otomatik işlenir. Vade tarihini alacak/borç sekmelerinden girebilirsin.
            </div>
          </div>
        )}

        {/* ═══════════ İŞLEMLER ═══════════ */}
        {tab==="islemler" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
              {[
                {label:"Nakit Giriş",val:nakitGiris,color:"#065F46"},
                {label:"Nakit Çıkış",val:nakitCikis,color:"#B91C1C"},
                {label:"Net",val:netKasa,color:netKasa>=0?"#065F46":"#B91C1C"},
              ].map(k=>(
                <div key={k.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:C.light,marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:20,fontWeight:800,color:k.color}}>{TL(k.val)}</div>
                </div>
              ))}
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700}}>Elle Girilen İşlemler</span>
                <div style={{display:"flex",gap:8}}>
                  <Btn small variant="green" onClick={()=>{setForm({tip:"gelir"});setModal("yeniIslem");}}>+ Gelir</Btn>
                  <Btn small variant="red" onClick={()=>{setForm({tip:"gider"});setModal("yeniIslem");}}>+ Gider</Btn>
                </div>
              </div>
              {islemler.length===0 ? (
                <div style={{padding:40,textAlign:"center",color:C.light}}>Henüz elle işlem yok. Tahsilat/ödemeler cari sekmelerinden gelir.</div>
              ) : [...islemler].reverse().map(i=>(
                <div key={i.id} style={{padding:"13px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:i.tip==="gelir"?"#059669":"#B91C1C",flexShrink:0}}/>
                  <div style={{fontSize:13,color:C.light,minWidth:80}}>{i.tarih}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{i.aciklama}</div>
                    {i.kategori && <div style={{fontSize:12,color:C.light}}>{i.kategori}</div>}
                  </div>
                  <div style={{fontWeight:800,fontSize:15,color:i.tip==="gelir"?"#065F46":"#B91C1C"}}>{i.tip==="gelir"?"+":"-"}{TL(i.tutar)}</div>
                  {silOnay===`i_${i.id}` ? (
                    <span style={{display:"flex",gap:4,alignItems:"center"}}>
                      <button onClick={()=>{ setIslemler(p=>p.filter(x=>x.id!==i.id)); setSilOnay(null); }} style={{background:"#B91C1C",border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>Sil</button>
                      <button onClick={()=>setSilOnay(null)} style={{background:"#F3F4F6",border:"none",borderRadius:6,padding:"4px 8px",color:"#555",cursor:"pointer",fontSize:11}}>İptal</button>
                    </span>
                  ) : (
                    <button onClick={()=>setSilOnay(`i_${i.id}`)} style={{background:"none",border:"none",color:C.light,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ ALACAKLAR ═══════════ */}
        {tab==="alacaklar" && (
          <div>
            {/* Ay gezinme */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{ const d=new Date(cariAy+"-01"); d.setMonth(d.getMonth()-1); setCariAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>‹</button>
              <div style={{fontSize:15,fontWeight:700,minWidth:130,textAlign:"center"}}>{ayStr(cariAy)}</div>
              <button onClick={()=>{ const d=new Date(cariAy+"-01"); d.setMonth(d.getMonth()+1); setCariAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>›</button>
              {cariAy!==suAy() && <button onClick={()=>setCariAy(suAy())} style={{background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#92400E",fontWeight:600}}>Bu aya dön</button>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div style={{background:"#D1FAE5",border:"1px solid #A7F3D0",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:"#065F46",fontWeight:700,marginBottom:4}}>TOPLAM AÇIK ALACAK</div>
                <div style={{fontSize:24,fontWeight:800,color:"#065F46"}}>{TL(topAlacak)}</div>
              </div>
              <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:"#92400E",fontWeight:700,marginBottom:4}}>TAHSİL EDİLEN</div>
                <div style={{fontSize:24,fontWeight:800,color:"#92400E"}}>{TL(alacaklar.reduce((s,a)=>s+a.tahsilat.reduce((x,t)=>x+(+t.tutar||0),0),0))}</div>
              </div>
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700}}>{ayStr(cariAy)} Alacakları</span>
                <Btn small onClick={()=>setModal("yeniAlacak")}>+ Alacak Ekle</Btn>
              </div>
              <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <input type="text" placeholder="🔍 Müşteri ara (tüm aylar)..." value={alacakArama} onChange={e=>setAlacakArama(e.target.value)} style={{...inp,flex:"1 1 180px"}}/>
              </div>
              {(() => {
                const q = alacakArama.toLowerCase().trim();
                const list = alacaklar.filter(a=>{
                  const kalan=a.toplam-a.tahsilat.reduce((s,t)=>s+(+t.tutar||0),0);
                  if(q) return a.musteri.toLowerCase().includes(q); // arama tüm ayları tarar
                  return cariGorunur(a, kalan, cariAy);
                });
                if(list.length===0) return <div style={{padding:32,textAlign:"center",color:C.light,fontSize:13}}>{q?"Aramayla eşleşen alacak yok":`${ayStr(cariAy)} için görüntülenecek alacak yok`}</div>;
                return list.map(a=>{
                const odenen=a.tahsilat.reduce((s,t)=>s+(+t.tutar||0),0);
                const kalan=a.toplam-odenen; const tamam=kalan<=0;
                const devir = !q && cariDevirMi(a, cariAy);
                return (
                  <div key={a.id} style={{borderBottom:`1px solid ${C.border}`,opacity:tamam?0.6:1}}>
                    <div style={{padding:"14px 20px",display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}} onClick={()=>setAcikKalem(acikKalem===a.id?null:a.id)}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,fontSize:14}}>{a.musteri}</span>
                          {devir && <span style={{background:"#FEE2E2",color:"#B91C1C",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>↩ {a.acilisAy?ayKisa(a.acilisAy):""} devri</span>}
                          {q && a.acilisAy && <span style={{background:"#F3F4F6",color:"#666",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>{ayKisa(a.acilisAy)}</span>}
                          {tamam && <span style={{background:"#D1FAE5",color:"#065F46",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>✓ Tahsil Edildi</span>}
                          {!tamam && kalan<a.toplam && <span style={{background:"#FEF3C7",color:"#92400E",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>Kısmi</span>}
                          {!tamam && <VadeRozet vade={a.vade} tur="alacak"/>}
                        </div>
                        {a.aciklama && <div style={{fontSize:12,color:C.light,marginTop:2}}>{a.aciklama}</div>}
                        <KalanBar toplam={a.toplam} odenen={odenen}/>
                      </div>
                      <div style={{textAlign:"right",minWidth:90}}>
                        <div style={{fontWeight:800,fontSize:16,color:"#065F46"}}>{TL(kalan)}</div>
                        <div style={{fontSize:11,color:C.light}}>kalan /{TL(a.toplam)}</div>
                      </div>
                    </div>
                    {acikKalem===a.id && (
                      <div style={{padding:"12px 20px 16px",background:"#FAFAF8",borderTop:`1px solid ${C.border}`}}>
                        {a.tahsilat.length>0 && (
                          <div style={{marginBottom:12}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Tahsilat Geçmişi</div>
                            {a.tahsilat.map((t,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:6,marginBottom:4,fontSize:13,gap:8}}>
                                <span>{t.tarih||"—"}</span>
                                <span style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontWeight:700,color:"#065F46"}}>+{TL(t.tutar)}</span>
                                  <button onClick={()=>setAlacaklar(p=>p.map(x=>x.id===a.id?{...x,tahsilat:x.tahsilat.filter((_,j)=>j!==i)}:x))} title="Bu tahsilatı sil" style={{background:"none",border:"none",color:C.light,cursor:"pointer",fontSize:15,lineHeight:1}}>×</button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!tamam && (
                          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <input type="number" placeholder="Tahsilat tutarı" style={{...inp,width:160}} value={form[`tahsilat_${a.id}`]||""} onChange={e=>f(`tahsilat_${a.id}`,e.target.value)}/>
                            <input type="date" style={{...inp,width:150}} value={form[`tahsilat_tarih_${a.id}`]||today()} onChange={e=>f(`tahsilat_tarih_${a.id}`,e.target.value)}/>
                            <Btn small variant="green" onClick={()=>{
                              const tutar=+form[`tahsilat_${a.id}`]||0; if(!tutar) return;
                              setAlacaklar(p=>p.map(x=>x.id===a.id?{...x,tahsilat:[...x.tahsilat,{tutar,tarih:form[`tahsilat_tarih_${a.id}`]||today()}]}:x));
                              f(`tahsilat_${a.id}`,"");
                            }}>+ Tahsilat Ekle</Btn>
                          </div>
                        )}
                        {/* Yeni iş ekle (aynı müşteriye ek iş → toplam artar) */}
                        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.4px"}}>Bu müşteriye yeni iş ekle</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            <input type="text" placeholder="İş (örn: cam giydirme)" style={{...inp,flex:"2 1 140px",minWidth:120}} value={form[`ekIs_a_${a.id}`]||""} onChange={e=>f(`ekIs_a_${a.id}`,e.target.value)}/>
                            <input type="number" placeholder="Tutar" style={{...inp,flex:"1 1 90px",minWidth:90}} value={form[`ekTutar_a_${a.id}`]||""} onChange={e=>f(`ekTutar_a_${a.id}`,e.target.value)}/>
                            <Btn small onClick={()=>{
                              const ekTutar=+form[`ekTutar_a_${a.id}`]||0; if(!ekTutar) return;
                              const isAd=form[`ekIs_a_${a.id}`]||"Ek iş";
                              setAlacaklar(p=>p.map(x=>x.id===a.id?{
                                ...x,
                                toplam:x.toplam+ekTutar,
                                isler:[...(x.isler||[{ad:x.aciklama||"İlk iş",tutar:x.toplam,tarih:x.tarih||today()}]),{ad:isAd,tutar:ekTutar,tarih:today()}]
                              }:x));
                              f(`ekIs_a_${a.id}`,""); f(`ekTutar_a_${a.id}`,"");
                            }}>+ İş Ekle</Btn>
                          </div>
                          {/* İş dökümü */}
                          {(a.isler||[]).length>0 && (
                            <div style={{marginTop:10}}>
                              {(a.isler||[]).map((is,i)=>(
                                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",background:"#fff",borderRadius:6,marginBottom:3,fontSize:12}}>
                                  <span style={{color:C.mid}}>{is.tarih||"—"} · {is.ad}</span>
                                  <span style={{fontWeight:700}}>{TL(is.tutar)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{marginTop:14,display:"flex",justifyContent:"flex-end",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <button onClick={()=>{ setDuzenle({tur:"alacak",id:a.id,ad:a.musteri,vade:a.vade||"",aciklama:a.aciklama||""}); setModal("duzenle"); }} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 14px",color:"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>Adı/vadeyi düzenle</button>
                          {silOnay===`a_${a.id}` ? (
                            <span style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:12,color:"#B91C1C",fontWeight:600}}>Silinsin mi?</span>
                              <button onClick={()=>{ setAlacaklar(p=>p.filter(x=>x.id!==a.id)); setSilOnay(null); setAcikKalem(null); }} style={{background:"#B91C1C",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>Evet, sil</button>
                              <button onClick={()=>setSilOnay(null)} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 14px",color:"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>Vazgeç</button>
                            </span>
                          ) : (
                            <button onClick={()=>setSilOnay(`a_${a.id}`)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"6px 14px",color:"#B91C1C",cursor:"pointer",fontSize:12,fontWeight:600}}>Bu alacağı sil</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }); })()}
            </div>
          </div>
        )}

        {/* ═══════════ BORÇLAR ═══════════ */}
        {tab==="borclar" && (
          <div>
            {/* Ay gezinme */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{ const d=new Date(cariAy+"-01"); d.setMonth(d.getMonth()-1); setCariAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>‹</button>
              <div style={{fontSize:15,fontWeight:700,minWidth:130,textAlign:"center"}}>{ayStr(cariAy)}</div>
              <button onClick={()=>{ const d=new Date(cariAy+"-01"); d.setMonth(d.getMonth()+1); setCariAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>›</button>
              {cariAy!==suAy() && <button onClick={()=>setCariAy(suAy())} style={{background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#92400E",fontWeight:600}}>Bu aya dön</button>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:"#B91C1C",fontWeight:700,marginBottom:4}}>TOPLAM AÇIK BORÇ</div>
                <div style={{fontSize:24,fontWeight:800,color:"#B91C1C"}}>{TL(topBorc)}</div>
              </div>
              <div style={{background:"#F3F4F6",border:"1px solid #E5E7EB",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:C.mid,fontWeight:700,marginBottom:4}}>ÖDENEN</div>
                <div style={{fontSize:24,fontWeight:800,color:C.mid}}>{TL(borclar.reduce((s,b)=>s+b.odeme.reduce((x,o)=>x+(+o.tutar||0),0),0))}</div>
              </div>
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700}}>{ayStr(cariAy)} Borçları</span>
                <Btn small onClick={()=>setModal("yeniBorc")}>+ Borç Ekle</Btn>
              </div>
              <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <input type="text" placeholder="🔍 Tedarikçi / kişi ara (tüm aylar)..." value={borcArama} onChange={e=>setBorcArama(e.target.value)} style={{...inp,flex:"1 1 180px"}}/>
              </div>
              {(() => {
                const q = borcArama.toLowerCase().trim();
                const list = borclar.filter(b=>{
                  const kalan=b.toplam-b.odeme.reduce((s,o)=>s+(+o.tutar||0),0);
                  if(q) return b.alacakli.toLowerCase().includes(q);
                  return cariGorunur(b, kalan, cariAy);
                });
                if(list.length===0) return <div style={{padding:32,textAlign:"center",color:C.light,fontSize:13}}>{q?"Aramayla eşleşen borç yok":`${ayStr(cariAy)} için görüntülenecek borç yok`}</div>;
                return list.map(b=>{
                const odenen=b.odeme.reduce((s,o)=>s+(+o.tutar||0),0);
                const kalan=b.toplam-odenen; const tamam=kalan<=0;
                const devir = !q && cariDevirMi(b, cariAy);
                return (
                  <div key={b.id} style={{borderBottom:`1px solid ${C.border}`,opacity:tamam?0.5:1}}>
                    <div style={{padding:"14px 20px",display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}} onClick={()=>setAcikKalem(acikKalem===b.id?null:b.id)}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,fontSize:14}}>{b.alacakli}</span>
                          {devir && <span style={{background:"#FEE2E2",color:"#B91C1C",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>↩ {b.acilisAy?ayKisa(b.acilisAy):""} devri</span>}
                          {q && b.acilisAy && <span style={{background:"#F3F4F6",color:"#666",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>{ayKisa(b.acilisAy)}</span>}
                          {tamam && <span style={{background:"#D1FAE5",color:"#065F46",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>✓ Ödendi</span>}
                          {!tamam && kalan<b.toplam && <span style={{background:"#FEF3C7",color:"#92400E",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>Kısmi</span>}
                          {b.aciklama==="Acil ödenecek" && <span style={{background:"#FEE2E2",color:"#B91C1C",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>⚠ Acil</span>}
                          {!tamam && <VadeRozet vade={b.vade} tur="borc"/>}
                        </div>
                        {b.aciklama && b.aciklama!=="Acil ödenecek" && <div style={{fontSize:12,color:C.light,marginTop:2}}>{b.aciklama}</div>}
                        <KalanBar toplam={b.toplam} odenen={odenen}/>
                      </div>
                      <div style={{textAlign:"right",minWidth:90}}>
                        <div style={{fontWeight:800,fontSize:16,color:"#B91C1C"}}>{TL(kalan)}</div>
                        <div style={{fontSize:11,color:C.light}}>kalan /{TL(b.toplam)}</div>
                      </div>
                    </div>
                    {acikKalem===b.id && (
                      <div style={{padding:"12px 20px 16px",background:"#FAFAF8",borderTop:`1px solid ${C.border}`}}>
                        {b.odeme.length>0 && (
                          <div style={{marginBottom:12}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Ödeme Geçmişi</div>
                            {b.odeme.map((o,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:6,marginBottom:4,fontSize:13,gap:8}}>
                                <span>{o.tarih||"—"}</span>
                                <span style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontWeight:700,color:"#B91C1C"}}>-{TL(o.tutar)}</span>
                                  <button onClick={()=>setBorclar(p=>p.map(x=>x.id===b.id?{...x,odeme:x.odeme.filter((_,j)=>j!==i)}:x))} title="Bu ödemeyi sil" style={{background:"none",border:"none",color:C.light,cursor:"pointer",fontSize:15,lineHeight:1}}>×</button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!tamam && (
                          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <input type="number" placeholder="Ödeme tutarı" style={{...inp,width:160}} value={form[`odeme_${b.id}`]||""} onChange={e=>f(`odeme_${b.id}`,e.target.value)}/>
                            <input type="date" style={{...inp,width:150}} value={form[`odeme_tarih_${b.id}`]||today()} onChange={e=>f(`odeme_tarih_${b.id}`,e.target.value)}/>
                            <Btn small variant="red" onClick={()=>{
                              const tutar=+form[`odeme_${b.id}`]||0; if(!tutar) return;
                              setBorclar(p=>p.map(x=>x.id===b.id?{...x,odeme:[...x.odeme,{tutar,tarih:form[`odeme_tarih_${b.id}`]||today()}]}:x));
                              f(`odeme_${b.id}`,"");
                            }}>+ Ödeme Ekle</Btn>
                          </div>
                        )}
                        {/* Yeni kalem ekle (aynı tedarikçiye ek → toplam artar) */}
                        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.4px"}}>Bu borca ekleme yap</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            <input type="text" placeholder="Kalem (örn: ek malzeme)" style={{...inp,flex:"2 1 140px",minWidth:120}} value={form[`ekIs_b_${b.id}`]||""} onChange={e=>f(`ekIs_b_${b.id}`,e.target.value)}/>
                            <input type="number" placeholder="Tutar" style={{...inp,flex:"1 1 90px",minWidth:90}} value={form[`ekTutar_b_${b.id}`]||""} onChange={e=>f(`ekTutar_b_${b.id}`,e.target.value)}/>
                            <Btn small onClick={()=>{
                              const ekTutar=+form[`ekTutar_b_${b.id}`]||0; if(!ekTutar) return;
                              const isAd=form[`ekIs_b_${b.id}`]||"Ek kalem";
                              setBorclar(p=>p.map(x=>x.id===b.id?{
                                ...x,
                                toplam:x.toplam+ekTutar,
                                isler:[...(x.isler||[{ad:x.aciklama||"İlk kalem",tutar:x.toplam,tarih:x.tarih||today()}]),{ad:isAd,tutar:ekTutar,tarih:today()}]
                              }:x));
                              f(`ekIs_b_${b.id}`,""); f(`ekTutar_b_${b.id}`,"");
                            }}>+ Kalem Ekle</Btn>
                          </div>
                          {(b.isler||[]).length>0 && (
                            <div style={{marginTop:10}}>
                              {(b.isler||[]).map((is,i)=>(
                                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",background:"#fff",borderRadius:6,marginBottom:3,fontSize:12}}>
                                  <span style={{color:C.mid}}>{is.tarih||"—"} · {is.ad}</span>
                                  <span style={{fontWeight:700}}>{TL(is.tutar)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{marginTop:14,display:"flex",justifyContent:"flex-end",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <button onClick={()=>{ setDuzenle({tur:"borc",id:b.id,ad:b.alacakli,vade:b.vade||"",aciklama:b.aciklama||""}); setModal("duzenle"); }} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 14px",color:"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>Adı/vadeyi düzenle</button>
                          {silOnay===`b_${b.id}` ? (
                            <span style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:12,color:"#B91C1C",fontWeight:600}}>Silinsin mi?</span>
                              <button onClick={()=>{ setBorclar(p=>p.filter(x=>x.id!==b.id)); setSilOnay(null); setAcikKalem(null); }} style={{background:"#B91C1C",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>Evet, sil</button>
                              <button onClick={()=>setSilOnay(null)} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"6px 14px",color:"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>Vazgeç</button>
                            </span>
                          ) : (
                            <button onClick={()=>setSilOnay(`b_${b.id}`)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"6px 14px",color:"#B91C1C",cursor:"pointer",fontSize:12,fontWeight:600}}>Bu borcu sil</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }); })()}
            </div>
          </div>
        )}

        {/* ═══════════ PERSONEL ═══════════ */}
        {tab==="personel" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <button onClick={()=>{ const d=new Date(seciliAy+"-01"); d.setMonth(d.getMonth()-1); setSeciliAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>‹</button>
              <div style={{fontSize:15,fontWeight:700,minWidth:130,textAlign:"center"}}>{ayStr(seciliAy)}</div>
              <button onClick={()=>{ const d=new Date(seciliAy+"-01"); d.setMonth(d.getMonth()+1); setSeciliAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>›</button>
              {seciliAy!==suAy() && <button onClick={()=>setSeciliAy(suAy())} style={{background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#92400E",fontWeight:600}}>Bu aya dön</button>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:"#92400E",fontWeight:700,marginBottom:4}}>{ayStr(seciliAy).toUpperCase()} TOPLAM</div>
                <div style={{fontSize:24,fontWeight:800,color:"#92400E"}}>{TL(personel.reduce((s,p)=>{ const ay=p.aylar[seciliAy]||{maas:p.maas,avans:0,prim:0,odemeler:[]}; const g={maas:p.maas,avans:0,prim:0,odemeler:[],...ay}; return s+(+g.maas||0)+(+g.avans||0)+(p.prim?(+g.prim||0):0); },0))}</div>
              </div>
              <div style={{background:"#D1FAE5",border:"1px solid #A7F3D0",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:"#065F46",fontWeight:700,marginBottom:4}}>ÖDENEN</div>
                <div style={{fontSize:24,fontWeight:800,color:"#065F46"}}>{TL(personel.reduce((s,p)=>{ const ay=p.aylar[seciliAy]||{odemeler:[]}; return s+(ay.odemeler||[]).reduce((x,o)=>x+(+o.tutar||0),0); },0))}</div>
              </div>
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <Btn small onClick={()=>setModal("yeniPersonel")}>+ Personel Ekle</Btn>
            </div>

            {personel.map(p=>{
              const ay = p.aylar[seciliAy] || {maas:p.maas,avans:0,prim:0,odemeler:[]};
              const guncelAy = {maas:p.maas,avans:0,prim:0,odemeler:[],...ay};
              const toplam=(+guncelAy.maas||0)+(+guncelAy.avans||0)+(p.prim?(+guncelAy.prim||0):0);
              const odenen=(guncelAy.odemeler||[]).reduce((s,o)=>s+(+o.tutar||0),0);
              const kalan=toplam-odenen;
              const setAy = (data) => setPersonel(prev=>prev.map(x=>x.id===p.id?{...x,aylar:{...x.aylar,[seciliAy]:{...guncelAy,...data}}}:x));
              const odemeSil = (idx) => setAy({odemeler:(guncelAy.odemeler||[]).filter((_,i)=>i!==idx)});
              return (
                <div key={p.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px",marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:16}}>{p.ad}</div>
                      {p.prim && <div style={{fontSize:11,color:"#E6A800",marginTop:2}}>★ Primli çalışan</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:22,fontWeight:800,color:"#92400E"}}>{TL(toplam)}</div>
                      <div style={{fontSize:12,color:C.light}}>bu ay toplam</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
                    {[{label:"Maaş",key:"maas"},{label:"Mesai",key:"avans"},...(p.prim?[{label:"Prim",key:"prim"}]:[])].map(item=>(
                      <div key={item.key}>
                        <div style={{fontSize:11,color:C.light,marginBottom:4}}>{item.label}</div>
                        <input type="number" value={guncelAy[item.key]||""} onChange={e=>setAy({[item.key]:+e.target.value||0})} style={{...inp,width:120,fontSize:15,fontWeight:700}}/>
                      </div>
                    ))}
                  </div>
                  <KalanBar toplam={toplam} odenen={odenen}/>
                  {(guncelAy.odemeler||[]).length>0 && (
                    <div style={{marginTop:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.mid,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Ödeme Geçmişi</div>
                      {(guncelAy.odemeler||[]).map((o,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#F7F7F5",borderRadius:6,marginBottom:4,fontSize:13}}>
                          <span style={{color:C.mid}}>{o.tarih||"—"}</span>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontWeight:700,color:"#065F46"}}>+{TL(o.tutar)}</span>
                            <button onClick={()=>{ if(window.confirm("Bu ödemeyi silmek istediğine emin misin?")) odemeSil(i); }} title="Ödemeyi sil" style={{background:"none",border:"none",color:"#B91C1C",cursor:"pointer",fontSize:15,padding:0,lineHeight:1}}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {kalan>0 && (
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:12}}>
                      <input type="number" placeholder="Ödeme tutarı" style={{...inp,width:150}} value={form[`per_${p.id}`]||""} onChange={e=>f(`per_${p.id}`,e.target.value)}/>
                      <input type="date" style={{...inp,width:145}} value={form[`per_tarih_${p.id}`]||today()} onChange={e=>f(`per_tarih_${p.id}`,e.target.value)}/>
                      <Btn small variant="green" onClick={()=>{
                        const tutar=+form[`per_${p.id}`]||0; if(!tutar) return;
                        setAy({odemeler:[...(guncelAy.odemeler||[]),{tutar,tarih:form[`per_tarih_${p.id}`]||today()}]});
                        f(`per_${p.id}`,"");
                      }}>+ Ödeme Ekle</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════ ORTAKLAR ═══════════ */}
        {tab==="ortaklar" && (
          <div>
            {/* Ay seçici — geçmiş ve gelecek */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <button onClick={()=>{ const d=new Date(seciliAy+"-01"); d.setMonth(d.getMonth()-1); setSeciliAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>‹</button>
              <div style={{fontSize:15,fontWeight:700,minWidth:130,textAlign:"center"}}>{ayStr(seciliAy)}</div>
              <button onClick={()=>{ const d=new Date(seciliAy+"-01"); d.setMonth(d.getMonth()+1); setSeciliAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>›</button>
              {seciliAy!==suAy() && <button onClick={()=>setSeciliAy(suAy())} style={{background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#92400E",fontWeight:600}}>Bu aya dön</button>}
            </div>

            {ortaklar.map(o=>{
              const ayAldi = (o.aldi||[]).filter(x=>(x.tarih||"").startsWith(seciliAy));
              const ayHarcadi = (o.harcadi||[]).filter(x=>(x.tarih||"").startsWith(seciliAy));
              const topAldi = ayAldi.reduce((s,x)=>s+(+x.tutar||0),0);
              const topHarcadi = ayHarcadi.reduce((s,x)=>s+(+x.tutar||0),0);
              const net = topAldi - topHarcadi;
              const ekle = (alan) => {
                const tutar=+form[`ort_${alan}_${o.id}`]||0; if(!tutar) return;
                const kayit={tutar,tarih:form[`ort_${alan}_t_${o.id}`]||today(),aciklama:form[`ort_${alan}_a_${o.id}`]||""};
                setOrtaklar(p=>p.map(x=>x.id===o.id?{...x,[alan]:[...(x[alan]||[]),kayit]}:x));
                f(`ort_${alan}_${o.id}`,""); f(`ort_${alan}_a_${o.id}`,"");
              };
              const sil = (alan,idx) => setOrtaklar(p=>p.map(x=>{ if(x.id!==o.id) return x; const arr=[...(x[alan]||[])]; const gercekIdx=(alan==="aldi"?ayAldi:ayHarcadi)[idx]; return {...x,[alan]:arr.filter(it=>it!==gercekIdx)}; }));
              return (
                <div key={o.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                    <div style={{fontWeight:800,fontSize:18}}>{o.ad}</div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,color:C.light}}>bu ay net (aldığı − harcadığı)</div>
                      <div style={{fontSize:20,fontWeight:800,color:net>=0?"#B91C1C":"#065F46"}}>{TL(net)}</div>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                    <div style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:11,color:"#B91C1C",fontWeight:700,marginBottom:4}}>KASADAN ALDIĞI</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#B91C1C"}}>{TL(topAldi)}</div>
                    </div>
                    <div style={{background:"#D1FAE5",border:"1px solid #A7F3D0",borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:11,color:"#065F46",fontWeight:700,marginBottom:4}}>ŞİRKET İÇİN HARCADIĞI</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#065F46"}}>{TL(topHarcadi)}</div>
                    </div>
                  </div>

                  {/* İki kolon: aldığı / harcadığı giriş + geçmiş */}
                  {[
                    {alan:"aldi",baslik:"Kasadan aldığı",renk:"#B91C1C",vari:"red",kayitlar:ayAldi,isaret:"−"},
                    {alan:"harcadi",baslik:"Şirket için harcadığı",renk:"#065F46",vari:"green",kayitlar:ayHarcadi,isaret:"+"},
                  ].map(k=>(
                    <div key={k.alan} style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:700,color:k.renk,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.4px"}}>{k.baslik}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        <input type="number" placeholder="Tutar" style={{...inp,flex:"1 1 90px",minWidth:90}} value={form[`ort_${k.alan}_${o.id}`]||""} onChange={e=>f(`ort_${k.alan}_${o.id}`,e.target.value)}/>
                        <input type="text" placeholder="Açıklama (ne için?)" style={{...inp,flex:"2 1 140px",minWidth:120}} value={form[`ort_${k.alan}_a_${o.id}`]||""} onChange={e=>f(`ort_${k.alan}_a_${o.id}`,e.target.value)}/>
                        <input type="date" style={{...inp,flex:"1 1 130px",minWidth:130}} value={form[`ort_${k.alan}_t_${o.id}`]||today()} onChange={e=>f(`ort_${k.alan}_t_${o.id}`,e.target.value)}/>
                        <Btn small variant={k.vari} onClick={()=>ekle(k.alan)}>+ Ekle</Btn>
                      </div>
                      {k.kayitlar.length>0 && k.kayitlar.map((x,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#F7F7F5",borderRadius:6,marginBottom:4,fontSize:13,gap:8}}>
                          <span style={{color:C.mid,minWidth:74}}>{x.tarih||"—"}</span>
                          <span style={{flex:1,color:C.text}}>{x.aciklama||"—"}</span>
                          <span style={{fontWeight:700,color:k.renk}}>{k.isaret}{TL(x.tutar)}</span>
                          <button onClick={()=>sil(k.alan,i)} style={{background:"none",border:"none",color:C.light,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
            <div style={{fontSize:12,color:C.light,textAlign:"center",marginTop:4}}>
              Ortakların hareketleri kasaya otomatik işlenir. Aylar arası ‹ › ile gezinebilirsin.
            </div>
          </div>
        )}

        {/* ═══════════ VADE TAKVİMİ ═══════════ */}
        {tab==="vade" && (
          <div>
            <div style={{background:C.text,borderRadius:16,padding:"24px 28px",marginBottom:20}}>
              <div style={{fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8}}>30 Günlük Nakit Projeksiyonu</div>
              <div style={{fontSize:40,fontWeight:800,color:projeksiyon30>=0?"#4ADE80":"#F87171",letterSpacing:"-2px",lineHeight:1,marginBottom:6}}>{TL(projeksiyon30)}</div>
              <div style={{fontSize:13,color:"#999"}}>Bugünkü kasa + 30 gün içi tahsilatlar − 30 gün içi ödemeler</div>
            </div>

            {(vadeliBorclar.length===0 && vadeliAlacaklar.length===0) ? (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.light,fontSize:14}}>
                Henüz vade tarihi girilmiş kayıt yok. Alacak/borç eklerken veya düzenlerken vade tarihi girerseniz burada takvim oluşur.
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <div style={{background:C.surface,border:"1px solid #FECACA",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",background:"#FEE2E2",borderBottom:"1px solid #FECACA",fontSize:13,fontWeight:700,color:"#B91C1C"}}>⬇ Ödenecekler (çıkış)</div>
                  {vadeliBorclar.length===0 ? <div style={{padding:24,textAlign:"center",color:C.light,fontSize:13}}>Vadeli borç yok</div> :
                    vadeliBorclar.map(b=>(
                      <div key={b.id} style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <div><div style={{fontSize:14,fontWeight:600}}>{b.alacakli}</div><div style={{marginTop:3}}><VadeRozet vade={b.vade} tur="borc"/></div></div>
                        <div style={{fontWeight:800,color:"#B91C1C"}}>{TL(b.kalan)}</div>
                      </div>
                    ))}
                </div>
                <div style={{background:C.surface,border:"1px solid #A7F3D0",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",background:"#D1FAE5",borderBottom:"1px solid #A7F3D0",fontSize:13,fontWeight:700,color:"#065F46"}}>⬆ Beklenen tahsilat (giriş)</div>
                  {vadeliAlacaklar.length===0 ? <div style={{padding:24,textAlign:"center",color:C.light,fontSize:13}}>Vadeli alacak yok</div> :
                    vadeliAlacaklar.map(a=>(
                      <div key={a.id} style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <div><div style={{fontSize:14,fontWeight:600}}>{a.musteri}</div><div style={{marginTop:3}}><VadeRozet vade={a.vade} tur="alacak"/></div></div>
                        <div style={{fontWeight:800,color:"#065F46"}}>{TL(a.kalan)}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ AYLIK RAPOR ═══════════ */}
        {tab==="rapor" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <button onClick={()=>setRapAy(oncekiAy(rapAy))} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>‹</button>
              <div style={{fontSize:15,fontWeight:700,minWidth:130,textAlign:"center"}}>{ayStr(rapAy)}</div>
              <button onClick={()=>{ const d=new Date(rapAy+"-01"); d.setMonth(d.getMonth()+1); setRapAy(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:16,cursor:"pointer",color:C.mid}}>›</button>
              {rapAy!==suAy() && <button onClick={()=>setRapAy(suAy())} style={{background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#92400E",fontWeight:600}}>Bu aya dön</button>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:20}}>
              {[
                {label:"Gelir",val:rapor.gelir,onc:oncekiRapor.gelir,color:"#065F46"},
                {label:"Gider",val:rapor.gider,onc:oncekiRapor.gider,color:"#B91C1C"},
                {label:"Net (kâr/zarar)",val:rapor.net,onc:oncekiRapor.net,color:rapor.net>=0?"#065F46":"#B91C1C"},
              ].map(k=>{
                const fark = k.val - k.onc;
                return (
                  <div key={k.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
                    <div style={{fontSize:11,color:C.light,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{k.label}</div>
                    <div style={{fontSize:24,fontWeight:800,color:k.color,letterSpacing:"-1px"}}>{TL(k.val)}</div>
                    {k.onc!==0 && (
                      <div style={{fontSize:12,color:fark>=0?"#065F46":"#B91C1C",marginTop:4}}>
                        {fark>=0?"▲":"▼"} {TL(Math.abs(fark))} geçen aya göre
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Görünüm seçici */}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {[
                {id:"kategori",label:"Kategoriye göre"},
                {id:"kaynak",label:"Kaynağa göre"},
                {id:"ortak",label:"Ortak bazında"},
                {id:"gelir",label:"Gelir kaynağı"},
              ].map(g=>(
                <button key={g.id} onClick={()=>{setRapGorunum(g.id);setAcikGrup(null);}} style={{
                  background:rapGorunum===g.id?"#FFC107":"#fff",
                  border:`1px solid ${rapGorunum===g.id?"#FFC107":C.border}`,
                  borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:rapGorunum===g.id?700:400,cursor:"pointer",
                }}>{g.label}</button>
              ))}
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700}}>
                {ayStr(rapAy)} — {rapGorunum==="gelir"?"Gelir Dağılımı":rapGorunum==="ortak"?"Ortak Harcamaları":"Gider Dağılımı"}
                <span style={{fontSize:11,color:C.light,fontWeight:400,marginLeft:8}}>satıra tıkla → detay</span>
              </div>
              {(() => {
                const veri = rapGorunum==="kategori"?rapor.kategoriler
                  : rapGorunum==="kaynak"?rapor.kaynaklar
                  : rapGorunum==="ortak"?rapor.ortakGider
                  : rapor.gelirKaynak;
                const toplam = rapGorunum==="gelir"?rapor.gelir:rapor.gider;
                const anahtarlar = Object.entries(veri).sort((a,b)=>b[1].toplam-a[1].toplam);
                if(anahtarlar.length===0) return <div style={{padding:28,textAlign:"center",color:C.light,fontSize:13}}>Bu ay için kayıt yok</div>;
                return anahtarlar.map(([ad,grup])=>{
                  const pct = toplam>0 ? Math.round((grup.toplam/toplam)*100) : 0;
                  const acik = acikGrup===`${rapGorunum}_${ad}`;
                  const renk = rapGorunum==="gelir"?"#059669":"#FFC107";
                  return (
                    <div key={ad} style={{borderBottom:`1px solid ${C.border}`}}>
                      <div onClick={()=>setAcikGrup(acik?null:`${rapGorunum}_${ad}`)} style={{padding:"12px 20px",cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6,alignItems:"center"}}>
                          <span style={{fontWeight:600}}>{acik?"▾":"▸"} {ad} <span style={{color:C.light,fontWeight:400,fontSize:12}}>({grup.kayitlar.length})</span></span>
                          <span style={{fontWeight:700}}>{TL(grup.toplam)} <span style={{color:C.light,fontWeight:400}}>· %{pct}</span></span>
                        </div>
                        <div style={{background:"#E5E7EB",borderRadius:4,height:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:renk}}/></div>
                      </div>
                      {acik && (
                        <div style={{padding:"4px 20px 14px",background:"#FAFAF8"}}>
                          {grup.kayitlar.slice().sort((a,b)=>(b.tarih||"").localeCompare(a.tarih||"")).map((x,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#fff",borderRadius:6,marginBottom:4,fontSize:13,gap:8}}>
                              <span style={{color:C.mid,minWidth:74}}>{x.tarih||"—"}</span>
                              <span style={{flex:1}}>{x.aciklama}</span>
                              <span style={{fontWeight:700,color:rapGorunum==="gelir"?"#065F46":"#B91C1C"}}>{rapGorunum==="gelir"?"+":"-"}{TL(x.tutar)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ═══════════ YEDEK ═══════════ */}
        {tab==="yedek" && (
          <div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"24px",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>Verileri yedekle ve taşı</div>
              <div style={{fontSize:13,color:C.mid,marginBottom:18,lineHeight:1.6}}>
                Tüm kayıtlarını tek dosyaya indirir. Bu dosyayı başka bir cihaza (telefon, muhasebecinin bilgisayarı) mail/WhatsApp ile gönderip oradan "Yedek yükle" ile açabilirsin. Düzenli indirmen, veri kaybına karşı en güvenli yol.
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <Btn onClick={disaAktar}>⬇ Yedek indir (.json)</Btn>
                <label style={{cursor:"pointer"}}>
                  <span style={{display:"inline-block",background:"#F3F4F6",color:"#555",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:600,fontSize:13}}>⬆ Yedek yükle</span>
                  <input type="file" accept="application/json,.json" onChange={iceAktar} style={{display:"none"}}/>
                </label>
                <Btn variant="ghost" onClick={csvAktar}>⬇ Muhasebe için Excel/CSV</Btn>
              </div>
            </div>
            <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:12,padding:"16px 20px",fontSize:13,color:"#92400E",lineHeight:1.6}}>
              <strong>Farklı cihazlardan erişim:</strong> Bu sürüm verini bu cihazda tutar. Sen + muhasebeci + telefon aynı verilere baksın istiyorsan yedek dosyasını paylaşarak senkron tutabilirsin. Anlık otomatik bulut senkronu istersen, bir sonraki adımda bir sunucu/veritabanı kurmamız gerekir — hazır olduğunda onu konuşalım.
            </div>
          </div>
        )}

      </div>

      {/* ═══════════ MODALLER ═══════════ */}
      {modal==="yeniIslem" && (() => {
        const q = (form.arama||"").toLowerCase().trim();
        /* Öneri kaynakları: gelir → açık alacaklar; gider → personel (bu ay maaş kalanı) + açık borçlar */
        let oneriler = [];
        if (q.length>=2) {
          if (form.tip==="gelir") {
            alacaklar.forEach(a=>{
              const kalan=a.toplam-a.tahsilat.reduce((s,t)=>s+(+t.tutar||0),0);
              if(kalan>0 && a.musteri.toLowerCase().includes(q)) oneriler.push({tur:"alacak",id:a.id,ad:a.musteri,kalan,not:"açık alacak"});
            });
          } else {
            personel.forEach(p=>{
              if(!p.ad.toLowerCase().includes(q)) return;
              const ay=p.aylar[seciliAy]||{maas:p.maas,avans:0,prim:0,odemeler:[]};
              const gun={maas:p.maas,avans:0,prim:0,odemeler:[],...ay};
              const toplam=(+gun.maas||0)+(+gun.avans||0)+(p.prim?(+gun.prim||0):0);
              const kalan=toplam-(gun.odemeler||[]).reduce((s,o)=>s+(+o.tutar||0),0);
              oneriler.push({tur:"personel",id:p.id,ad:p.ad,kalan,not:`${ayStr(seciliAy)} maaş kalanı`});
            });
            borclar.forEach(b=>{
              const kalan=b.toplam-b.odeme.reduce((s,o)=>s+(+o.tutar||0),0);
              if(kalan>0 && b.alacakli.toLowerCase().includes(q)) oneriler.push({tur:"borc",id:b.id,ad:b.alacakli,kalan,not:"açık borç"});
            });
          }
          oneriler = oneriler.slice(0,6);
        }
        const secili = form.bagliKaynak;
        const secKaynak = (o) => { f("bagliKaynak",o); f("aciklama",o.ad); f("arama",o.ad); };
        return (
        <Modal title={form.tip==="gelir"?"Gelir Ekle":"Gider Ekle"} onClose={closeModal}>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {["gelir","gider"].map(t=>(
              <button key={t} onClick={()=>{f("tip",t);f("bagliKaynak",null);f("arama","");}} style={{flex:1,padding:"9px",borderRadius:8,border:`2px solid ${form.tip===t?"#FFC107":C.border}`,background:form.tip===t?"#FFF9E6":"#fff",fontWeight:form.tip===t?700:400,cursor:"pointer",fontSize:13}}>{t==="gelir"?"+ Gelir":"- Gider"}</button>
            ))}
          </div>

          {/* Akıllı arama: kayıtlı müşteri/personel/borç */}
          <div style={{marginBottom:12,position:"relative"}}>
            <label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>
              {form.tip==="gelir"?"MÜŞTERİ ARA (opsiyonel — tutar alacaktan düşer)":"PERSONEL / TEDARİKÇİ ARA (opsiyonel — tutar oradan düşer)"}
            </label>
            <input style={inp} value={form.arama||""} placeholder={form.tip==="gelir"?"örn: siv → Sivil Pilates":"örn: ser → Serdar"}
              onChange={e=>{f("arama",e.target.value); f("bagliKaynak",null);}}/>
            {oneriler.length>0 && !secili && (
              <div style={{position:"absolute",zIndex:5,left:0,right:0,background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden"}}>
                {oneriler.map(o=>(
                  <div key={`${o.tur}_${o.id}`} onClick={()=>secKaynak(o)} style={{padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <div><div style={{fontSize:14,fontWeight:600}}>{o.ad}</div><div style={{fontSize:11,color:C.light}}>{o.not}</div></div>
                    <div style={{fontSize:12,color:C.mid,whiteSpace:"nowrap"}}>kalan {TL(o.kalan)}</div>
                  </div>
                ))}
              </div>
            )}
            {secili && (
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8,background:"#FFF9E6",border:"1px solid #FFC107",borderRadius:8,padding:"8px 12px"}}>
                <span style={{fontSize:13,color:"#92400E",flex:1}}>✓ <strong>{secili.ad}</strong> seçili — tutar buradan düşecek</span>
                <button onClick={()=>{f("bagliKaynak",null);f("arama","");}} style={{background:"none",border:"none",color:"#92400E",cursor:"pointer",fontSize:16}}>×</button>
              </div>
            )}
          </div>

          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AÇIKLAMA</label><input style={inp} value={form.aciklama||""} onChange={e=>f("aciklama",e.target.value)} placeholder="Ne için?"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>TUTAR (₺)</label><input style={inp} type="number" value={form.tutar||""} onChange={e=>f("tutar",e.target.value)} placeholder="0"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>TARİH</label><input style={inp} type="date" value={form.tarih||today()} onChange={e=>f("tarih",e.target.value)}/></div>
          <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>KATEGORİ</label>
            <select style={inp} value={form.kategori||""} onChange={e=>f("kategori",e.target.value)}>
              <option value="">Seç...</option>
              {form.tip==="gelir"?<><option>Müşteri Ödemesi</option><option>Avans</option><option>Diğer Gelir</option></>:<><option>Malzeme</option><option>Kira</option><option>Yakıt</option><option>Yemek</option><option>Vergi/SGK</option><option>Maaş</option><option>Diğer Gider</option></>}
            </select>
          </div>
          <Btn onClick={()=>{
            const tutar=+form.tutar||0;
            const src=form.bagliKaynak;
            /* Bağlı kaynak seçildiyse tutarı oradan düş (kasaya zaten cari/personel üzerinden yansıyacak, ayrıca elle işlem eklemiyoruz) */
            if (src && tutar>0) {
              const trh=form.tarih||today();
              if (src.tur==="alacak") setAlacaklar(p=>p.map(x=>x.id===src.id?{...x,tahsilat:[...x.tahsilat,{tutar,tarih:trh}]}:x));
              else if (src.tur==="borc") setBorclar(p=>p.map(x=>x.id===src.id?{...x,odeme:[...x.odeme,{tutar,tarih:trh}]}:x));
              else if (src.tur==="personel") setPersonel(p=>p.map(x=>{ if(x.id!==src.id) return x; const ay=x.aylar[seciliAy]||{maas:x.maas,avans:0,prim:0,odemeler:[]}; const gun={maas:x.maas,avans:0,prim:0,odemeler:[],...ay}; return {...x,aylar:{...x.aylar,[seciliAy]:{...gun,odemeler:[...(gun.odemeler||[]),{tutar,tarih:trh}]}}}; }));
            } else {
              /* Bağlı kaynak yoksa normal elle işlem */
              setIslemler(p=>[...p,{id:Date.now(),tip:form.tip||"gelir",aciklama:form.aciklama||"",tutar,tarih:form.tarih||today(),kategori:form.kategori||""}]);
            }
            closeModal();
          }}>{secili?`${secili.ad} — kaydet`:"Ekle"}</Btn>
        </Modal>
      ); })()}

      {modal==="yeniAlacak" && (
        <Modal title="Alacak Ekle" onClose={closeModal}>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>MÜŞTERİ / FİRMA</label><input style={inp} value={form.musteri||""} onChange={e=>f("musteri",e.target.value)} placeholder="Müşteri adı"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>TOPLAM TUTAR (₺)</label><input style={inp} type="number" value={form.toplam||""} onChange={e=>f("toplam",e.target.value)} placeholder="0"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>VADE (beklenen tahsilat tarihi)</label><input style={inp} type="date" value={form.vade||""} onChange={e=>f("vade",e.target.value)}/></div>
          <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AÇIKLAMA</label><input style={inp} value={form.aciklama||""} onChange={e=>f("aciklama",e.target.value)} placeholder="İş tanımı..."/></div>
          <Btn onClick={()=>{ setAlacaklar(p=>[...p,{id:`a${Date.now()}`,musteri:form.musteri||"",toplam:+form.toplam||0,tahsilat:[],tarih:today(),vade:form.vade||"",aciklama:form.aciklama||"",acilisAy:cariAy}]); closeModal(); }}>Ekle</Btn>
        </Modal>
      )}

      {modal==="yeniBorc" && (
        <Modal title="Borç Ekle" onClose={closeModal}>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>ALACAKLI / TEDARİKÇİ</label><input style={inp} value={form.alacakli||""} onChange={e=>f("alacakli",e.target.value)} placeholder="Firma / kişi"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>TOPLAM TUTAR (₺)</label><input style={inp} type="number" value={form.toplam||""} onChange={e=>f("toplam",e.target.value)} placeholder="0"/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>VADE (son ödeme tarihi)</label><input style={inp} type="date" value={form.vade||""} onChange={e=>f("vade",e.target.value)}/></div>
          <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AÇIKLAMA</label><input style={inp} value={form.aciklama||""} onChange={e=>f("aciklama",e.target.value)} placeholder="Açıklama..."/></div>
          <Btn onClick={()=>{ setBorclar(p=>[...p,{id:`b${Date.now()}`,alacakli:form.alacakli||"",toplam:+form.toplam||0,odeme:[],tarih:today(),vade:form.vade||"",aciklama:form.aciklama||"",acilisAy:cariAy}]); closeModal(); }}>Ekle</Btn>
        </Modal>
      )}

      {modal==="yeniPersonel" && (
        <Modal title="Personel Ekle" onClose={closeModal}>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AD SOYAD</label><input style={inp} value={form.ad||""} onChange={e=>f("ad",e.target.value)} placeholder="Personel adı"/></div>
          <div style={{marginBottom:16}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AYLIK MAAŞ (₺)</label><input style={inp} type="number" value={form.maas||""} onChange={e=>f("maas",e.target.value)} placeholder="0"/></div>
          <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,fontSize:14,cursor:"pointer"}}>
            <input type="checkbox" checked={!!form.prim} onChange={e=>f("prim",e.target.checked)}/> Primli çalışan
          </label>
          <Btn onClick={()=>{ if(!form.ad) return; setPersonel(p=>[...p,{id:`p${Date.now()}`,ad:form.ad,maas:+form.maas||0,prim:!!form.prim,baslangic:suAy(),aylar:{}}]); closeModal(); }}>Ekle</Btn>
        </Modal>
      )}

      {modal==="duzenle" && duzenle && (
        <Modal title={duzenle.tur==="alacak"?"Alacağı Düzenle":"Borcu Düzenle"} onClose={()=>{setModal(null);setDuzenle(null);}}>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>{duzenle.tur==="alacak"?"MÜŞTERİ ADI":"TEDARİKÇİ / KİŞİ"}</label><input style={inp} value={duzenle.ad} onChange={e=>setDuzenle({...duzenle,ad:e.target.value})}/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>VADE</label><input style={inp} type="date" value={duzenle.vade} onChange={e=>setDuzenle({...duzenle,vade:e.target.value})}/></div>
          <div style={{marginBottom:20}}><label style={{fontSize:12,fontWeight:600,color:C.mid,display:"block",marginBottom:5}}>AÇIKLAMA</label><input style={inp} value={duzenle.aciklama} onChange={e=>setDuzenle({...duzenle,aciklama:e.target.value})}/></div>
          <div style={{fontSize:12,color:C.light,marginBottom:16,lineHeight:1.5}}>Tutarı değiştirmek için pencereyi kapatıp kalemi açın; "yeni iş ekle" ile tutar ekleyebilir, yanlış tahsilatı geçmişten silebilirsiniz.</div>
          <Btn onClick={()=>{
            if(duzenle.tur==="alacak") setAlacaklar(p=>p.map(x=>x.id===duzenle.id?{...x,musteri:duzenle.ad,vade:duzenle.vade,aciklama:duzenle.aciklama}:x));
            else setBorclar(p=>p.map(x=>x.id===duzenle.id?{...x,alacakli:duzenle.ad,vade:duzenle.vade,aciklama:duzenle.aciklama}:x));
            setModal(null); setDuzenle(null);
          }}>Kaydet</Btn>
        </Modal>
      )}

    </div>
  );
}
