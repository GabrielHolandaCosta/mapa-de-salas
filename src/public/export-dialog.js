export function setupExportDialog(getUnit) {
  const dialog = document.createElement('dialog');
  dialog.className = 'export-dialog';
  dialog.setAttribute('aria-labelledby', 'exportDialogTitle');
  dialog.setAttribute('aria-describedby', 'exportDialogDescription');
  dialog.innerHTML = `<form class="export-dialog-form">
    <header class="export-dialog-head"><div><p class="export-dialog-kicker">EXPORTAR MAPA</p><h2 id="exportDialogTitle">O que você deseja exportar?</h2><p id="exportDialogDescription">Escolha o conteúdo que deseja incluir no arquivo.</p></div><button class="export-dialog-close" type="button" aria-label="Fechar janela">×</button></header>
    <div class="export-context"><span>Unidade <strong data-export-unit></strong></span><span>Formato <strong data-export-format></strong></span></div>
    <fieldset class="export-choices"><legend>Escolha uma opção</legend>
      <label class="export-option"><input type="radio" name="selection" value="rooms_morning"><span><strong>Salas · manhã</strong><small>Salas 01 a 17 no turno da manhã</small></span></label>
      <label class="export-option"><input type="radio" name="selection" value="rooms_afternoon"><span><strong>Salas · tarde</strong><small>Salas 01 a 17 no turno da tarde</small></span></label>
      <label class="export-option"><input type="radio" name="selection" value="rooms_both"><span><strong>Salas · manhã e tarde</strong><small>Os dois turnos das salas 01 a 17</small></span></label>
      <label class="export-option"><input type="radio" name="selection" value="services"><span><strong>Somente serviços especiais</strong><small>Serviços especiais de manhã e à tarde</small></span></label>
      <label class="export-option"><input type="radio" name="selection" value="all" checked><span><strong>Mapa completo</strong><small>Salas e serviços especiais, nos dois turnos</small></span></label>
    </fieldset>
    <footer class="export-dialog-actions"><button class="export-dialog-cancel" type="button">Cancelar</button><button class="export-dialog-submit" type="submit">Baixar arquivo</button></footer>
  </form>`;
  document.body.append(dialog);
  let format = 'docx';
  let unit = 'MANGABEIRAS';
  const close = () => dialog.close();
  dialog.querySelector('.export-dialog-close').addEventListener('click', close);
  dialog.querySelector('.export-dialog-cancel').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  document.querySelectorAll('a[href^="/api/export."]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      format = link.getAttribute('href').includes('.xlsx') ? 'xlsx' : 'docx';
      unit = getUnit();
      dialog.querySelector('[data-export-unit]').textContent = unit === 'GRUTA' ? 'Gruta' : 'Mangabeiras · 3º piso';
      dialog.querySelector('[data-export-format]').textContent = format === 'docx' ? 'Word' : 'Excel';
      dialog.querySelector('.export-dialog-submit').textContent = `Baixar ${format === 'docx' ? 'Word' : 'Excel'}`;
      dialog.showModal();
      dialog.querySelector('input:checked').focus();
    });
  });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const selection = dialog.querySelector('input[name="selection"]:checked')?.value;
    if (!selection) return;
    const query = new URLSearchParams({unit, selection});
    const download = document.createElement('a');
    download.href = `/api/export.${format}?${query}`;
    download.hidden = true;
    document.body.append(download);
    download.click();
    download.remove();
    close();
  });
}
