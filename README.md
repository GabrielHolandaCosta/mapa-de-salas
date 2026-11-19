# Mapa de Salas

Aplicação web independente para as salas 01 a 17. Usa PostgreSQL, autenticação por sessão HTTP-only, funções por perfil e registros auditáveis.

## Recursos

- Painel por dia com 17 cartões, manhã e tarde, indicadores, pesquisa, filtros, impressão e Excel.
- Semana-padrão de segunda a sábado e exceções por data: uma exceção prevalece somente naquela data.
- Autosave com atraso de 650 ms, controle de versão e aviso de conflito para impedir perda silenciosa de alterações.
- Perfis: `ADMIN`, `EDITOR` e `VIEWER`; administração de usuários e histórico separados do mapa.
- Histórico com antes/depois, filtros no endpoint e restauração somente para administrador.
- Importação conservadora de `.docx`: lê somente Salas 01–17, exclui áreas especiais como entidades próprias e conserva a célula original em observações, marcada para revisão.

## Rodar localmente

1. Instale Node.js 20+ e PostgreSQL 15+.
2. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `JWT_SECRET` e as credenciais iniciais do administrador.
3. Na pasta do projeto, execute:

```powershell
npm install
npm run db:push
npm run db:seed
npm run dev
```

4. Abra `http://localhost:3000` e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados no `.env`.

## Importação do Word

Entre como administrador, abra **Administração > Importação**, envie o arquivo Word e confira a prévia. O aplicativo não altera o Word. Uma confirmação explícita grava os registros no banco e cria logs de importação.

O parser não assume campos incertos: mantém o texto integral de cada célula em observações; código e especialidade só são sugeridos quando identificáveis. A revisão é obrigatória (`needsReview`).

## Railway

1. Envie este repositório para GitHub e crie um projeto no Railway.
2. Adicione um serviço PostgreSQL e vincule `DATABASE_URL`.
3. Configure `JWT_SECRET` (valor longo aleatório), `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `NODE_ENV=production`.
4. O Railway usa `railway.toml`: aplica o esquema, semeia somente o primeiro administrador e inicia a aplicação.

Use HTTPS em produção; assim o cookie de sessão passa a ser `Secure` automaticamente.

## Observações de segurança

Senhas usam bcrypt. A sessão é assinada, expira em oito horas e fica em cookie HTTP-only. O login possui limitação de tentativas. Nunca versionar `.env`.
