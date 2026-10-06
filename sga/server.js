// =====================================================================
//  SGA - Sistema de Gestão Acadêmica | Faculdade do Bug Infinito (FBI)
//  Servidor da interface (Node.js + Express)
//
//  Toda a comunicação com o MySQL é feita SOMENTE por:
//    - CALL de Stored Procedures (cadastros, regras, login, relatórios)
//    - SELECT em Views (listagens)
//  Os nomes de procedures/views ficam fixos neste arquivo (lista branca) e
//  todos os valores vão como parâmetros (?), nunca concatenados no SQL.
// =====================================================================
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');

const COORD = 'Coordenador';
const SECR = 'Secretario';
const TODOS = [COORD, SECR];

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sga_fbi',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true,
});

const sha256 = (texto) => crypto.createHash('sha256').update(String(texto), 'utf8').digest('hex');

// Executa uma procedure e devolve o primeiro result set
async function chamar(procedure, params = []) {
  const marcadores = params.map(() => '?').join(', ');
  const [resultado] = await pool.query(`CALL ${procedure}(${marcadores})`, params);
  return Array.isArray(resultado) && Array.isArray(resultado[0]) ? resultado[0] : [];
}

// Consulta uma view (com filtro opcional por coluna)
async function consultarView(view, filtro) {
  if (filtro) {
    const [linhas] = await pool.query(`SELECT * FROM ${view} WHERE ?? = ?`, [filtro.coluna, filtro.valor]);
    return linhas;
  }
  const [linhas] = await pool.query(`SELECT * FROM ${view}`);
  return linhas;
}

// ---------------------------------------------------------------------
// Cadastros (CRUD) genéricos: view de listagem + procedures de escrita
// ---------------------------------------------------------------------
const vazioParaNull = (v) => (v === '' || v === undefined ? null : v);

const ENTIDADES = {
  usuarios: {
    view: 'vw_usuarios', id: 'id_usuario', ler: [COORD], escrever: [COORD],
    inserir: { sp: 'sp_usuario_inserir', campos: ['nome', 'cpf', 'email', 'login', 'senha', 'perfil'] },
    atualizar: { sp: 'sp_usuario_atualizar', campos: ['nome', 'cpf', 'email', 'login', 'senha', 'perfil'] },
    excluir: 'sp_usuario_excluir',
    // A senha nunca vai em texto puro para o banco: apenas o hash SHA-256
    transformar: { senha: (v) => (v ? sha256(v) : null) },
  },
  cursos: {
    view: 'vw_cursos', id: 'id_curso', ler: TODOS, escrever: [COORD],
    inserir: { sp: 'sp_curso_inserir', campos: ['nome', 'carga_horaria_total', 'turno', 'valor_mensalidade'] },
    atualizar: { sp: 'sp_curso_atualizar', campos: ['nome', 'carga_horaria_total', 'turno', 'valor_mensalidade'] },
    excluir: 'sp_curso_excluir',
  },
  disciplinas: {
    view: 'vw_disciplinas', id: 'id_disciplina', ler: TODOS, escrever: [COORD],
    inserir: { sp: 'sp_disciplina_inserir', campos: ['id_curso', 'nome', 'carga_horaria', 'periodo'] },
    atualizar: { sp: 'sp_disciplina_atualizar', campos: ['id_curso', 'nome', 'carga_horaria', 'periodo'] },
    excluir: 'sp_disciplina_excluir',
  },
  professores: {
    view: 'vw_professores', id: 'id_professor', ler: [COORD], escrever: [COORD],
    inserir: { sp: 'sp_professor_inserir', campos: ['nome', 'cpf', 'email', 'titulacao', 'data_admissao'] },
    atualizar: { sp: 'sp_professor_atualizar', campos: ['nome', 'cpf', 'email', 'titulacao', 'data_admissao'] },
    excluir: 'sp_professor_excluir',
  },
  alunos: {
    view: 'vw_alunos', id: 'id_aluno', ler: TODOS, escrever: TODOS,
    inserir: { sp: 'sp_aluno_inserir', campos: ['ra', 'nome', 'cpf', 'email', 'data_nascimento', 'id_curso', 'status'] },
    atualizar: { sp: 'sp_aluno_atualizar', campos: ['ra', 'nome', 'cpf', 'email', 'data_nascimento', 'id_curso', 'status'] },
    excluir: 'sp_aluno_excluir',
  },
  turmas: {
    view: 'vw_turmas', id: 'id_turma', ler: TODOS, escrever: [COORD],
    inserir: { sp: 'sp_turma_inserir', campos: ['id_disciplina', 'id_professor', 'semestre', 'vagas', 'total_aulas'] },
    atualizar: { sp: 'sp_turma_atualizar', campos: ['id_disciplina', 'id_professor', 'semestre', 'vagas', 'total_aulas'] },
    excluir: 'sp_turma_excluir',
  },
};

