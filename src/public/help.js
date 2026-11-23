const viewerSlides=[
  {title:'Entenda o mapa em segundos',text:'Cada linha representa uma sala e cada coluna um dia da semana. As cores mostram a situação sem precisar abrir o registro.',tips:['Verde: livre','Azul: ocupada','Laranja: reservada','Roxo: fechada'],visual:'map'},
  {title:'Encontre qualquer informação',text:'Use a busca para localizar uma sala, profissional ou especialidade. Você pode escrever “Sala 2” ou “Sala 02”.',tips:['A busca filtra na hora','Troque entre Salas 01–17 e Serviços especiais','Escolha Manhã ou Tarde nas salas'],visual:'search'},
  {title:'Consulte todos os detalhes',text:'Clique em uma célula para ver profissional, matrícula, especialidade, responsável e observações. Como visualizador, os campos ficam protegidos.',tips:['Nada é alterado por engano','Os destaques Secretária e 15 dias aparecem na grade','Feche a janela pelo ×'],visual:'details'},
  {title:'Veja quem fez cada mudança',text:'O botão de histórico mostra as alterações mais recentes, com pessoa, sala, turno e horário.',tips:['Use o ícone de histórico no topo','O histórico é exclusivo do Visualizador','Os registros ficam organizados do mais recente'],visual:'history'},
  {title:'Exporte e personalize',text:'Baixe o mapa em Word ou Excel, imprima quando precisar e alterne entre tema claro e escuro.',tips:['Word e Excel mantêm manhã e tarde organizadas','O botão Ajuda fica sempre disponível','Você já pode começar'],visual:'finish'}
];

const editorSlides=[
  {title:'Conheça sua área de trabalho',text:'O mapa organiza as Salas 01–17 por turno e dia. Serviços especiais ficam em uma seção própria, sem seleção de manhã ou tarde.',tips:['Escolha Manhã ou Tarde','Troque de área pelos botões superiores','As cores mostram o status de cada célula'],visual:'map'},
  {title:'Preencha uma sala',text:'Clique na célula do dia correto. A janela de edição abre com todos os campos necessários, pronta para preencher.',tips:['Escolha o status','Informe profissional, matrícula e especialidade','Adicione responsável e observações quando necessário'],visual:'edit'},
  {title:'Use os destaques corretamente',text:'Marque Secretária ou 15 dias para criar os avisos visuais na célula. Ao salvar, a grade é atualizada imediatamente.',tips:['Secretária aparece em vermelho','15 dias aparece em amarelo','Observações também ficam visíveis na grade'],visual:'flags'},
  {title:'Altere com segurança',text:'Ao deixar uma sala Livre, limpar uma célula ou apagar uma linha, o sistema pede confirmação antes de remover os dados.',tips:['Leia a confirmação antes de continuar','Cancelar mantém tudo como estava','O histórico da alteração é preservado'],visual:'safe'},
  {title:'Importe, exporte e encontre',text:'Use a busca para localizar dados, importe mapas em Word ou Excel e exporte o resultado final quando quiser.',tips:['Revise a prévia antes de importar','Exporte em Word ou Excel','O botão Ajuda permite rever este guia'],visual:'finish'}
];

let initialized=false,user=null,slides=[],index=0,dialog,visual,title,text,tips,step,dots,previous,next;

const seenKey=account=>`mapa-help-seen:${account.id||account.username}`;
function wasSeen(account){
  if(account.helpSeen)return true;
  try{return localStorage.getItem(seenKey(account))==='1'}catch{return false}
}
async function markAsSeen(){
  if(!user||user.helpSeen)return;
  user.helpSeen=true;
  try{localStorage.setItem(seenKey(user),'1')}catch{}
  try{
    const response=await fetch('/api/help/seen',{method:'PUT',credentials:'same-origin'});
    if(!response.ok)throw new Error('Não foi possível registrar a ajuda como visualizada.');
  }catch(error){
    console.warn(error);
  }
}

