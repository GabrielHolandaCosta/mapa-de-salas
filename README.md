# Mapa de Salas

Aplicação web independente para os mapas de salas de Mangabeiras e Gruta. Usa banco local SQLite, autenticação por sessão HTTP-only, funções por perfil e registros auditáveis. O mapa de Mangabeiras corresponde ao 3º piso.

## Recursos

- Grade semanal com as salas 01 a 17 nas linhas e segunda a sábado nas colunas, separada por manhã e tarde.
- Tela independente para ECO, MAPA/Holter, ECG, teste ergométrico/espirometria e EEG.
- Layout próprio para celular, pesquisa, tema escuro, impressão e estados visuais para livre, ocupada, reservada e fechada.
- Identificação textual e por cores dos estados, com destaques próprios para secretária e atendimentos a cada 15 dias.
- Exportação em Word e Excel por unidade, com escolha entre turnos das salas, serviços especiais ou mapa completo.
- Importação conservadora de `.docx`: lê as salas 01–17 e os serviços especiais, conservando o conteúdo original para revisão.
- Perfis separados: `ADMIN` gerencia contas e também pode editar o mapa e consultar o histórico, `EDITOR` altera o mapa e `VIEWER` consulta o mapa e o histórico.
- O administrador define as unidades disponíveis para cada pessoa. Cada mapa, seu histórico e suas exportações são independentes. As contas existentes mantêm acesso a Mangabeiras; a Gruta começa vazia.
- Confirmação antes de limpar uma célula, uma linha inteira ou excluir um usuário.

## Rodar localmente

1. Instale o Node.js 20 ou superior.
2. Dê dois cliques em `INICIAR_MAPA_DE_SALAS.bat`. Na primeira abertura, ele cria a configuração e o banco automaticamente.

Se preferir iniciar pelo terminal, execute:

```powershell
npm install
npm run db:push
npm run db:seed
npm run dev
```

3. Abra `http://localhost:3000` e entre com `ADMIN_USER` e `ADMIN_PASSWORD` configurados no `.env`.

Para testes, os valores padrão são usuário `admin` e senha `123456`. Troque a senha antes de publicar o sistema.

## Importação de Word ou Excel

Entre com uma conta de editor, clique em **Importar Word/Excel** e confira a quantidade reconhecida antes de confirmar. São aceitos arquivos Word `.docx` no formato do mapa e planilhas Excel `.xlsx` exportadas pelo próprio sistema.

O parser não assume campos incertos: mantém o texto integral de cada célula em observações; código e especialidade só são sugeridos quando identificáveis. A revisão é obrigatória (`needsReview`).

O documento de 2026 foi validado com 219 registros reconhecidos, cobrindo as salas 01 a 17 e os cinco serviços especiais. Para repetir a verificação:

```powershell
npm run verify:word -- "C:\Users\gabrielcosta\Desktop\MAPA DE SALAS 3 PISO -NOVO - 2026 - para mesclagem.docx"
```

## Railway

1. Envie este repositório para GitHub e crie um projeto no Railway.
2. Adicione um Volume persistente ao serviço, montado em `/data`.
3. Configure `DATABASE_URL=file:/data/mapa-de-salas.db`, `JWT_SECRET` (valor longo aleatório), `ADMIN_NAME`, `ADMIN_USER`, `ADMIN_PASSWORD` e `NODE_ENV=production`.
4. O Railway usa `railway.toml`: atualiza a estrutura do banco no volume, preenche dados iniciais sem substituir registros existentes e inicia a aplicação. Faça um backup do volume antes de atualizações que alterem a estrutura do banco.

Use HTTPS em produção; assim o cookie de sessão passa a ser `Secure` automaticamente.

## Observações de segurança

Senhas usam bcrypt. A sessão é assinada, expira em oito horas e fica em cookie HTTP-only. O login possui limitação de tentativas. Nunca versionar `.env`.
