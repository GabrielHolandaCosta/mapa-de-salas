import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { parseRoomDocx } from './docx-parser.js';

const db = new PrismaClient(); const app = express();
const require=createRequire(import.meta.url);
const pdfParse=require('pdf-parse/lib/pdf-parse.js') as (buffer:Buffer)=>Promise<any>;
const roles=['ADMIN','EDITOR','VIEWER'] as const;
const scopes=['PADRAO','DATA'] as const;
const shifts=['MANHA','TARDE'] as const;
const roomStatuses=['LIVRE','OCUPADA','RESERVADA','FECHADA'] as const;
type Role=typeof roles[number];
type Shift=typeof shifts[number];
type AuditAction='CRIACAO'|'EDICAO'|'LIMPEZA'|'RESTAURACAO'|'IMPORTACAO';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024}});
const secret = process.env.JWT_SECRET || 'development-only-change-me';
app.set('trust proxy', 1); app.use(express.json({limit:'1mb'})); app.use(cookieParser());
app.use('/api/auth/login', rateLimit({windowMs:15*60_000,max:10,standardHeaders:true,legacyHeaders:false}));
type AuthUser={id:string;name:string;username:string;role:Role};
declare global { namespace Express { interface Request { user?:AuthUser } } }
function token(u:AuthUser){return jwt.sign(u,secret,{expiresIn:'8h'});}
function auth(req:express.Request,res:express.Response,next:express.NextFunction){try { const raw=req.cookies.session || req.header('authorization')?.replace('Bearer ',''); if(!raw) throw 0; req.user=jwt.verify(raw,secret) as AuthUser; next(); }catch{return res.status(401).json({error:'Sessão inválida ou expirada.'});}}
function allow(...roles:Role[]){return (req:express.Request,res:express.Response,next:express.NextFunction)=>!req.user||!roles.includes(req.user.role)?res.status(403).json({error:'Você não tem permissão para esta ação.'}):next();}
const assignmentSchema=z.object({room:z.number().int().min(1).max(17),weekday:z.number().int().min(0).max(5).nullable().optional(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),scope:z.enum(scopes),shift:z.enum(shifts),status:z.enum(roomStatuses),professional:z.string().max(140).nullable().optional(),code:z.string().max(40).nullable().optional(),specialty:z.string().max(140).nullable().optional(),operator:z.string().max(140).nullable().optional(),notes:z.string().max(2000).nullable().optional(),rawText:z.string().max(3000).nullable().optional(),needsReview:z.boolean().optional(),version:z.number().int().optional()});
const clean=(x:any)=>Object.fromEntries(Object.entries(x).filter(([k])=>!['id','updatedAt','updatedById','version'].includes(k)));
function dateAt(s?:string|null){return s?new Date(`${s}T12:00:00.000Z`):null}
async function audit(userId:string, action:AuditAction, a:any, before:any, after:any){await db.audit.create({data:{userId,action,assignmentId:a?.id,room:a?.room,weekday:a?.weekday,date:a?.date,scope:a?.scope,shift:a?.shift,before:before??undefined,after:after??undefined} as any});}
async function ensureSeed(){ const username=(process.env.ADMIN_USER||'admin').toLowerCase(); const email=`${username}@local`; const exists=await db.user.findFirst({where:{OR:[{username},{email}]}}); if(exists&&!exists.username)await db.user.update({where:{id:exists.id},data:{username}});if(!exists) await db.user.create({data:{name:process.env.ADMIN_NAME||'Administrador',username,email,passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD||'123456',12),role:'ADMIN'}}); for(let day=0;day<6;day++)for(let room=1;room<=17;room++)for(const shift of ['MANHA','TARDE'] as Shift[]) await db.assignment.upsert({where:{room_weekday_scope_shift:{room,weekday:day,scope:'PADRAO',shift}},update:{},create:{room,weekday:day,scope:'PADRAO',shift,status:'LIVRE'}}); }