function visualMarkup(kind){
  if(kind==='search')return `<div class="help-shot"><div class="shot-tabs"><b>Salas 01–17</b><span>Serviços especiais</span></div><div class="shot-search"><i>⌕</i><strong>Sala 02</strong></div><div class="shot-result"><small>SALA</small><b>02</b><span>Encontrada</span></div><i class="help-arrow arrow-search">➜</i></div>`;
  if(kind==='details')return `<div class="help-shot"><div class="shot-modal"><small>TURNO DA MANHÃ</small><h4>Sala 03 · Segunda</h4><label>Status <span>Ocupada</span></label><label>Profissional <span>Joyce Lisboa</span></label><label>Especialidade <span>Onco-Geneticista</span></label></div><i class="help-arrow arrow-cell">➜</i></div>`;
  if(kind==='history')return `<div class="help-shot"><div class="shot-top"><b>Mapa de Salas</b><span class="shot-history">▤</span></div><aside class="shot-drawer"><small>RASTREABILIDADE</small><h4>Histórico de alterações</h4><p><b>Sala 03</b><span>Atualizada por Maria · agora</span></p><p><b>Sala 08</b><span>Atualizada por João · 10:42</span></p></aside><i class="help-arrow arrow-history">➜</i></div>`;
  if(kind==='edit')return `<div class="help-shot"><div class="shot-grid"><span>SALA 01</span><button>Livre<small>Clique para preencher</small></button><button class="occupied">Dra. Fernanda<small>(Oncologista)</small></button></div><div class="shot-form"><label>Profissional <span>Nome do profissional</span></label><label>Especialidade <span>Ex.: Oncologista</span></label><button>Salvar alteração</button></div><i class="help-arrow arrow-edit">➜</i></div>`;
  if(kind==='flags')return `<div class="help-shot"><div class="shot-flags"><label><i>✓</i><b>Tem secretária</b><small>Mostra o destaque vermelho</small></label><label><i>✓</i><b>Atende a cada 15 dias</b><small>Mostra o destaque amarelo</small></label></div><div class="shot-cell"><small>OCUPADA</small><b>Dr. Joaquim</b><span class="red">Secretária</span><span class="yellow">15 dias</span><em>Observação importante</em></div><i class="help-arrow arrow-flags">➜</i></div>`;
  if(kind==='safe')return `<div class="help-shot"><div class="shot-confirm"><span>!</span><div><small>ALTERAR STATUS</small><h4>Deixar Sala 01 livre?</h4><p>Os dados serão apagados após sua confirmação.</p></div><div class="shot-confirm-actions"><button>Cancelar</button><button class="danger">Deixar livre</button></div></div></div>`;
  if(kind==='finish')return `<div class="help-shot"><div class="shot-actions"><span>⌕ Buscar profissional...</span>${user?.role==='EDITOR'?'<button>↑ Importar Word/Excel</button>':''}<button>↓ Word</button><button>↓ Excel</button></div><div class="shot-theme">☀</div><div class="shot-help">? <b>Ajuda</b></div><i class="help-arrow arrow-help">➜</i></div>`;
  return `<div class="help-shot"><div class="shot-tabs"><b>Salas 01–17</b><span>Serviços especiais</span></div><div class="shot-shifts"><b>☀ Manhã</b><span>◒ Tarde</span></div><div class="shot-table"><strong>SALA</strong><strong>SEGUNDA</strong><strong>TERÇA</strong><b>01</b><span class="free">Livre</span><span class="occupied">Dra. Fernanda</span><b>02</b><span class="reserved">Reservada</span><span class="closed">Fechada</span></div><i class="help-arrow arrow-map">➜</i></div>`;
}

function render(){const slide=slides[index];visual.innerHTML=visualMarkup(slide.visual);title.textContent=slide.title;text.textContent=slide.text;tips.innerHTML=slide.tips.map(item=>`<li>${item}</li>`).join('');step.textContent=`PASSO ${index+1} DE ${slides.length}`;dots.innerHTML=slides.map((_,position)=>`<button type="button" class="${position===index?'active':''}" aria-label="Ir para o passo ${position+1}" data-help-step="${position}"></button>`).join('');dots.querySelectorAll('button').forEach(button=>button.onclick=()=>{index=Number(button.dataset.helpStep);render()});previous.disabled=index===0;next.textContent=index===slides.length-1?'Começar a usar':'Próximo'}

function open(auto=false){if(!user||user.role==='ADMIN'||dialog.open)return;slides=user.role==='EDITOR'?editorSlides:viewerSlides;index=0;dialog.dataset.role=user.role.toLowerCase();render();dialog.showModal();if(auto)void markAsSeen()}

function build(){if(initialized)return;initialized=true;const link=document.createElement('link');link.rel='stylesheet';link.href='/help.css?v=1';document.head.append(link);const button=document.createElement('button');button.id='helpButton';button.className='help-button';button.type='button';button.title='Abrir guia de ajuda';button.setAttribute('aria-label','Abrir guia de ajuda');button.innerHTML='<span aria-hidden="true">?</span><b>Ajuda</b>';document.querySelector('#workspace .top-actions #theme').before(button);dialog=document.createElement('dialog');dialog.className='help-dialog';dialog.innerHTML=`<div class="help-shell"><header class="help-head"><div><p class="overline">GUIA INTERATIVO</p><h2>Aprenda o essencial</h2></div><button class="help-close" type="button" aria-label="Fechar ajuda">×</button></header><div class="help-body"><div class="help-visual"></div><section class="help-copy"><span class="help-step"></span><h3></h3><p></p><ul></ul></section></div><footer class="help-footer"><div class="help-dots"></div><div class="help-actions"><button class="ghost-button help-previous" type="button">Voltar</button><button class="primary help-next" type="button">Próximo</button></div></footer></div>`;document.body.append(dialog);visual=dialog.querySelector('.help-visual');title=dialog.querySelector('.help-copy h3');text=dialog.querySelector('.help-copy>p');tips=dialog.querySelector('.help-copy ul');step=dialog.querySelector('.help-step');dots=dialog.querySelector('.help-dots');previous=dialog.querySelector('.help-previous');next=dialog.querySelector('.help-next');button.onclick=()=>open(false);dialog.querySelector('.help-close').onclick=()=>dialog.close();previous.onclick=()=>{if(index>0){index--;render()}};next.onclick=()=>{if(index===slides.length-1){dialog.close();return}index++;render()};dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})}

export function setupHelp(account){user=account;build();document.querySelector('link[href^="/help.css"]')?.setAttribute('href','/help.css?v=4');if(account.role!=='ADMIN'&&!wasSeen(account))setTimeout(()=>{if(user===account&&!wasSeen(account))open(true)},450)}