function valoresDoCorpo(cfg, campos, corpo) {
  return campos.map((campo) => {
    const valor = vazioParaNull(corpo[campo]);
    const fn = cfg.transformar && cfg.transformar[campo];
    return fn ? fn(valor) : valor;
  });
}

// ---------------------------------------------------------------------
// Aplicação
// ---------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

// Encapsula handlers assíncronos e padroniza erros do MySQL
const rota = (fn) => (req, res) => fn(req, res).catch((erro) => tratarErro(erro, res));

function tratarErro(erro, res) {
  switch (erro.errno) {
    case 1644: // SIGNAL SQLSTATE '45000' das procedures/triggers
      return res.status(400).json({ erro: erro.sqlMessage });
    case 3819: // CHECK constraint
      return res.status(400).json({ erro: `Valor fora do permitido (${erro.sqlMessage})` });
    case 1062: // UNIQUE
      return res.status(409).json({ erro: `Registro duplicado: ${erro.sqlMessage}` });
    case 1451: case 1452: // FOREIGN KEY
      return res.status(400).json({ erro: 'Operação viola um relacionamento entre registros.' });
    case 1048: case 1366: case 1292: case 1406:
      return res.status(400).json({ erro: `Dados inválidos: ${erro.sqlMessage}` });
    default:
      console.error(erro);
      return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

// Controle de acesso por perfil
const exigirPerfil = (perfis) => (req, res, next) => {
  const usuario = req.session.usuario;
  if (!usuario) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  if (!perfis.includes(usuario.perfil)) {
    return res.status(403).json({ erro: `Acesso negado para o perfil ${usuario.perfil}.` });
  }
  next();
};
const idUsuario = (req) => req.session.usuario.id_usuario;

// ------------------------------ Autenticação ------------------------------
app.post('/api/login', rota(async (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ erro: 'Informe login e senha.' });
  const [usuario] = await chamar('sp_LoginUsuario', [login, sha256(senha)]);
  if (!usuario) return res.status(401).json({ erro: 'Login ou senha inválidos.' });
  req.session.regenerate((erro) => {
    if (erro) return tratarErro(erro, res);
    req.session.usuario = usuario;
    res.json(usuario);
  });
}));

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado.' });
  res.json(req.session.usuario);
});

// ------------------------------ CRUD genérico ------------------------------
for (const [nome, cfg] of Object.entries(ENTIDADES)) {
  app.get(`/api/${nome}`, exigirPerfil(cfg.ler), rota(async (req, res) => {
    res.json(await consultarView(cfg.view));
  }));

  app.post(`/api/${nome}`, exigirPerfil(cfg.escrever), rota(async (req, res) => {
    const valores = valoresDoCorpo(cfg, cfg.inserir.campos, req.body || {});
    const [linha] = await chamar(cfg.inserir.sp, [idUsuario(req), ...valores]);
    res.status(201).json(linha || {});
  }));

  app.put(`/api/${nome}/:id`, exigirPerfil(cfg.escrever), rota(async (req, res) => {
    const valores = valoresDoCorpo(cfg, cfg.atualizar.campos, req.body || {});
    const [linha] = await chamar(cfg.atualizar.sp, [idUsuario(req), Number(req.params.id), ...valores]);
    res.json(linha || {});
  }));

  app.delete(`/api/${nome}/:id`, exigirPerfil(cfg.escrever), rota(async (req, res) => {
    const [linha] = await chamar(cfg.excluir, [idUsuario(req), Number(req.params.id)]);
    res.json(linha || {});
  }));
}

