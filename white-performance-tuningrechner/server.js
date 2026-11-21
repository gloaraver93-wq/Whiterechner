'use strict';
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL fehlt. Bitte PostgreSQL konfigurieren.');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET muss gesetzt sein (mindestens 32 Zeichen).');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'https:'], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: [] } } }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  name: 'wp.sid', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '1d' }));
app.use(express.static(path.join(__dirname, 'public')));

const seedItems = [
 ['Fahrwerksteile','Fahrwerk','🔩',500],['Motoröl','Wartung','🛢️',500],['Motorswap','Motor & Antrieb','🔧',30000],['Ersatzreifen','Räder & Reifen','🛞',500],['Luftfilter','Motor & Antrieb','💨',500],['Elektromotor','Motor & Antrieb','⚡',1500],['Ersatzkupplung','Getriebe','⚙️',500],['Elektrofahrzeug-Batterie','Elektrik','🔋',500],['Zündkerze','Motor & Antrieb','✨',500],['Ersatzbremsbeläge','Bremsen','🛑',500],['Elektrofahrzeug-Kühlmittel','Wartung','❄️',500],['Keramikbremsen','Bremsen','🛑',10000],['Optische Anbauteile','Optik','🧩',1000],['Lackierset','Lackierung','🎨',250],['Fahrzeugrädersatz','Räder & Reifen','🛞',1000],['Reifenrauch-Set','Optik','💨',1000],['Fahrzeugextras-Set','Extras','✨',1000],['Reinigungsset','Wartung','🧽',500],['Reparaturset (RepKit)','Reparatur','🧰',4000],['Gewebeklebeband','Reparatur','🩹',2500],
 ['Motorstufe 1','Leistungsteile','🏎️',0],['Motorstufe 2','Leistungsteile','🏎️',0],['Motorstufe 3','Leistungsteile','🏎️',0],['Motorstufe 4','Leistungsteile','🏎️',0],
 ['Getriebestufe 1','Leistungsteile','⚙️',0],['Getriebestufe 2','Leistungsteile','⚙️',0],['Getriebestufe 3','Leistungsteile','⚙️',0],
 ['Fahrwerksstufe 1','Leistungsteile','🔩',0],['Fahrwerksstufe 2','Leistungsteile','🔩',0],['Fahrwerksstufe 3','Leistungsteile','🔩',0],
 ['Bremsenstufe 1','Leistungsteile','🛑',0],['Bremsenstufe 2','Leistungsteile','🛑',0],['Bremsenstufe 3','Leistungsteile','🛑',0]
];
async function initDb() {
 await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','employee')), can_discount BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, icon TEXT DEFAULT '🔧', image_url TEXT, price INTEGER NOT NULL DEFAULT 0 CHECK(price>=0), active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER DEFAULT 0);
 CREATE UNIQUE INDEX IF NOT EXISTS items_name_unique ON items(name);
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS user_sessions (sid varchar NOT NULL PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL); CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions(expire);`);
 for (let i=0;i<seedItems.length;i++) { const [name,cat,icon,price]=seedItems[i]; await pool.query('INSERT INTO items(name,category,icon,price,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(name) DO NOTHING',[name,cat,icon,price,i]); }
 await pool.query("INSERT INTO settings(key,value) VALUES ('discount_enabled','true'),('max_discount','20') ON CONFLICT(key) DO NOTHING");
 const adminName=process.env.ADMIN_USERNAME || 'admin';
 if (process.env.ADMIN_PASSWORD) {
   const exists=await pool.query('SELECT id FROM users WHERE username=$1',[adminName]);
   if (!exists.rowCount) { const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12); await pool.query("INSERT INTO users(username,password_hash,role,can_discount) VALUES($1,$2,'admin',true)",[adminName,hash]); console.log('Initialer Admin angelegt:',adminName); }
 }
}
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{error:'Zu viele Anmeldeversuche. Bitte später erneut versuchen.'}});
async function auth(req,res,next){ try { if(!req.session.user) return res.status(401).json({error:'Anmeldung erforderlich.'}); const q=await pool.query('SELECT id,username,role,can_discount FROM users WHERE id=$1',[req.session.user.id]); const u=q.rows[0]; if(!u){req.session.destroy(()=>{});return res.status(401).json({error:'Zugang nicht mehr vorhanden.'});} req.session.user={id:u.id,username:u.username,role:u.role,canDiscount:u.can_discount}; next(); } catch(e){next(e);} }
async function admin(req,res,next){ try { if(!req.session.user) return res.status(401).json({error:'Anmeldung erforderlich.'}); const q=await pool.query('SELECT id,username,role,can_discount FROM users WHERE id=$1',[req.session.user.id]); const u=q.rows[0]; if(!u){req.session.destroy(()=>{});return res.status(401).json({error:'Zugang nicht mehr vorhanden.'});} req.session.user={id:u.id,username:u.username,role:u.role,canDiscount:u.can_discount}; if(u.role!=='admin') return res.status(403).json({error:'Adminberechtigung erforderlich.'}); next(); } catch(e){next(e);} }
function sameOrigin(req,res,next){ if(['POST','PUT','PATCH','DELETE'].includes(req.method)){ const origin=req.get('origin'); if(origin){ try { if(new URL(origin).host!==req.get('host')) return res.status(403).json({error:'Ungültige Herkunft.'}); } catch { return res.status(403).json({error:'Ungültige Herkunft.'}); } } } next(); }
app.use('/api',sameOrigin);
app.get('/healthz',(req,res)=>res.type('text').send('ok'));
app.post('/api/login',loginLimiter,async(req,res)=>{ try { const {username,password}=req.body||{}; if(typeof username!=='string'||typeof password!=='string'||username.length>80||password.length>200) return res.status(400).json({error:'Bitte Zugangsdaten eingeben.'}); const q=await pool.query('SELECT id,username,password_hash,role,can_discount FROM users WHERE username=$1',[username.trim()]); const u=q.rows[0]; if(!u || !(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({error:'Benutzername oder Passwort falsch.'}); req.session.regenerate(err=>{ if(err)return res.status(500).json({error:'Anmeldung fehlgeschlagen.'}); req.session.user={id:u.id,username:u.username,role:u.role,canDiscount:u.can_discount}; req.session.save(e=>{if(e)return res.status(500).json({error:'Sitzung konnte nicht gespeichert werden.'}); res.json({user:req.session.user});}); }); } catch(e){console.error(e);res.status(500).json({error:'Serverfehler.'});} });
app.post('/api/logout',auth,(req,res)=>req.session.destroy(()=>{res.clearCookie('wp.sid');res.json({ok:true});}));
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));
app.get('/api/catalog',auth,async(req,res)=>{ const q=await pool.query('SELECT id,name,category,icon,image_url FROM items WHERE active=true ORDER BY sort_order,id'); res.json({items:q.rows,user:req.session.user}); });
app.post('/api/calculate',auth,async(req,res)=>{ try { const {items,discount=0}=req.body||{}; if(!Array.isArray(items)||items.length>100) return res.status(400).json({error:'Ungültige Auswahl.'}); const ids=[...new Set(items.map(x=>Number(x.id)))]; if(ids.some(x=>!Number.isInteger(x)||x<1)) return res.status(400).json({error:'Ungültige Teileauswahl.'}); const quantities=new Map(); for(const x of items){const q=Number(x.quantity); if(!Number.isInteger(q)||q<1||q>99)return res.status(400).json({error:'Menge muss zwischen 1 und 99 liegen.'}); quantities.set(Number(x.id),(quantities.get(Number(x.id))||0)+q); } const found=await pool.query('SELECT id,name,category,price FROM items WHERE active=true AND id=ANY($1::int[])', [ids]); if(found.rowCount!==ids.length)return res.status(400).json({error:'Ein oder mehrere Teile sind nicht verfügbar.'}); const settings=(await pool.query("SELECT key,value FROM settings WHERE key IN ('discount_enabled','max_discount')")).rows.reduce((a,x)=>(a[x.key]=x.value,a),{}); let pct=0; if(Number(discount)>0){ if(!req.session.user.canDiscount && req.session.user.role!=='admin')return res.status(403).json({error:'Du bist nicht rabattberechtigt.'}); if(settings.discount_enabled!=='true')return res.status(403).json({error:'Rabattfunktion ist deaktiviert.'}); pct=Math.min(Math.max(Number(discount),0),Math.min(100,Number(settings.max_discount)||0)); } const lines=found.map(x=>({id:x.id,name:x.name,category:x.category,quantity:quantities.get(x.id)})); const subtotal=found.reduce((s,x)=>s+x.price*quantities.get(x.id),0); const saving=Math.round(subtotal*pct)/100; res.json({lines,subtotal,discountPercent:pct,saving,total:Math.max(0,subtotal-saving)}); }catch(e){console.error(e);res.status(500).json({error:'Berechnung fehlgeschlagen.'});} });
app.get('/api/admin/items',admin,async(req,res)=>{const q=await pool.query('SELECT * FROM items ORDER BY category,sort_order,id');res.json({items:q.rows});});
app.post('/api/admin/items',admin,async(req,res)=>{const {name,category,icon='🔧',image_url=null,price=0,active=true}=req.body||{}; if(!name||!category||!Number.isInteger(Number(price))||Number(price)<0)return res.status(400).json({error:'Name, Kategorie und gültiger Preis sind erforderlich.'}); const q=await pool.query('INSERT INTO items(name,category,icon,image_url,price,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[String(name).slice(0,100),String(category).slice(0,80),String(icon).slice(0,12),image_url?String(image_url).slice(0,500):null,Number(price),!!active]);res.status(201).json({item:q.rows[0]});});
app.put('/api/admin/items/:id',admin,async(req,res)=>{const {name,category,icon='🔧',image_url=null,price=0,active=true}=req.body||{};if(!name||!category||!Number.isInteger(Number(price))||Number(price)<0)return res.status(400).json({error:'Ungültige Angaben.'});const q=await pool.query('UPDATE items SET name=$1,category=$2,icon=$3,image_url=$4,price=$5,active=$6 WHERE id=$7 RETURNING *',[String(name).slice(0,100),String(category).slice(0,80),String(icon).slice(0,12),image_url?String(image_url).slice(0,500):null,Number(price),!!active,Number(req.params.id)]);if(!q.rowCount)return res.status(404).json({error:'Teil nicht gefunden.'});res.json({item:q.rows[0]});});
app.delete('/api/admin/items/:id',admin,async(req,res)=>{await pool.query('DELETE FROM items WHERE id=$1',[Number(req.params.id)]);res.json({ok:true});});
const upload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,UPLOAD_DIR),filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:4*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/png','image/jpeg','image/webp','image/gif'].includes(file.mimetype))});
app.post('/api/admin/upload',admin,(req,res)=>upload.single('image')(req,res,err=>{if(err)return res.status(400).json({error:'Upload fehlgeschlagen. Erlaubt: PNG, JPG, WEBP oder GIF bis 4 MB.'});if(!req.file)return res.status(400).json({error:'Bitte ein Bild auswählen.'});res.json({url:'/uploads/'+req.file.filename});}));
app.get('/api/admin/settings',admin,async(req,res)=>{const q=await pool.query('SELECT key,value FROM settings');res.json(Object.fromEntries(q.rows.map(x=>[x.key,x.value])));});
app.put('/api/admin/settings',admin,async(req,res)=>{const {discount_enabled,max_discount}=req.body||{};const pct=Number(max_discount);if(!Number.isFinite(pct)||pct<0||pct>100)return res.status(400).json({error:'Maximalrabatt muss zwischen 0 und 100 liegen.'});await pool.query("INSERT INTO settings(key,value) VALUES('discount_enabled',$1),('max_discount',$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[discount_enabled?'true':'false',String(pct)]);res.json({ok:true});});
app.get('/api/admin/users',admin,async(req,res)=>{const q=await pool.query('SELECT id,username,role,can_discount,created_at FROM users ORDER BY id');res.json({users:q.rows});});
app.post('/api/admin/users',admin,async(req,res)=>{const {username,password,role='employee',can_discount=false}=req.body||{};if(typeof username!=='string'||username.trim().length<3||typeof password!=='string'||password.length<10||!['admin','employee'].includes(role))return res.status(400).json({error:'Benutzername min. 3 Zeichen, Passwort min. 10 Zeichen.'});try{const hash=await bcrypt.hash(password,12);const q=await pool.query('INSERT INTO users(username,password_hash,role,can_discount) VALUES($1,$2,$3,$4) RETURNING id,username,role,can_discount',[username.trim(),hash,role,!!can_discount]);res.status(201).json({user:q.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({error:'Benutzername existiert bereits.'});throw e;}});
app.patch('/api/admin/users/:id',admin,async(req,res)=>{const {role,can_discount}=req.body||{};if(!['admin','employee'].includes(role))return res.status(400).json({error:'Ungültige Rolle.'});if(Number(req.params.id)===req.session.user.id && role!=='admin')return res.status(400).json({error:'Eigenen Adminzugang kannst du nicht herabstufen.'});const q=await pool.query('UPDATE users SET role=$1,can_discount=$2 WHERE id=$3 RETURNING id,username,role,can_discount',[role,!!can_discount,Number(req.params.id)]);if(!q.rowCount)return res.status(404).json({error:'Benutzer nicht gefunden.'});res.json({user:q.rows[0]});});
app.delete('/api/admin/users/:id',admin,async(req,res)=>{if(Number(req.params.id)===req.session.user.id)return res.status(400).json({error:'Du kannst deinen eigenen Zugang nicht löschen.'});await pool.query('DELETE FROM users WHERE id=$1',[Number(req.params.id)]);res.json({ok:true});});
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).json({error:'Interner Serverfehler.'});});
initDb().then(()=>app.listen(PORT,()=>console.log('White Performance Tuningrechner läuft auf Port '+PORT))).catch(e=>{console.error('Datenbankinitialisierung fehlgeschlagen:',e);process.exit(1);});