app.post('/api/auth/login',async(req,res)=>{const data=z.object({username:z.string().min(1),password:z.string().min(1)}).safeParse(req.body); if(!data.success)return res.status(400).json({error:'Informe usuário e senha.'});const username=data.data.username.trim().toLowerCase();const u=await db.user.findFirst({where:{OR:[{username},{email:username.includes('@')?username:`${username}@local`}]}}); if(!u||!u.active||!roles.includes(u.role as Role)||!await bcrypt.compare(data.data.password,u.passwordHash))return res.status(401).json({error:'Usuário ou senha inválidos.'}); const me:AuthUser={id:u.id,name:u.name,username:u.username||u.email.split('@')[0],role:u.role as Role};res.cookie('session',token(me),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*3600e3});res.json({user:me});});
app.post('/api/auth/logout',(_q,res)=>{res.clearCookie('session');res.status(204).end()}); app.get('/api/auth/me',auth,(q,res)=>res.json({user:q.user}));
app.get('/api/assignments',auth,async(req,res)=>{const scope=req.query.scope==='DATA'?'DATA':'PADRAO';const weekday=Number(req.query.weekday??0);const date=typeof req.query.date==='string'?req.query.date:null;let rows:any[]=[];if(scope==='DATA'&&date){const overrides=await db.assignment.findMany({where:{scope:'DATA',date:dateAt(date)}});const jsDay=new Date(`${date}T12:00:00Z`).getUTCDay();const base=await db.assignment.findMany({where:{scope:'PADRAO',weekday:jsDay===0?5:jsDay-1}});const map=new Map(base.map(a=>[`${a.room}-${a.shift}`,a]));overrides.forEach(a=>map.set(`${a.room}-${a.shift}`,a));rows=[...map.values()];}else rows=await db.assignment.findMany({where:{scope:'PADRAO',weekday},orderBy:[{room:'asc'},{shift:'asc'}]});const ids=rows.map(row=>row.id);const logs=ids.length?await db.audit.findMany({where:{assignmentId:{in:ids}},include:{user:{select:{name:true,username:true}}},orderBy:{createdAt:'desc'}}):[];const latest=new Map<string,any>();logs.forEach(log=>{if(log.assignmentId&&!latest.has(log.assignmentId))latest.set(log.assignmentId,log)});res.json({rows:rows.map(row=>({...row,lastEditedBy:latest.get(row.id)?.user?.name||null,lastEditedAt:latest.get(row.id)?.createdAt||row.updatedAt}))});});
app.put('/api/assignments/:id',auth,allow('ADMIN','EDITOR'),async(req,res)=>{const data=assignmentSchema.safeParse(req.body);if(!data.success)return res.status(400).json({error:'Dados inválidos.',details:data.error.flatten()});const old=await db.assignment.findUnique({where:{id:String(req.params.id)}});if(!old)return res.status(404).json({error:'Registro não encontrado.'});if(data.data.version!==old.version)return res.status(409).json({error:'Este turno foi alterado por outra pessoa. Atualize a tela antes de salvar.',current:old});const {version:_,...values}=data.data;const patch={...values,date:dateAt(values.date),updatedById:req.user!.id,version:{increment:1}} as any;const saved=await db.assignment.update({where:{id:old.id},data:patch});await audit(req.user!.id, data.data.professional||data.data.notes?'EDICAO':'LIMPEZA',saved,clean(old),clean(saved));res.json({row:saved});});
app.post('/api/assignments',auth,allow('ADMIN','EDITOR'),async(req,res)=>{const data=assignmentSchema.safeParse(req.body);if(!data.success)return res.status(400).json({error:'Dados inválidos.'});const d=data.data;const where={room:d.room,scope:d.scope,shift:d.shift,weekday:d.scope==='PADRAO'?d.weekday??0:undefined,date:d.scope==='DATA'?dateAt(d.date):undefined};let old=await db.assignment.findFirst({where});let saved;if(old){saved=await db.assignment.update({where:{id:old.id},data:{...d,date:dateAt(d.date),updatedById:req.user!.id,version:{increment:1}} as any});await audit(req.user!.id,'EDICAO',saved,clean(old),clean(saved));}else{saved=await db.assignment.create({data:{...d,date:dateAt(d.date),weekday:d.scope==='PADRAO'?d.weekday??0:null,updatedById:req.user!.id}} as any);await audit(req.user!.id,'CRIACAO',saved,null,clean(saved));}res.json({row:saved});});
app.get('/api/audits',auth,async(req,res)=>{const where:any={};if(req.query.room)where.room=Number(req.query.room);if(req.query.user)where.userId=String(req.query.user);if(req.query.shift)where.shift=req.query.shift;if(req.query.action)where.action=req.query.action;const rows=await db.audit.findMany({where,include:{user:{select:{name:true,username:true}}},orderBy:{createdAt:'desc'},take:250});res.json({rows});});
app.post('/api/audits/:id/restore',auth,allow('ADMIN'),async(req,res)=>{const log=await db.audit.findUnique({where:{id:String(req.params.id)}});if(!log?.assignmentId||!log.before)return res.status(400).json({error:'Este registro não pode ser restaurado.'});const current=await db.assignment.findUnique({where:{id:log.assignmentId}});if(!current)return res.status(404).json({error:'Turno removido.'});const saved=await db.assignment.update({where:{id:current.id},data:{...(log.before as object),updatedById:req.user!.id,version:{increment:1}} as any});await audit(req.user!.id,'RESTAURACAO',saved,clean(current),clean(saved));res.json({row:saved});});
app.get('/api/users',auth,allow('ADMIN'),async(_q,res)=>res.json({rows:await db.user.findMany({select:{id:true,name:true,username:true,role:true,active:true,createdAt:true},orderBy:{name:'asc'}})}));
app.post('/api/users',auth,allow('ADMIN'),async(req,res)=>{const d=z.object({name:z.string().min(2),username:z.string().min(3).regex(/^[a-zA-Z0-9._-]+$/),password:z.string().min(6),role:z.enum(roles)}).safeParse(req.body);if(!d.success)return res.status(400).json({error:'Informe nome, usuário válido e senha com pelo menos 6 caracteres.'});const username=d.data.username.toLowerCase();try{const u=await db.user.create({data:{name:d.data.name,username,email:`${username}@local`,role:d.data.role,passwordHash:await bcrypt.hash(d.data.password,12)}});res.status(201).json({row:{id:u.id,name:u.name,username:u.username,role:u.role,active:u.active}})}catch{return res.status(409).json({error:'Este usuário já existe.'})}});
app.patch('/api/users/:id',auth,allow('ADMIN'),async(req,res)=>{const d=z.object({name:z.string().min(2).optional(),role:z.enum(roles).optional(),active:z.boolean().optional(),password:z.string().min(6).optional()}).safeParse(req.body);if(!d.success)return res.status(400).json({error:'Dados inválidos.'});const data:any={...d.data};if(data.password){data.passwordHash=await bcrypt.hash(data.password,12);delete data.password}res.json({row:await db.user.update({where:{id:String(req.params.id)},data})});});
app.delete('/api/users/:id',auth,allow('ADMIN'),async(req,res)=>{const id=String(req.params.id);if(id===req.user!.id)return res.status(400).json({error:'Você não pode excluir a própria conta.'});await db.user.delete({where:{id}});res.status(204).end();});
app.post('/api/assignments/clear-row',auth,allow('EDITOR'),async(req,res)=>{const parsed=z.object({room:z.number().int().min(1).max(17),shift:z.enum(shifts)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Sala ou turno inválido.'});const rows=await db.assignment.findMany({where:{room:parsed.data.room,shift:parsed.data.shift,scope:'PADRAO'}});for(const old of rows){const saved=await db.assignment.update({where:{id:old.id},data:{status:'LIVRE',professional:null,code:null,specialty:null,operator:null,notes:null,rawText:null,needsReview:false,updatedById:req.user!.id,version:{increment:1}}});await audit(req.user!.id,'LIMPEZA',saved,clean(old),clean(saved));}res.json({ok:true,count:rows.length});});
app.post('/api/duplicate-week',auth,allow('ADMIN','EDITOR'),async(req,res)=>{const d=z.object({fromWeekday:z.number().int().min(0).max(5),toWeekday:z.number().int().min(0).max(5)}).parse(req.body);const source=await db.assignment.findMany({where:{scope:'PADRAO',weekday:d.fromWeekday}});await db.$transaction(source.map(a=>db.assignment.upsert({where:{room_weekday_scope_shift:{room:a.room,weekday:d.toWeekday,scope:'PADRAO',shift:a.shift}},update:{status:a.status,professional:a.professional,code:a.code,specialty:a.specialty,operator:a.operator,notes:a.notes,rawText:a.rawText,needsReview:a.needsReview,updatedById:req.user!.id,version:{increment:1}},create:{...clean(a),id:undefined,weekday:d.toWeekday,updatedById:req.user!.id}} as any)));res.json({ok:true});});
app.post('/api/import/preview',auth,allow('EDITOR'),upload.single('file'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'Selecione um arquivo PDF ou Word.'});try{const name=req.file.originalname.toLowerCase();if(name.endsWith('.docx'))return res.json({rows:parseRoomDocx(req.file.buffer),warning:'Revise os dados reconhecidos antes de confirmar.'});if(name.endsWith('.pdf')){const parsed=await pdfParse(req.file.buffer);const subject=String(parsed.info?.Subject||'');if(!subject.startsWith('MAPA_JSON:'))return res.status(400).json({error:'Este PDF não foi gerado pelo Mapa de Salas. Use um PDF exportado pelo próprio sistema.'});const rows=JSON.parse(Buffer.from(subject.slice(10),'base64').toString('utf8'));return res.json({rows,warning:'PDF reconhecido. Confira os registros antes de importar.'});}return res.status(400).json({error:'Formato não aceito. Envie PDF ou DOCX.'});}catch{return res.status(400).json({error:'Não foi possível ler este arquivo.'})}});
app.post('/api/import/confirm',auth,allow('EDITOR'),async(req,res)=>{const payload=z.array(assignmentSchema).max(300).safeParse(req.body.rows);if(!payload.success)return res.status(400).json({error:'Prévia de importação inválida.'});for(const d of payload.data){const old=await db.assignment.findFirst({where:{room:d.room,weekday:d.weekday??0,scope:'PADRAO',shift:d.shift}});if(old){const saved=await db.assignment.update({where:{id:old.id},data:{...d,date:null,updatedById:req.user!.id,version:{increment:1}} as any});await audit(req.user!.id,'IMPORTACAO',saved,clean(old),clean(saved));}}res.json({ok:true,count:payload.data.length})});
app.get('/api/export.pdf',auth,async(_req,res)=>{
  const rows=await db.assignment.findMany({where:{scope:'PADRAO'},orderBy:[{shift:'asc'},{room:'asc'},{weekday:'asc'}]});
  const exportRows=rows.map(({id,updatedAt,updatedById,...row})=>({...row,date:null}));
  const doc=new PDFDocument({size:'A4',layout:'landscape',margin:28,info:{Title:'Mapa de Salas - 3º piso',Subject:`MAPA_JSON:${Buffer.from(JSON.stringify(exportRows)).toString('base64')}`}});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename="mapa-de-salas.pdf"');
  doc.pipe(res);
  const dayNames=['SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
  for(const [pageIndex,shift] of shifts.entries()){
    if(pageIndex)doc.addPage();
    doc.fillColor('#15324b').fontSize(18).font('Helvetica-Bold').text('MAPA DE SALAS - 3º PISO',28,28);
    doc.fontSize(10).fillColor('#64748b').text(shift==='MANHA'?'MANHÃ':'TARDE',28,55);
    const left=28,top=72,rowH=25,roomW=54,colW=(doc.page.width-left*2-roomW)/6;
    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(left,top,roomW,rowH).fill('#15324b');
    doc.fillColor('white').text('SALA',left+5,top+10,{width:roomW-10,align:'center'});
    dayNames.forEach((day,i)=>{const x=left+roomW+i*colW;doc.rect(x,top,colW,rowH).fill('#15324b');doc.fillColor('white').text(day,x+3,top+10,{width:colW-6,align:'center'});});
    for(let room=1;room<=17;room++){
      const y=top+room*rowH;
      doc.rect(left,y,roomW,rowH).fill(room%2?'#eef4f7':'#e2edf2');
      doc.fillColor('#15324b').font('Helvetica-Bold').fontSize(8).text(String(room).padStart(2,'0'),left+4,y+8,{width:roomW-8,align:'center'});
      for(let day=0;day<6;day++){
        const x=left+roomW+day*colW;
        const item=rows.find(row=>row.room===room&&row.weekday===day&&row.shift===shift);
        doc.rect(x,y,colW,rowH).fillAndStroke(item?.status==='LIVRE'?'#f8fafc':'#edf9f3','#cbd5e1');
        const label=item?.status==='LIVRE'?'LIVRE':[item?.professional,item?.code,item?.specialty].filter(Boolean).join(' - ');
        doc.fillColor(item?.status==='LIVRE'?'#94a3b8':'#123b31').font(item?.status==='LIVRE'?'Helvetica':'Helvetica-Bold').fontSize(5.8).text(label||'LIVRE',x+3,y+4,{width:colW-6,height:rowH-6,align:'center',ellipsis:true});
      }
    }
    doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`,left,540,{width:doc.page.width-left*2,align:'right'});
  }
  doc.end();
});
app.get('/api/export.xlsx',auth,async(req,res)=>{const rows=await db.assignment.findMany({where:{scope:'PADRAO'},orderBy:[{weekday:'asc'},{room:'asc'},{shift:'asc'}]});const book=new ExcelJS.Workbook();const ws=book.addWorksheet('Mapa de Salas');ws.columns=[{header:'Dia',key:'day',width:14},{header:'Sala',key:'room',width:10},{header:'Turno',key:'shift',width:12},{header:'Status',key:'status',width:14},{header:'Profissional',key:'professional',width:30},{header:'Código',key:'code',width:14},{header:'Especialidade',key:'specialty',width:28},{header:'Operador',key:'operator',width:22},{header:'Observações',key:'notes',width:42}];const days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];rows.forEach(a=>ws.addRow({...a,day:days[a.weekday!],room:`Sala ${String(a.room).padStart(2,'0')}`,shift:a.shift==='MANHA'?'Manhã':'Tarde'}));ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF16324F'}};res.setHeader('Content-Disposition','attachment; filename="mapa-de-salas.xlsx"');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');await book.xlsx.write(res);res.end();});
app.use(express.static(path.join(process.cwd(),'src','public')));app.get('*',(_q,res)=>res.sendFile(path.join(process.cwd(),'src','public','index.html')));
ensureSeed().then(()=>app.listen(Number(process.env.PORT||3000),()=>console.log('Mapa de Salas iniciado'))).catch(e=>{console.error(e);process.exit(1)});