// ------------------------------ Pré-requisitos ------------------------------
app.get('/api/prerequisitos', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json(await consultarView('vw_pre_requisitos'));
}));
app.post('/api/prerequisitos', exigirPerfil([COORD]), rota(async (req, res) => {
  const { id_disciplina, id_disciplina_requisito } = req.body || {};
  res.status(201).json((await chamar('sp_prerequisito_inserir',
    [idUsuario(req), vazioParaNull(id_disciplina), vazioParaNull(id_disciplina_requisito)]))[0] || {});
}));
app.delete('/api/prerequisitos/:id/:req', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json((await chamar('sp_prerequisito_excluir',
    [idUsuario(req), Number(req.params.id), Number(req.params.req)]))[0] || {});
}));

// ------------------------------ Matrículas ------------------------------
app.get('/api/matriculas', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json(await consultarView('vw_matriculas'));
}));
app.post('/api/matriculas', exigirPerfil(TODOS), rota(async (req, res) => {
  const { id_aluno, id_turma } = req.body || {};
  const [linha] = await chamar('sp_matricular_aluno',
    [vazioParaNull(id_aluno), vazioParaNull(id_turma), idUsuario(req)]);
  res.status(201).json(linha || {});
}));
app.delete('/api/matriculas/:id', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json((await chamar('sp_matricula_cancelar', [idUsuario(req), Number(req.params.id)]))[0] || {});
}));
app.post('/api/matriculas/:id/notas', exigirPerfil([COORD]), rota(async (req, res) => {
  const { n1, n2, faltas } = req.body || {};
  res.json((await chamar('sp_lancar_notas', [Number(req.params.id),
    vazioParaNull(n1), vazioParaNull(n2), vazioParaNull(faltas) ?? 0, idUsuario(req)]))[0] || {});
}));
app.post('/api/matriculas/:id/exame', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json((await chamar('sp_lancar_exame',
    [Number(req.params.id), vazioParaNull((req.body || {}).exame), idUsuario(req)]))[0] || {});
}));

// ------------------------------ Relatórios ------------------------------
app.get('/api/relatorios/boletim/:idAluno', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json(await consultarView('vw_boletim', { coluna: 'id_aluno', valor: Number(req.params.idAluno) }));
}));
app.get('/api/relatorios/historico/:idAluno', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json(await chamar('sp_historico_aluno', [Number(req.params.idAluno)]));
}));
app.get('/api/relatorios/lotacao', exigirPerfil(TODOS), rota(async (req, res) => {
  res.json(await consultarView('vw_turmas_lotacao'));
}));
app.get('/api/relatorios/desempenho', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json(await consultarView('vw_desempenho_turma'));
}));
app.get('/api/relatorios/faturamento', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json(await consultarView('vw_faturamento_curso'));
}));
app.get('/api/relatorios/auditoria', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json(await consultarView('vw_log_nota'));
}));
app.post('/api/semestre/fechar', exigirPerfil([COORD]), rota(async (req, res) => {
  res.json((await chamar('sp_fechar_semestre', [vazioParaNull((req.body || {}).semestre), idUsuario(req)]))[0] || {});
}));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

const PORTA = Number(process.env.PORT || 3000);
app.listen(PORTA, () => console.log(`SGA FBI rodando em http://localhost:${PORTA}`));
