// =====================================================================
//  SGA - Backend SIMULADO para a demonstração online (sem MySQL).
//  Reproduz no navegador as mesmas regras das procedures, triggers e views
//  de database/02_programacao.sql, com a massa de dados de 03_dados.sql.
//  Os dados ficam só na memória: recarregar a página restaura o estado inicial.
// =====================================================================
const MOCK = (() => {
  const COORD = 'Coordenador';
  const TODOS = ['Coordenador', 'Secretario'];
  const SENHA_PADRAO = 'fbi@2026';

  class ErroSQL extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
  const sinal = (msg) => { throw new ErroSQL(msg); };

  // ------------------------------ Massa de dados ------------------------------
  const db = {
    usuario: [
      [1, 'Ana Paula Ribeiro', '11122233344', 'ana.ribeiro@fbi.edu.br', 'ana.coord', COORD],
      [2, 'Carlos Eduardo Lima', '22233344455', 'carlos.lima@fbi.edu.br', 'carlos.coord', COORD],
      [3, 'Beatriz Souza', '33344455566', 'beatriz.souza@fbi.edu.br', 'beatriz.sec', 'Secretario'],
      [4, 'Diego Martins', '44455566677', 'diego.martins@fbi.edu.br', 'diego.sec', 'Secretario'],
      [5, 'Elisa Fernandes', '55566677788', 'elisa.fernandes@fbi.edu.br', 'elisa.sec', 'Secretario'],
    ].map(([id_usuario, nome, cpf, email, login, perfil]) => ({ id_usuario, nome, cpf, email, login, perfil, senha: SENHA_PADRAO })),
    curso: [
      [1, 'Sistemas de Informação', 3000, 'Noturno', 890],
      [2, 'Ciências Contábeis', 3000, 'Matutino', 750],
      [3, 'Enfermagem', 4000, 'Vespertino', 1250],
    ].map(([id_curso, nome, carga_horaria_total, turno, valor_mensalidade]) => ({ id_curso, nome, carga_horaria_total, turno, valor_mensalidade })),
    disciplina: [
      [1, 1, 'Algoritmos e Lógica de Programação', 80, 1],
      [2, 1, 'Estruturas de Dados', 80, 2],
      [3, 1, 'Banco de Dados I', 80, 2],
      [4, 1, 'Banco de Dados II', 80, 3],
      [5, 2, 'Contabilidade Geral', 60, 1],
      [6, 3, 'Anatomia Humana', 60, 1],
    ].map(([id_disciplina, id_curso, nome, carga_horaria, periodo]) => ({ id_disciplina, id_curso, nome, carga_horaria, periodo })),
    pre_requisito: [{ id_disciplina: 2, id_disciplina_requisito: 1 }, { id_disciplina: 4, id_disciplina_requisito: 3 }],
    professor: [
      [1, 'Roberto Almeida', '60011122233', 'roberto.almeida@fbi.edu.br', 'Doutor', '2015-02-01'],
      [2, 'Juliana Castro', '60022233344', 'juliana.castro@fbi.edu.br', 'Mestre', '2018-08-01'],
      [3, 'Marcos Vinícius', '60033344455', 'marcos.vinicius@fbi.edu.br', 'Mestre', '2019-02-01'],
      [4, 'Patrícia Gomes', '60044455566', 'patricia.gomes@fbi.edu.br', 'Especialista', '2020-08-01'],
      [5, 'Fernando Teixeira', '60055566677', 'fernando.teixeira@fbi.edu.br', 'Doutor', '2012-03-01'],
    ].map(([id_professor, nome, cpf, email, titulacao, data_admissao]) => ({ id_professor, nome, cpf, email, titulacao, data_admissao })),
    aluno: [
      ['2025001', 'Lucas Oliveira', '2005-03-12', 1], ['2025002', 'Mariana Santos', '2004-07-22', 1],
      ['2025003', 'Pedro Henrique Costa', '2005-01-05', 1], ['2025004', 'Gabriela Rocha', '2003-11-30', 1],
      ['2025005', 'Rafael Pereira', '2004-05-18', 1], ['2025006', 'Camila Barbosa', '2005-09-09', 1],
      ['2025007', 'Thiago Mendes', '2004-02-14', 1], ['2025008', 'Larissa Cardoso', '2005-06-25', 1],
      ['2025009', 'Bruno Araújo', '2003-10-01', 1], ['2025010', 'Isabela Freitas', '2004-12-19', 1],
      ['2026001', 'Gustavo Nunes', '2006-04-03', 1], ['2026002', 'Fernanda Moreira', '2005-08-27', 1, 'Trancado'],
      ['2026003', 'Vinícius Ramos', '2006-01-15', 2], ['2026004', 'Amanda Correia', '2005-03-08', 2],
      ['2026005', 'Felipe Duarte', '2004-09-21', 2], ['2026006', 'Juliana Pires', '2006-07-11', 2],
      ['2026007', 'Rodrigo Batista', '2005-05-29', 2], ['2026008', 'Letícia Monteiro', '2006-02-02', 3],
      ['2026009', 'Matheus Carvalho', '2005-10-17', 3], ['2026010', 'Beatriz Lopes', '2006-12-06', 3],
    ].map(([ra, nome, data_nascimento, id_curso, status], i) => ({
      id_aluno: i + 1, ra, nome, cpf: `700000000${String(i + 1).padStart(2, '0')}`,
      email: `${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ').filter((_, k, arr) => k === 0 || k === arr.length - 1).join('.')}@aluno.fbi.edu.br`,
      data_nascimento, id_curso, status: status || 'Ativo',
    })),
    turma: [
      [1, 1, 1, '2025.2', 10, 40, 'Aberta'], [2, 3, 2, '2026.2', 12, 40, 'Aberta'], [3, 2, 3, '2026.2', 10, 40, 'Aberta'],
      [4, 5, 4, '2026.2', 8, 60, 'Aberta'], [5, 6, 5, '2026.2', 3, 60, 'Aberta'],
    ].map(([id_turma, id_disciplina, id_professor, semestre, vagas, total_aulas, status]) => ({ id_turma, id_disciplina, id_professor, semestre, vagas, total_aulas, status })),
    matricula: [],
    log_nota: [],
  };
  const seq = { usuario: 5, curso: 3, disciplina: 6, professor: 5, aluno: 20, turma: 5, matricula: 0, log_nota: 0 };

  // ------------------------------ Functions (fn_*) ------------------------------
  const r2 = (v) => Math.round(v * 100) / 100;
  const fnCalcularMedia = (n1, n2, exame) => {
    if (n1 === null || n2 === null) return null;
    const parcial = (n1 + n2) / 2;
    if (exame === null || parcial >= 7 || parcial < 4) return r2(parcial);
    return r2((parcial + exame) / 2);
  };
  const fnFrequencia = (total, faltas) => r2(((total - (faltas || 0)) / total) * 100);
  const fnSituacao = (n1, n2, exame, faltas, total) => {
    if (n1 === null || n2 === null) return 'Cursando';
    if (fnFrequencia(total, faltas) < 75) return 'Reprovado por Falta';
    const parcial = (n1 + n2) / 2;
    if (parcial >= 7) return 'Aprovado';
    if (parcial < 4) return 'Reprovado por Nota';
    if (exame === null) return 'Em Exame';
    return fnCalcularMedia(n1, n2, exame) >= 5 ? 'Aprovado' : 'Reprovado por Nota';
  };
  const turmaDe = (id) => db.turma.find((t) => t.id_turma === id);
  const disciplinaDe = (id) => db.disciplina.find((d) => d.id_disciplina === id);
  const fnCr = (idAluno) => {
    let soma = 0; let ch = 0;
    for (const m of db.matricula) {
      if (m.id_aluno !== idAluno || m.media_final === null) continue;
      if (!['Aprovado', 'Reprovado por Nota', 'Reprovado por Falta'].includes(m.situacao)) continue;
      const d = disciplinaDe(turmaDe(m.id_turma).id_disciplina);
      soma += m.media_final * d.carga_horaria; ch += d.carga_horaria;
    }
    return ch ? r2(soma / ch) : null;
  };

  // ------------------------------ Triggers ------------------------------
  let usuarioSessao = null; // @sga_usuario
  const checarNotas = (m) => {
    for (const c of ['n1', 'n2', 'exame']) {
      if (m[c] !== null && (m[c] < 0 || m[c] > 10)) sinal(`Valor fora do permitido (Check constraint 'ck_matricula_${c}' is violated.)`);
    }
  };
  function inserirMatricula(dados) {
    const t = turmaDe(dados.id_turma);
    if (db.matricula.filter((m) => m.id_turma === t.id_turma).length >= t.vagas) sinal('RN05: Turma lotada. Limite maximo de vagas atingido.'); // trg_valida_vagas
    const m = { n1: null, n2: null, exame: null, faltas: 0, data_matricula: agora(), ...dados, id_matricula: ++seq.matricula };
    checarNotas(m);
    m.media_final = fnCalcularMedia(m.n1, m.n2, m.exame); // trg_situacao_insert
    m.situacao = fnSituacao(m.n1, m.n2, m.exame, m.faltas, t.total_aulas);
    db.matricula.push(m);
    return m;
  }
  function atualizarMatricula(m, novos) {
    const antes = { ...m };
    const depois = { ...m, ...novos };
    checarNotas(depois);
    const mudouNota = ['n1', 'n2', 'exame', 'faltas'].some((c) => antes[c] !== depois[c]);
    if (mudouNota) { // trg_atualiza_situacao
      depois.media_final = fnCalcularMedia(depois.n1, depois.n2, depois.exame);
      depois.situacao = fnSituacao(depois.n1, depois.n2, depois.exame, depois.faltas, turmaDe(m.id_turma).total_aulas);
    }
    Object.assign(m, depois);
    for (const c of ['n1', 'n2', 'exame', 'faltas', 'media_final']) { // trg_auditoria_nota
      if (antes[c] !== m[c]) {
        const fmt = (v) => (v === null ? null : c === 'faltas' ? String(v) : Number(v).toFixed(2));
        db.log_nota.push({ id_log: ++seq.log_nota, id_matricula: m.id_matricula, campo: c,
          valor_antigo: fmt(antes[c]), valor_novo: fmt(m[c]), usuario: usuarioSessao || 'root@localhost', data_hora: agora() });
      }
    }
  }
  function agora() {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // Carga das 35 matrículas de exemplo (como em 03_dados.sql)
  const N = null;
  [
    [1, 1, 8, 9, N, 2, 3], [2, 1, 7, 7.5, N, 4, 3], [3, 1, 9, 10, N, 0, 3], [4, 1, 6, 8, N, 6, 4], [5, 1, 5, 6, 7, 3, 4],
    [6, 1, 8, 7, N, 5, 4], [7, 1, 7, 8, N, 1, 5], [8, 1, 10, 9, N, 0, 5], [9, 1, 3, 2, N, 8, 5], [10, 1, 8, 8, N, 15, 3],
    [1, 2, 8, 7, N, 2, 3], [2, 2, 5, 6, N, 4, 3], [3, 2, 9, 9, N, 0, 3], [4, 2, N, N, N, 0, 4], [5, 2, N, N, N, 0, 4],
    [6, 2, N, N, N, 0, 4], [7, 2, N, N, N, 0, 5], [8, 2, N, N, N, 0, 5], [9, 2, N, N, N, 0, 5],
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((a) => [a, 3, N, N, N, 0, a < 4 ? 3 : a < 7 ? 4 : 5]),
    [13, 4, 7.5, 8, N, 3, 4], [14, 4, 4, 5, N, 6, 4], [15, 4, 2.5, 3, N, 10, 4], [16, 4, 9.5, 9, N, 20, 5], [17, 4, N, N, N, 0, 5],
    [18, 5, N, N, N, 0, 3], [19, 5, N, N, N, 0, 3], [20, 5, N, N, N, 0, 3],
  ].forEach(([id_aluno, id_turma, n1, n2, exame, faltas, id_usuario], i) => {
    const data = id_turma === 1 ? '2025-08-01' : `2026-08-0${id_turma + 1}`;
    inserirMatricula({ id_aluno, id_turma, n1, n2, exame, faltas, id_usuario, data_matricula: `${data} 09:${String(i).padStart(2, '0')}:00` });
  });
  db.turma[0].status = 'Encerrada';

  // ------------------------------ Views ------------------------------
  const nomeTurma = (t) => `T${String(t.id_turma).padStart(3, '0')} - ${disciplinaDe(t.id_disciplina).nome} (${t.semestre})`;
  const profDe = (id) => db.professor.find((p) => p.id_professor === id);
  const cursoDe = (id) => db.curso.find((c) => c.id_curso === id);
  const alunoDe = (id) => db.aluno.find((a) => a.id_aluno === id);
  const doTurma = (id) => db.matricula.filter((m) => m.id_turma === id);
  const pct = (parte, total) => (total ? r2((parte / total) * 100) : 0);

  const views = {
    vw_usuarios: () => db.usuario.map(({ senha, ...u }) => u),
    vw_cursos: () => db.curso.map((c) => ({ ...c,
      total_alunos: db.aluno.filter((a) => a.id_curso === c.id_curso).length,
      total_disciplinas: db.disciplina.filter((d) => d.id_curso === c.id_curso).length })),
    vw_disciplinas: () => db.disciplina.map((d) => ({ ...d, curso: cursoDe(d.id_curso).nome,
      pre_requisitos: db.pre_requisito.filter((p) => p.id_disciplina === d.id_disciplina)
        .map((p) => disciplinaDe(p.id_disciplina_requisito).nome).sort().join(', ') || null })),
    vw_pre_requisitos: () => db.pre_requisito.map((p) => ({ ...p, disciplina: disciplinaDe(p.id_disciplina).nome,
      requisito: disciplinaDe(p.id_disciplina_requisito).nome, curso: cursoDe(disciplinaDe(p.id_disciplina).id_curso).nome })),
    vw_professores: () => db.professor.map((p) => ({ ...p })),
    vw_alunos: () => db.aluno.map((a) => ({ ...a, curso: cursoDe(a.id_curso).nome, cr: fnCr(a.id_aluno) })),
    vw_turmas: () => db.turma.map((t) => ({ ...t, descricao: nomeTurma(t), disciplina: disciplinaDe(t.id_disciplina).nome,
      professor: profDe(t.id_professor).nome, matriculados: doTurma(t.id_turma).length })),
    vw_matriculas: () => db.matricula.map((m) => {
      const t = turmaDe(m.id_turma); const a = alunoDe(m.id_aluno);
      return { ...m, ra: a.ra, aluno: a.nome, disciplina: disciplinaDe(t.id_disciplina).nome, semestre: t.semestre,
        status_turma: t.status, frequencia: fnFrequencia(t.total_aulas, m.faltas),
        matriculado_por: db.usuario.find((u) => u.id_usuario === m.id_usuario)?.nome ?? '—' };
    }),
    vw_boletim: () => db.matricula.map((m) => {
      const t = turmaDe(m.id_turma); const a = alunoDe(m.id_aluno);
      return { id_aluno: a.id_aluno, aluno: a.nome, ra: a.ra, id_matricula: m.id_matricula, disciplina: disciplinaDe(t.id_disciplina).nome,
        semestre: t.semestre, n1: m.n1, n2: m.n2, exame: m.exame, media_final: m.media_final, faltas: m.faltas,
        frequencia: fnFrequencia(t.total_aulas, m.faltas), situacao: m.situacao };
    }),
    vw_turmas_lotacao: () => db.turma.map((t) => {
      const n = doTurma(t.id_turma).length;
      return { id_turma: t.id_turma, turma: nomeTurma(t), disciplina: disciplinaDe(t.id_disciplina).nome, professor: profDe(t.id_professor).nome,
        semestre: t.semestre, status: t.status, vagas_totais: t.vagas, matriculados: n, vagas_restantes: t.vagas - n, perc_ocupacao: pct(n, t.vagas) };
    }),
    vw_desempenho_turma: () => db.turma.map((t) => {
      const ms = doTurma(t.id_turma); const medias = ms.map((m) => m.media_final).filter((v) => v !== null);
      return { id_turma: t.id_turma, turma: nomeTurma(t), disciplina: disciplinaDe(t.id_disciplina).nome, semestre: t.semestre,
        total_alunos: ms.length, media_global: medias.length ? r2(medias.reduce((s, v) => s + v, 0) / medias.length) : null,
        maior_nota: medias.length ? Math.max(...medias) : null, menor_nota: medias.length ? Math.min(...medias) : null,
        perc_aprovados: pct(ms.filter((m) => m.situacao === 'Aprovado').length, ms.length),
        perc_reprovados: pct(ms.filter((m) => m.situacao.startsWith('Reprovado')).length, ms.length) };
    }),
    vw_faturamento_curso: () => db.curso.map((c) => {
      const n = db.aluno.filter((a) => a.id_curso === c.id_curso && a.status === 'Ativo').length;
      return { id_curso: c.id_curso, curso: c.nome, turno: c.turno, valor_mensalidade: c.valor_mensalidade, alunos_ativos: n,
        faturamento_mensal: r2(n * c.valor_mensalidade), faturamento_semestral: r2(n * c.valor_mensalidade * 6) };
    }),
    vw_log_nota: () => db.log_nota.map((l) => {
      const m = db.matricula.find((x) => x.id_matricula === l.id_matricula); const t = turmaDe(m.id_turma);
      return { ...l, aluno: alunoDe(m.id_aluno).nome, disciplina: disciplinaDe(t.id_disciplina).nome, semestre: t.semestre };
    }),
  };

  // ------------------------------ Validação de dados (CHECK / UNIQUE / FK) ------------------------------
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const txt = (v) => (v === null || v === undefined || v === '' ? null : String(v).trim());
  const obrig = (obj, campos) => { for (const c of campos) if (obj[c] === null || Number.isNaN(obj[c])) sinal(`Dados inválidos: Column '${c}' cannot be null`); };
  const unico = (tabela, obj, campos, idCampo) => {
    for (const c of campos) {
      if (db[tabela].some((r) => r[c] === obj[c] && r[idCampo] !== obj[idCampo])) {
        throw new ErroSQL(`Registro duplicado: Duplicate entry '${obj[c]}' for key '${tabela}.uq_${tabela}_${c}'`, 409);
      }
    }
  };
  const check = (cond, nome) => { if (!cond) sinal(`Valor fora do permitido (Check constraint '${nome}' is violated.)`); };
  const fk = (achado) => { if (!achado) sinal('Operação viola um relacionamento entre registros.'); };

  const VALIDAR = {
    usuario: (u) => {
      obrig(u, ['nome', 'cpf', 'email', 'login', 'perfil']);
      check(['Secretario', COORD].includes(u.perfil), 'ck_usuario_perfil');
      unico('usuario', u, ['cpf', 'email', 'login'], 'id_usuario');
    },
    curso: (c) => {
      obrig(c, ['nome', 'carga_horaria_total', 'turno']);
      check(['Matutino', 'Vespertino', 'Noturno'].includes(c.turno), 'ck_curso_turno');
      check(c.carga_horaria_total > 0, 'ck_curso_ch'); check(c.valor_mensalidade >= 0, 'ck_curso_valor');
      unico('curso', c, ['nome'], 'id_curso');
    },
    disciplina: (d) => {
      obrig(d, ['id_curso', 'nome', 'carga_horaria', 'periodo']);
      fk(cursoDe(d.id_curso)); check(d.carga_horaria > 0, 'ck_disciplina_ch'); check(d.periodo >= 1 && d.periodo <= 12, 'ck_disciplina_periodo');
      if (db.disciplina.some((x) => x.id_curso === d.id_curso && x.nome === d.nome && x.id_disciplina !== d.id_disciplina)) {
        throw new ErroSQL(`Registro duplicado: Duplicate entry '${d.id_curso}-${d.nome}' for key 'disciplina.uq_disciplina_curso_nome'`, 409);
      }
    },
    professor: (p) => {
      obrig(p, ['nome', 'cpf', 'email', 'titulacao', 'data_admissao']);
      check(['Graduado', 'Especialista', 'Mestre', 'Doutor'].includes(p.titulacao), 'ck_professor_titulacao');
      unico('professor', p, ['cpf', 'email'], 'id_professor');
    },
    aluno: (a) => {
      obrig(a, ['ra', 'nome', 'cpf', 'email', 'data_nascimento', 'id_curso']);
      fk(cursoDe(a.id_curso)); check(['Ativo', 'Trancado', 'Formado'].includes(a.status), 'ck_aluno_status');
      unico('aluno', a, ['ra', 'cpf', 'email'], 'id_aluno');
    },
    turma: (t) => {
      obrig(t, ['id_disciplina', 'id_professor', 'semestre', 'vagas', 'total_aulas']);
      fk(disciplinaDe(t.id_disciplina)); fk(profDe(t.id_professor));
      check(t.vagas > 0, 'ck_turma_vagas'); check(t.total_aulas > 0, 'ck_turma_aulas'); check(/^\d{4}\.[12]$/.test(t.semestre), 'ck_turma_semestre');
    },
  };

  // ------------------------------ Procedures ------------------------------
  const validaUsuario = (id) => {
    const u = db.usuario.find((x) => x.id_usuario === id);
    if (!u) sinal('Usuario invalido ou nao autenticado.');
    usuarioSessao = u.login;
    return u;
  };
  const validaCoordenador = (id) => {
    if (validaUsuario(id).perfil !== COORD) sinal('Acesso negado: operacao exclusiva do perfil Coordenador.');
  };

  const CAMPOS = {
    usuario: { id: 'id_usuario', conv: (b) => ({ nome: txt(b.nome), cpf: txt(b.cpf), email: txt(b.email), login: txt(b.login), perfil: txt(b.perfil) }) },
    curso: { id: 'id_curso', conv: (b) => ({ nome: txt(b.nome), carga_horaria_total: num(b.carga_horaria_total), turno: txt(b.turno), valor_mensalidade: num(b.valor_mensalidade) ?? 0 }) },
    disciplina: { id: 'id_disciplina', conv: (b) => ({ id_curso: num(b.id_curso), nome: txt(b.nome), carga_horaria: num(b.carga_horaria), periodo: num(b.periodo) }) },
    professor: { id: 'id_professor', conv: (b) => ({ nome: txt(b.nome), cpf: txt(b.cpf), email: txt(b.email), titulacao: txt(b.titulacao), data_admissao: txt(b.data_admissao) }) },
    aluno: { id: 'id_aluno', conv: (b) => ({ ra: txt(b.ra), nome: txt(b.nome), cpf: txt(b.cpf), email: txt(b.email), data_nascimento: txt(b.data_nascimento), id_curso: num(b.id_curso), status: txt(b.status) || 'Ativo' }) },
    turma: { id: 'id_turma', conv: (b) => ({ id_disciplina: num(b.id_disciplina), id_professor: num(b.id_professor), semestre: txt(b.semestre), vagas: num(b.vagas), total_aulas: num(b.total_aulas) }) },
  };

  function inserir(tabela, corpo) {
    const cfg = CAMPOS[tabela];
    const novo = cfg.conv(corpo);
    if (tabela === 'usuario') {
      if (!corpo.senha) sinal('Senha obrigatoria (hash SHA-256 invalido).');
      novo.senha = corpo.senha;
    }
    if (tabela === 'turma') novo.status = 'Aberta';
    novo[cfg.id] = null;
    VALIDAR[tabela](novo);
    novo[cfg.id] = ++seq[tabela];
    db[tabela].push(novo);
    return { id: novo[cfg.id] };
  }

  function atualizar(tabela, id, corpo, exec) {
    const cfg = CAMPOS[tabela];
    const atual = db[tabela].find((r) => r[cfg.id] === id);
    if (!atual) sinal(`${{ usuario: 'Usuario', curso: 'Curso', disciplina: 'Disciplina', professor: 'Professor', aluno: 'Aluno', turma: 'Turma' }[tabela]} nao encontrad${['disciplina', 'turma'].includes(tabela) ? 'a' : 'o'}.`);
    const novo = { ...atual, ...cfg.conv(corpo) };
    if (tabela === 'usuario') {
      if (exec === id && novo.perfil !== COORD) sinal('Voce nao pode remover o seu proprio perfil de Coordenador.');
      if (corpo.senha) novo.senha = corpo.senha;
    }
    if (tabela === 'turma') {
      if (atual.status === 'Encerrada') sinal('Turma encerrada nao pode ser alterada.');
      const n = doTurma(id).length;
      if (novo.vagas < n) sinal('Vagas nao pode ser menor que o numero de alunos ja matriculados.');
      if (n > 0 && novo.id_disciplina !== atual.id_disciplina) sinal('Turma com matriculas nao pode trocar de disciplina.');
    }
    VALIDAR[tabela](novo);
    Object.assign(atual, novo);
    return { afetados: 1 };
  }

  const BLOQUEIOS = {
    usuario: (id, exec) => {
      if (exec === id) sinal('Voce nao pode excluir o proprio usuario.');
      if (db.matricula.some((m) => m.id_usuario === id)) sinal('Usuario possui matriculas registradas e nao pode ser excluido.');
    },
    curso: (id) => {
      if (db.aluno.some((a) => a.id_curso === id) || db.disciplina.some((d) => d.id_curso === id)) sinal('Curso possui alunos ou disciplinas vinculados e nao pode ser excluido.');
    },
    disciplina: (id) => { if (db.turma.some((t) => t.id_disciplina === id)) sinal('Disciplina possui turmas vinculadas e nao pode ser excluida.'); },
    professor: (id) => { if (db.turma.some((t) => t.id_professor === id)) sinal('Professor possui turmas vinculadas e nao pode ser excluido.'); },
    aluno: (id) => { if (db.matricula.some((m) => m.id_aluno === id)) sinal('Aluno possui historico de matriculas. Altere o status para Trancado.'); },
    turma: (id) => { if (doTurma(id).length) sinal('Turma possui matriculas e nao pode ser excluida.'); },
  };

  function excluir(tabela, id, exec) {
    BLOQUEIOS[tabela](id, exec);
    const idCampo = CAMPOS[tabela].id;
    const antes = db[tabela].length;
    db[tabela] = db[tabela].filter((r) => r[idCampo] !== id);
    if (tabela === 'disciplina') {
      db.pre_requisito = db.pre_requisito.filter((p) => p.id_disciplina !== id && p.id_disciplina_requisito !== id);
    }
    return { afetados: antes - db[tabela].length };
  }

  function spMatricularAluno(idAluno, idTurma, idUsuario) {
    validaUsuario(idUsuario);
    const a = alunoDe(idAluno);
    if (!a) sinal('Aluno nao encontrado.');
    if (['Trancado', 'Formado'].includes(a.status)) sinal('RN09: Aluno com status Trancado ou Formado nao pode se matricular.');
    const t = turmaDe(idTurma);
    if (!t) sinal('Turma nao encontrada.');
    if (t.status === 'Encerrada') sinal('Turma encerrada: nao aceita novas matriculas.');
    if (db.matricula.some((m) => m.id_aluno === idAluno && m.id_turma === idTurma)) sinal('Aluno ja matriculado nesta turma.');
    if (doTurma(idTurma).length >= t.vagas) sinal('RN05: Turma lotada. Limite maximo de vagas atingido.');
    const pendentes = db.pre_requisito.filter((p) => p.id_disciplina === t.id_disciplina).filter((p) => !db.matricula.some((m) =>
      m.id_aluno === idAluno && turmaDe(m.id_turma).id_disciplina === p.id_disciplina_requisito && m.situacao === 'Aprovado'));
    if (pendentes.length) sinal('RN06: Aluno nao foi aprovado em todos os pre-requisitos da disciplina.');
    return { id_matricula: inserirMatricula({ id_aluno: idAluno, id_turma: idTurma, id_usuario: idUsuario }).id_matricula };
  }

  const resumoMatricula = (m) => ({ id_matricula: m.id_matricula, n1: m.n1, n2: m.n2, exame: m.exame, faltas: m.faltas, media_final: m.media_final, situacao: m.situacao });

  function spLancarNotas(id, n1, n2, faltas, idUsuario) {
    validaCoordenador(idUsuario);
    const m = db.matricula.find((x) => x.id_matricula === id);
    if (!m) sinal('Matricula nao encontrada.');
    const t = turmaDe(m.id_turma);
    if (t.status === 'Encerrada') sinal('Turma encerrada: notas nao podem mais ser alteradas.');
    if (faltas < 0 || faltas > t.total_aulas) sinal('Quantidade de faltas invalida para o total de aulas da turma.');
    atualizarMatricula(m, { n1, n2, faltas });
    usuarioSessao = null;
    return resumoMatricula(m);
  }

  function spLancarExame(id, exame, idUsuario) {
    validaCoordenador(idUsuario);
    const m = db.matricula.find((x) => x.id_matricula === id);
    if (!m) sinal('Matricula nao encontrada.');
    if (turmaDe(m.id_turma).status === 'Encerrada') sinal('Turma encerrada: notas nao podem mais ser alteradas.');
    if (m.situacao !== 'Em Exame') sinal('Exame permitido somente para matriculas com situacao Em Exame.');
    atualizarMatricula(m, { exame });
    usuarioSessao = null;
    return resumoMatricula(m);
  }

  function spHistoricoAluno(idAluno) {
    const a = alunoDe(idAluno);
    if (!a) sinal('Aluno nao encontrado.');
    return db.matricula.filter((m) => m.id_aluno === idAluno).map((m) => {
      const t = turmaDe(m.id_turma); const d = disciplinaDe(t.id_disciplina);
      return { ra: a.ra, aluno: a.nome, curso: cursoDe(a.id_curso).nome, status: a.status, semestre: t.semestre, periodo: d.periodo,
        disciplina: d.nome, carga_horaria: d.carga_horaria, professor: profDe(t.id_professor).nome, n1: m.n1, n2: m.n2, exame: m.exame,
        media_final: m.media_final, faltas: m.faltas, frequencia: fnFrequencia(t.total_aulas, m.faltas), situacao: m.situacao, cr: fnCr(a.id_aluno) };
    }).sort((x, y) => x.semestre.localeCompare(y.semestre) || x.periodo - y.periodo || x.disciplina.localeCompare(y.disciplina));
  }

  function spFecharSemestre(semestre, idUsuario) {
    validaCoordenador(idUsuario);
    const abertas = db.turma.filter((t) => t.semestre === semestre && t.status === 'Aberta');
    if (!abertas.length) sinal('Nao ha turmas abertas para o semestre informado.');
    // START TRANSACTION: trabalha numa cópia e só "faz COMMIT" no final
    const copia = JSON.parse(JSON.stringify({ matricula: db.matricula, turma: db.turma }));
    let finalizadas = 0;
    for (const t of abertas) { // cursor cur_turmas
      for (const m of copia.matricula.filter((x) => x.id_turma === t.id_turma)) {
        if (m.situacao === 'Em Exame') { m.situacao = 'Reprovado por Nota'; finalizadas++; }
        else if (m.situacao === 'Cursando') {
          m.media_final = r2(((m.n1 || 0) + (m.n2 || 0)) / 2);
          m.situacao = fnFrequencia(t.total_aulas, m.faltas) < 75 ? 'Reprovado por Falta' : 'Reprovado por Nota';
          finalizadas++;
        }
      }
      copia.turma.find((x) => x.id_turma === t.id_turma).status = 'Encerrada';
    }
    db.matricula.splice(0, db.matricula.length, ...copia.matricula); // COMMIT
    db.turma.splice(0, db.turma.length, ...copia.turma);
    usuarioSessao = null;
    return { semestre, turmas_encerradas: abertas.length, matriculas_finalizadas_automaticamente: finalizadas };
  }

  // ------------------------------ Rotas (equivalentes ao server.js) ------------------------------
  let sessao = null;
  const ENT = {
    usuarios: { tab: 'usuario', view: 'vw_usuarios', ler: [COORD], escrever: [COORD] },
    cursos: { tab: 'curso', view: 'vw_cursos', ler: TODOS, escrever: [COORD] },
    disciplinas: { tab: 'disciplina', view: 'vw_disciplinas', ler: TODOS, escrever: [COORD] },
    professores: { tab: 'professor', view: 'vw_professores', ler: [COORD], escrever: [COORD] },
    alunos: { tab: 'aluno', view: 'vw_alunos', ler: TODOS, escrever: TODOS },
    turmas: { tab: 'turma', view: 'vw_turmas', ler: TODOS, escrever: [COORD] },
  };
  const exigir = (perfis) => {
    if (!sessao) throw new ErroSQL('Sessão expirada. Faça login novamente.', 401);
    if (!perfis.includes(sessao.perfil)) throw new ErroSQL(`Acesso negado para o perfil ${sessao.perfil}.`, 403);
    return sessao.id_usuario;
  };

  function rotear(metodo, url, corpo = {}) {
    const p = url.replace(/^\/api\//, '').split('/');
    if (p[0] === 'login' && metodo === 'POST') {
      const u = db.usuario.find((x) => x.login === corpo.login && x.senha === corpo.senha);
      if (!corpo.login || !corpo.senha) throw new ErroSQL('Informe login e senha.');
      if (!u) throw new ErroSQL('Login ou senha inválidos.', 401);
      sessao = { id_usuario: u.id_usuario, nome: u.nome, email: u.email, login: u.login, perfil: u.perfil };
      return sessao;
    }
    if (p[0] === 'logout') { sessao = null; return { ok: true }; }
    if (p[0] === 'me') { if (!sessao) throw new ErroSQL('Não autenticado.', 401); return sessao; }

    if (ENT[p[0]]) {
      const e = ENT[p[0]]; const id = Number(p[1]);
      if (metodo === 'GET') { exigir(e.ler); return views[e.view](); }
      const exec = exigir(e.escrever);
      if (e.tab === 'aluno') validaUsuario(exec); else validaCoordenador(exec);
      if (metodo === 'POST') return inserir(e.tab, corpo);
      if (metodo === 'PUT') return atualizar(e.tab, id, corpo, exec);
      if (metodo === 'DELETE') return excluir(e.tab, id, exec);
    }
    if (p[0] === 'prerequisitos') {
      if (metodo === 'GET') { exigir(TODOS); return views.vw_pre_requisitos(); }
      validaCoordenador(exigir([COORD]));
      if (metodo === 'POST') {
        const d = num(corpo.id_disciplina); const r = num(corpo.id_disciplina_requisito);
        fk(disciplinaDe(d)); fk(disciplinaDe(r));
        if (d === r) sinal('Uma disciplina nao pode ser pre-requisito dela mesma.');
        if (db.pre_requisito.some((x) => x.id_disciplina === r && x.id_disciplina_requisito === d)) sinal('Dependencia circular entre as disciplinas.');
        if (db.pre_requisito.some((x) => x.id_disciplina === d && x.id_disciplina_requisito === r)) throw new ErroSQL(`Registro duplicado: Duplicate entry '${d}-${r}' for key 'pre_requisito.PRIMARY'`, 409);
        db.pre_requisito.push({ id_disciplina: d, id_disciplina_requisito: r });
        return { afetados: 1 };
      }
      if (metodo === 'DELETE') {
        const antes = db.pre_requisito.length;
        db.pre_requisito = db.pre_requisito.filter((x) => !(x.id_disciplina === Number(p[1]) && x.id_disciplina_requisito === Number(p[2])));
        return { afetados: antes - db.pre_requisito.length };
      }
    }
    if (p[0] === 'matriculas') {
      const id = Number(p[1]);
      if (metodo === 'GET') { exigir(TODOS); return views.vw_matriculas(); }
      if (metodo === 'POST' && !p[2]) return spMatricularAluno(num(corpo.id_aluno), num(corpo.id_turma), exigir(TODOS));
      if (metodo === 'DELETE') {
        validaUsuario(exigir(TODOS));
        const m = db.matricula.find((x) => x.id_matricula === id);
        if (!m) sinal('Matricula nao encontrada.');
        if (turmaDe(m.id_turma).status === 'Encerrada') sinal('Matricula de turma encerrada faz parte do historico e nao pode ser cancelada.');
        db.matricula = db.matricula.filter((x) => x !== m);
        db.log_nota = db.log_nota.filter((l) => l.id_matricula !== id);
        return { afetados: 1 };
      }
      if (p[2] === 'notas') return spLancarNotas(id, num(corpo.n1), num(corpo.n2), num(corpo.faltas) ?? 0, exigir([COORD]));
      if (p[2] === 'exame') return spLancarExame(id, num(corpo.exame), exigir([COORD]));
    }
    if (p[0] === 'relatorios') {
      if (p[1] === 'boletim') { exigir(TODOS); return views.vw_boletim().filter((b) => b.id_aluno === Number(p[2])); }
      if (p[1] === 'historico') { exigir(TODOS); return spHistoricoAluno(Number(p[2])); }
      if (p[1] === 'lotacao') { exigir(TODOS); return views.vw_turmas_lotacao(); }
      if (p[1] === 'desempenho') { exigir([COORD]); return views.vw_desempenho_turma(); }
      if (p[1] === 'faturamento') { exigir([COORD]); return views.vw_faturamento_curso(); }
      if (p[1] === 'auditoria') { exigir([COORD]); return views.vw_log_nota(); }
    }
    if (p[0] === 'semestre' && p[1] === 'fechar') return spFecharSemestre(txt(corpo.semestre), exigir([COORD]));
    throw new ErroSQL('Rota não encontrada.', 404);
  }

  return {
    async chamar(metodo, url, corpo) {
      await new Promise((r) => setTimeout(r, 60));
      return JSON.parse(JSON.stringify(rotear(metodo, url, corpo || {})));
    },
    ErroSQL,
  };
})();

// Substitui a chamada HTTP da interface real pelo backend simulado
async function api(metodo, url, corpo) {
  try {
    return await MOCK.chamar(metodo, url, corpo);
  } catch (erro) {
    if (erro.status === 401 && url !== '/api/login' && url !== '/api/me') mostrarLogin();
    throw erro;
  }
}
