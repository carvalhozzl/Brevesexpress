// =====================================================================
//  SGA - Interface web (JavaScript puro)
// =====================================================================
const COORD = 'Coordenador';
const SECR = 'Secretario';
const TODOS = [COORD, SECR];

let usuario = null;
let telaAtual = null;

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ehCoord = () => usuario && usuario.perfil === COORD;

// ------------------------------ API ------------------------------
async function api(metodo, url, corpo) {
  const resp = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resp.json().catch(() => ({}));
  if (resp.status === 401 && url !== '/api/login' && url !== '/api/me') {
    mostrarLogin();
  }
  if (!resp.ok) throw new Error(dados.erro || `Erro ${resp.status}`);
  return dados;
}

function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `visivel${erro ? ' erro' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, erro ? 5000 : 2800);
}

// ------------------------------ Formatação ------------------------------
const FORMATOS = {
  nota: (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2)),
  pct: (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(2)}%`),
  moeda: (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  data: (v) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '—'),
  datahora: (v) => (v ? `${FORMATOS.data(v)} ${v.slice(11, 16)}` : '—'),
  cpf: (v) => (v && v.length === 11 ? `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}` : esc(v)),
  etiqueta: (v) => {
    const cor = { Aprovado: 'ok', Ativo: 'ok', Aberta: 'ok', 'Em Exame': 'alerta', Trancado: 'alerta',
      'Reprovado por Nota': 'perigo', 'Reprovado por Falta': 'perigo', Encerrada: '', Formado: '', Coordenador: '' }[v];
    return `<span class="etiqueta ${cor || ''}">${esc(v)}</span>`;
  },
  ocupacao: (v) => `<span class="barra"><span class="${v >= 100 ? 'cheia' : ''}" style="width:${Math.min(v, 100)}%"></span></span>${Number(v).toFixed(1)}%`,
};
const NUMERICOS = ['nota', 'pct', 'moeda', 'num'];

function formatar(valor, tipo) {
  if (tipo && FORMATOS[tipo]) return FORMATOS[tipo](valor);
  return valor === null || valor === undefined || valor === '' ? '—' : esc(valor);
}

// Monta uma tabela HTML. colunas: [{ c: 'campo', t: 'Título', f: 'formato' }]
function tabela(colunas, linhas, acoes) {
  if (!linhas.length) return '<div class="tabela-wrap"><div class="vazio">Nenhum registro encontrado.</div></div>';
  const cab = colunas.map((col) => `<th class="${NUMERICOS.includes(col.f) ? 'num' : ''}" data-col="${col.c}">${esc(col.t)}</th>`).join('');
  const corpo = linhas.map((l, i) => `<tr>${colunas.map((col) =>
    `<td class="${NUMERICOS.includes(col.f) ? 'num' : ''}">${formatar(l[col.c], col.f)}</td>`).join('')}${
    acoes ? `<td class="acoes">${acoes(l, i)}</td>` : ''}</tr>`).join('');
  return `<div class="tabela-wrap"><table><thead><tr>${cab}${acoes ? '<th></th>' : ''}</tr></thead><tbody>${corpo}</tbody></table></div>`;
}

// ------------------------------ Modal de formulário ------------------------------
// campos: [{ n, l, t: text|number|date|email|password|select, opcoes, fonte, valor, texto, req, step, min, max, ajuda, largo }]
async function abrirFormulario(titulo, campos, dados, aoSalvar) {
  const container = $('#modal-campos');
  container.innerHTML = '';
  for (const campo of campos) {
    const rotulo = document.createElement('label');
    if (campo.largo) rotulo.className = 'largo';
    rotulo.append(campo.l + (campo.req ? ' *' : ''));
    let input;
    if (campo.t === 'select') {
      input = document.createElement('select');
      input.append(new Option('Selecione...', ''));
      let opcoes = campo.opcoes || [];
      if (campo.fonte) {
        const lista = await api('GET', `/api/${campo.fonte}`);
        opcoes = lista.filter(campo.filtro || (() => true)).map((o) => [o[campo.valor], typeof campo.texto === 'function' ? campo.texto(o) : o[campo.texto]]);
      }
      for (const op of opcoes) {
        const [v, t] = Array.isArray(op) ? op : [op, op];
        input.append(new Option(t, v));
      }
    } else {
      input = document.createElement('input');
      input.type = campo.t || 'text';
      for (const attr of ['step', 'min', 'max', 'pattern', 'maxLength', 'placeholder']) {
        if (campo[attr] !== undefined) input[attr] = campo[attr];
      }
    }
    input.name = campo.n;
    input.required = !!campo.req;
    const valor = dados ? dados[campo.n] : campo.padrao;
    if (valor !== undefined && valor !== null) input.value = campo.t === 'date' ? String(valor).slice(0, 10) : valor;
    rotulo.append(input);
    if (campo.ajuda) {
      const ajuda = document.createElement('span');
      ajuda.className = 'ajuda';
      ajuda.textContent = campo.ajuda;
      rotulo.append(ajuda);
    }
    container.append(rotulo);
  }
  $('#modal-titulo').textContent = titulo;
  $('#modal-erro').textContent = '';
  const modal = $('#modal');
  modal.showModal();
  modal.querySelector('input, select')?.focus();

  $('#modal-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const corpo = Object.fromEntries(new FormData(ev.target).entries());
    const botao = $('#modal-salvar');
    botao.disabled = true;
    try {
      await aoSalvar(corpo);
      modal.close();
    } catch (erro) {
      $('#modal-erro').textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  };
}
$('#modal-cancelar').onclick = () => $('#modal').close();

// ------------------------------ Tela CRUD genérica ------------------------------
function telaCrud(cfg) {
  return async (conteudo, acoesTopo) => {
    const podeEscrever = cfg.escrever.includes(usuario.perfil);
    let linhas = [];
    let busca = '';
    let ordem = null;

    if (podeEscrever) {
      const btn = document.createElement('button');
      btn.className = 'btn primario';
      btn.textContent = `+ Novo ${cfg.singular}`;
      btn.onclick = () => abrirFormulario(`Novo ${cfg.singular}`, cfg.campos(false), null, async (corpo) => {
        await api('POST', `/api/${cfg.endpoint}`, corpo);
        toast(`${cfg.singular} cadastrado com sucesso.`);
        await carregar();
      });
      acoesTopo.append(btn);
    }

    conteudo.innerHTML = `<div class="filtros"><input type="search" placeholder="Pesquisar..." aria-label="Pesquisar"></div><div id="lista"></div>`;
    conteudo.querySelector('input[type=search]').oninput = (ev) => { busca = ev.target.value.toLowerCase(); desenhar(); };

    function desenhar() {
      let visiveis = linhas.filter((l) => !busca || Object.values(l).some((v) => String(v ?? '').toLowerCase().includes(busca)));
      if (ordem) {
        visiveis = [...visiveis].sort((a, b) => {
          const x = a[ordem.c]; const y = b[ordem.c];
          const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
          return ordem.asc ? r : -r;
        });
      }
      const acoes = podeEscrever || cfg.acoesExtras ? (l) => [
        ...(cfg.acoesExtras ? cfg.acoesExtras(l) : []),
        ...(podeEscrever && cfg.campos ? [`<button class="btn pequeno" data-acao="editar" data-id="${l[cfg.id]}">Editar</button>`] : []),
        ...(podeEscrever ? [`<button class="btn pequeno perigo" data-acao="excluir" data-id="${l[cfg.id]}">${cfg.textoExcluir || 'Excluir'}</button>`] : []),
      ].join('') : null;
      const lista = conteudo.querySelector('#lista');
      lista.innerHTML = tabela(cfg.colunas, visiveis, acoes) + `<p class="contagem">${visiveis.length} de ${linhas.length} registro(s)</p>`;
      lista.querySelectorAll('th[data-col]').forEach((th) => {
        th.onclick = () => { ordem = { c: th.dataset.col, asc: !(ordem && ordem.c === th.dataset.col && ordem.asc) }; desenhar(); };
      });
      lista.querySelectorAll('button[data-acao]').forEach((b) => { b.onclick = () => acao(b.dataset.acao, b.dataset.id); });
    }

    async function acao(tipo, id) {
      const registro = linhas.find((l) => String(l[cfg.id]) === id);
      if (tipo === 'editar') {
        await abrirFormulario(`Editar ${cfg.singular}`, cfg.campos(true), registro, async (corpo) => {
          await api('PUT', `/api/${cfg.endpoint}/${id}`, corpo);
          toast(`${cfg.singular} atualizado com sucesso.`);
          await carregar();
        });
      } else if (tipo === 'excluir') {
        const nome = registro[cfg.rotulo] ?? id;
        if (!confirm(`${cfg.textoExcluir || 'Excluir'} ${cfg.singular.toLowerCase()} "${nome}"?`)) return;
        try {
          await api('DELETE', `/api/${cfg.endpoint}/${id}`);
          toast(`${cfg.singular}: operação realizada com sucesso.`);
          await carregar();
        } catch (erro) { toast(erro.message, true); }
      } else if (cfg.aoAcao) {
        await cfg.aoAcao(tipo, registro, carregar);
      }
    }

    async function carregar() {
      linhas = await api('GET', `/api/${cfg.endpoint}`);
      desenhar();
    }
    await carregar();
  };
}

// ------------------------------ Definição dos cadastros ------------------------------
const opcoesTurno = ['Matutino', 'Vespertino', 'Noturno'];

const CRUD = {
  alunos: {
    endpoint: 'alunos', id: 'id_aluno', rotulo: 'nome', singular: 'Aluno', escrever: TODOS,
    colunas: [
      { c: 'ra', t: 'RA' }, { c: 'nome', t: 'Nome' }, { c: 'cpf', t: 'CPF', f: 'cpf' }, { c: 'email', t: 'E-mail' },
      { c: 'data_nascimento', t: 'Nascimento', f: 'data' }, { c: 'curso', t: 'Curso' },
      { c: 'status', t: 'Status', f: 'etiqueta' }, { c: 'cr', t: 'CR', f: 'nota' },
    ],
    campos: () => [
      { n: 'ra', l: 'RA', req: true, maxLength: 20 },
      { n: 'status', l: 'Status', t: 'select', opcoes: ['Ativo', 'Trancado', 'Formado'], req: true, padrao: 'Ativo' },
      { n: 'nome', l: 'Nome', req: true, largo: true, maxLength: 100 },
      { n: 'cpf', l: 'CPF (somente números)', req: true, pattern: '\\d{11}', maxLength: 11 },
      { n: 'data_nascimento', l: 'Data de nascimento', t: 'date', req: true },
      { n: 'email', l: 'E-mail', t: 'email', req: true, largo: true },
      { n: 'id_curso', l: 'Curso', t: 'select', fonte: 'cursos', valor: 'id_curso', texto: 'nome', req: true, largo: true },
    ],
  },
  cursos: {
    endpoint: 'cursos', id: 'id_curso', rotulo: 'nome', singular: 'Curso', escrever: [COORD],
    colunas: [
      { c: 'id_curso', t: 'ID', f: 'num' }, { c: 'nome', t: 'Nome' }, { c: 'turno', t: 'Turno' },
      { c: 'carga_horaria_total', t: 'Carga horária', f: 'num' }, { c: 'valor_mensalidade', t: 'Mensalidade', f: 'moeda' },
      { c: 'total_disciplinas', t: 'Disciplinas', f: 'num' }, { c: 'total_alunos', t: 'Alunos', f: 'num' },
    ],
    campos: () => [
      { n: 'nome', l: 'Nome', req: true, largo: true, maxLength: 100 },
      { n: 'turno', l: 'Turno', t: 'select', opcoes: opcoesTurno, req: true },
      { n: 'carga_horaria_total', l: 'Carga horária total (h)', t: 'number', min: 1, req: true },
      { n: 'valor_mensalidade', l: 'Mensalidade (R$)', t: 'number', min: 0, step: '0.01', req: true },
    ],
  },
  disciplinas: {
    endpoint: 'disciplinas', id: 'id_disciplina', rotulo: 'nome', singular: 'Disciplina', escrever: [COORD],
    colunas: [
      { c: 'id_disciplina', t: 'ID', f: 'num' }, { c: 'nome', t: 'Nome' }, { c: 'curso', t: 'Curso' },
      { c: 'periodo', t: 'Período', f: 'num' }, { c: 'carga_horaria', t: 'Carga horária', f: 'num' },
      { c: 'pre_requisitos', t: 'Pré-requisitos' },
    ],
    campos: () => [
      { n: 'nome', l: 'Nome', req: true, largo: true, maxLength: 100 },
      { n: 'id_curso', l: 'Curso', t: 'select', fonte: 'cursos', valor: 'id_curso', texto: 'nome', req: true, largo: true },
      { n: 'carga_horaria', l: 'Carga horária (h)', t: 'number', min: 1, req: true },
      { n: 'periodo', l: 'Período', t: 'number', min: 1, max: 12, req: true },
    ],
  },
  professores: {
    endpoint: 'professores', id: 'id_professor', rotulo: 'nome', singular: 'Professor', escrever: [COORD],
    colunas: [
      { c: 'id_professor', t: 'ID', f: 'num' }, { c: 'nome', t: 'Nome' }, { c: 'cpf', t: 'CPF', f: 'cpf' },
      { c: 'email', t: 'E-mail' }, { c: 'titulacao', t: 'Titulação' }, { c: 'data_admissao', t: 'Admissão', f: 'data' },
    ],
    campos: () => [
      { n: 'nome', l: 'Nome', req: true, largo: true, maxLength: 100 },
      { n: 'cpf', l: 'CPF (somente números)', req: true, pattern: '\\d{11}', maxLength: 11 },
      { n: 'titulacao', l: 'Titulação', t: 'select', opcoes: ['Graduado', 'Especialista', 'Mestre', 'Doutor'], req: true },
      { n: 'email', l: 'E-mail', t: 'email', req: true },
      { n: 'data_admissao', l: 'Data de admissão', t: 'date', req: true },
    ],
  },
  turmas: {
    endpoint: 'turmas', id: 'id_turma', rotulo: 'descricao', singular: 'Turma', escrever: [COORD],
    colunas: [
      { c: 'id_turma', t: 'ID', f: 'num' }, { c: 'disciplina', t: 'Disciplina' }, { c: 'professor', t: 'Professor' },
      { c: 'semestre', t: 'Semestre' }, { c: 'vagas', t: 'Vagas', f: 'num' }, { c: 'matriculados', t: 'Matriculados', f: 'num' },
      { c: 'total_aulas', t: 'Aulas', f: 'num' }, { c: 'status', t: 'Status', f: 'etiqueta' },
    ],
    campos: () => [
      { n: 'id_disciplina', l: 'Disciplina', t: 'select', fonte: 'disciplinas', valor: 'id_disciplina', texto: (d) => `${d.nome} (${d.curso})`, req: true, largo: true },
      { n: 'id_professor', l: 'Professor', t: 'select', fonte: 'professores', valor: 'id_professor', texto: 'nome', req: true, largo: true },
      { n: 'semestre', l: 'Semestre', req: true, pattern: '\\d{4}\\.[12]', placeholder: '2026.2', ajuda: 'Formato AAAA.S' },
      { n: 'vagas', l: 'Vagas', t: 'number', min: 1, req: true },
      { n: 'total_aulas', l: 'Total de aulas', t: 'number', min: 1, req: true },
    ],
  },
  usuarios: {
    endpoint: 'usuarios', id: 'id_usuario', rotulo: 'login', singular: 'Usuário', escrever: [COORD],
    colunas: [
      { c: 'id_usuario', t: 'ID', f: 'num' }, { c: 'nome', t: 'Nome' }, { c: 'login', t: 'Login' },
      { c: 'email', t: 'E-mail' }, { c: 'cpf', t: 'CPF', f: 'cpf' }, { c: 'perfil', t: 'Perfil', f: 'etiqueta' },
    ],
    campos: (edicao) => [
      { n: 'nome', l: 'Nome', req: true, largo: true, maxLength: 100 },
      { n: 'login', l: 'Login', req: true, maxLength: 50 },
      { n: 'perfil', l: 'Perfil', t: 'select', opcoes: [[COORD, 'Coordenador'], [SECR, 'Secretário']], req: true },
      { n: 'cpf', l: 'CPF (somente números)', req: true, pattern: '\\d{11}', maxLength: 11 },
      { n: 'email', l: 'E-mail', t: 'email', req: true },
      { n: 'senha', l: 'Senha', t: 'password', req: !edicao, largo: true,
        ajuda: edicao ? 'Deixe em branco para manter a senha atual. Armazenada como hash SHA-256.' : 'Armazenada como hash SHA-256.' },
    ],
  },
};

// Matrículas: inclusão via sp_matricular_aluno, notas/exame via procedures próprias
CRUD.matriculas = {
  endpoint: 'matriculas', id: 'id_matricula', rotulo: 'aluno', singular: 'Matrícula', escrever: TODOS,
  colunas: [
    { c: 'id_matricula', t: 'Nº', f: 'num' }, { c: 'ra', t: 'RA' }, { c: 'aluno', t: 'Aluno' }, { c: 'disciplina', t: 'Disciplina' },
    { c: 'semestre', t: 'Semestre' }, { c: 'n1', t: 'N1', f: 'nota' }, { c: 'n2', t: 'N2', f: 'nota' },
    { c: 'exame', t: 'Exame', f: 'nota' }, { c: 'media_final', t: 'Média', f: 'nota' }, { c: 'faltas', t: 'Faltas', f: 'num' },
    { c: 'frequencia', t: 'Freq.', f: 'pct' }, { c: 'situacao', t: 'Situação', f: 'etiqueta' },
  ],
  campos: null, // não há "editar" genérico: a alteração é feita pelo lançamento de notas
  acoesExtras: (l) => (ehCoord() && l.status_turma === 'Aberta' ? [
    `<button class="btn pequeno" data-acao="notas" data-id="${l.id_matricula}">Notas</button>`,
    ...(l.situacao === 'Em Exame' ? [`<button class="btn pequeno" data-acao="exame" data-id="${l.id_matricula}">Exame</button>`] : []),
  ] : []),
  aoAcao: async (tipo, m, recarregar) => {
    if (tipo === 'notas') {
      await abrirFormulario(`Lançar notas — ${m.aluno} (${m.disciplina})`, [
        { n: 'n1', l: 'N1', t: 'number', step: '0.01', req: true },
        { n: 'n2', l: 'N2', t: 'number', step: '0.01', req: true },
        { n: 'faltas', l: 'Faltas', t: 'number', min: 0, req: true, ajuda: 'Frequência mínima: 75%' },
      ], m, async (corpo) => {
        const r = await api('POST', `/api/matriculas/${m.id_matricula}/notas`, corpo);
        toast(`Notas lançadas. Média ${FORMATOS.nota(r.media_final)} — ${r.situacao}.`);
        await recarregar();
      });
    } else if (tipo === 'exame') {
      await abrirFormulario(`Lançar exame — ${m.aluno} (${m.disciplina})`, [
        { n: 'exame', l: 'Nota do exame', t: 'number', step: '0.01', req: true, largo: true,
          ajuda: `Média parcial ${FORMATOS.nota(m.media_final)}. Média final = (parcial + exame) / 2; aprovado com 5,0.` },
      ], m, async (corpo) => {
        const r = await api('POST', `/api/matriculas/${m.id_matricula}/exame`, corpo);
        toast(`Exame lançado. Média final ${FORMATOS.nota(r.media_final)} — ${r.situacao}.`);
        await recarregar();
      });
    }
  },
};

function telaMatriculas() {
  return async (conteudo, acoesTopo) => {
    const btn = document.createElement('button');
    btn.className = 'btn primario';
    btn.textContent = '+ Nova matrícula';
    btn.onclick = () => abrirFormulario('Nova matrícula', [
      { n: 'id_aluno', l: 'Aluno', t: 'select', fonte: 'alunos', valor: 'id_aluno', req: true, largo: true,
        filtro: (a) => a.status === 'Ativo', texto: (a) => `${a.ra} — ${a.nome} (${a.curso})` },
      { n: 'id_turma', l: 'Turma', t: 'select', fonte: 'turmas', valor: 'id_turma', req: true, largo: true,
        filtro: (t) => t.status === 'Aberta', texto: (t) => `${t.descricao} — ${t.vagas - t.matriculados} vaga(s)` },
    ], null, async (corpo) => {
      await api('POST', '/api/matriculas', corpo);
      toast('Matrícula realizada com sucesso.');
      await telas.matriculas.abrir();
    });
    acoesTopo.append(btn);
    // a tela genérica cuida da listagem e da busca; as ações vêm de acoesExtras
    const cfgSemNovo = { ...CRUD.matriculas, escrever: [] };
    cfgSemNovo.acoesExtras = (l) => [
      ...CRUD.matriculas.acoesExtras(l),
      ...(l.status_turma === 'Aberta' ? [`<button class="btn pequeno perigo" data-acao="cancelar" data-id="${l.id_matricula}">Cancelar</button>`] : []),
    ];
    cfgSemNovo.aoAcao = async (tipo, m, recarregar) => {
      if (tipo !== 'cancelar') return CRUD.matriculas.aoAcao(tipo, m, recarregar);
      if (!confirm(`Cancelar a matrícula de ${m.aluno} em ${m.disciplina}?`)) return;
      try {
        await api('DELETE', `/api/matriculas/${m.id_matricula}`);
        toast('Matrícula cancelada.');
        await recarregar();
      } catch (erro) { toast(erro.message, true); }
    };
    await telaCrud(cfgSemNovo)(conteudo, document.createElement('div'));
  };
}

// Pré-requisitos (chave composta)
async function telaPreRequisitos(conteudo, acoesTopo) {
  const btn = document.createElement('button');
  btn.className = 'btn primario';
  btn.textContent = '+ Novo pré-requisito';
  const campoDisc = (n, l) => ({ n, l, t: 'select', fonte: 'disciplinas', valor: 'id_disciplina', texto: (d) => `${d.nome} (${d.curso})`, req: true, largo: true });
  btn.onclick = () => abrirFormulario('Novo pré-requisito', [
    campoDisc('id_disciplina', 'Disciplina'),
    campoDisc('id_disciplina_requisito', 'Exige aprovação em'),
  ], null, async (corpo) => {
    await api('POST', '/api/prerequisitos', corpo);
    toast('Pré-requisito cadastrado.');
    await carregar();
  });
  acoesTopo.append(btn);

  async function carregar() {
    const linhas = await api('GET', '/api/prerequisitos');
    conteudo.innerHTML = tabela([
      { c: 'curso', t: 'Curso' }, { c: 'disciplina', t: 'Disciplina' }, { c: 'requisito', t: 'Pré-requisito' },
    ], linhas, (l) => `<button class="btn pequeno perigo" data-d="${l.id_disciplina}" data-r="${l.id_disciplina_requisito}">Excluir</button>`);
    conteudo.querySelectorAll('button[data-d]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Excluir este pré-requisito?')) return;
        try {
          await api('DELETE', `/api/prerequisitos/${b.dataset.d}/${b.dataset.r}`);
          toast('Pré-requisito excluído.');
          await carregar();
        } catch (erro) { toast(erro.message, true); }
      };
    });
  }
  await carregar();
}

// ------------------------------ Relatórios ------------------------------
async function telaBoletim(conteudo) {
  const alunos = await api('GET', '/api/alunos');
  conteudo.innerHTML = `
    <div class="painel filtros">
      <label style="flex:1;min-width:240px">Aluno
        <select id="sel-aluno"><option value="">Selecione um aluno...</option>${alunos
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          .map((a) => `<option value="${a.id_aluno}">${esc(a.ra)} — ${esc(a.nome)}</option>`).join('')}</select>
      </label>
      <label>Documento
        <select id="sel-doc"><option value="boletim">Boletim (vw_boletim)</option><option value="historico">Histórico escolar (sp_historico_aluno)</option></select>
      </label>
      <button class="btn" id="btn-imprimir">Imprimir</button>
    </div>
    <div id="relatorio"></div>`;
  const desenhar = async () => {
    const id = $('#sel-aluno').value;
    const destino = $('#relatorio');
    if (!id) { destino.innerHTML = ''; return; }
    const aluno = alunos.find((a) => String(a.id_aluno) === id);
    const cabecalho = `<div class="painel cabecalho-aluno">
      <div><span>RA</span><br><strong>${esc(aluno.ra)}</strong></div>
      <div><span>Aluno</span><br><strong>${esc(aluno.nome)}</strong></div>
      <div><span>Curso</span><br><strong>${esc(aluno.curso)}</strong></div>
      <div><span>Status</span><br>${FORMATOS.etiqueta(aluno.status)}</div>
      <div><span>CR</span><br><strong>${FORMATOS.nota(aluno.cr)}</strong></div></div>`;
    try {
      if ($('#sel-doc').value === 'boletim') {
        const linhas = await api('GET', `/api/relatorios/boletim/${id}`);
        destino.innerHTML = cabecalho + tabela([
          { c: 'disciplina', t: 'Disciplina' }, { c: 'semestre', t: 'Semestre' }, { c: 'n1', t: 'N1', f: 'nota' },
          { c: 'n2', t: 'N2', f: 'nota' }, { c: 'exame', t: 'Exame', f: 'nota' }, { c: 'media_final', t: 'Média final', f: 'nota' },
          { c: 'faltas', t: 'Faltas', f: 'num' }, { c: 'frequencia', t: 'Frequência', f: 'pct' }, { c: 'situacao', t: 'Situação', f: 'etiqueta' },
        ], linhas.sort((a, b) => a.semestre.localeCompare(b.semestre)));
      } else {
        const linhas = await api('GET', `/api/relatorios/historico/${id}`);
        destino.innerHTML = cabecalho + tabela([
          { c: 'semestre', t: 'Semestre' }, { c: 'periodo', t: 'Período', f: 'num' }, { c: 'disciplina', t: 'Disciplina' },
          { c: 'carga_horaria', t: 'CH', f: 'num' }, { c: 'professor', t: 'Professor' }, { c: 'media_final', t: 'Média', f: 'nota' },
          { c: 'frequencia', t: 'Frequência', f: 'pct' }, { c: 'situacao', t: 'Situação', f: 'etiqueta' },
        ], linhas);
      }
    } catch (erro) { destino.innerHTML = `<p class="erro">${esc(erro.message)}</p>`; }
  };
  $('#sel-aluno').onchange = desenhar;
  $('#sel-doc').onchange = desenhar;
  $('#btn-imprimir').onclick = () => window.print();
}

const telaRelatorio = (url, colunas, extra) => async (conteudo) => {
  const linhas = await api('GET', url);
  conteudo.innerHTML = (extra ? extra(linhas) : '') + tabela(colunas, linhas);
};

const cards = (itens) => `<div class="cards">${itens.map(([t, v]) => `<div class="card"><small>${esc(t)}</small><strong>${v}</strong></div>`).join('')}</div>`;

async function telaFecharSemestre(conteudo) {
  const turmas = await api('GET', '/api/turmas');
  const abertos = [...new Set(turmas.filter((t) => t.status === 'Aberta').map((t) => t.semestre))].sort();
  conteudo.innerHTML = `
    <div class="painel">
      <p>Encerra em lote todas as turmas abertas do semestre (procedure <code>sp_fechar_semestre</code>, com cursor e transação).
      Matrículas ainda "Em Exame" ou sem notas são finalizadas como reprovadas. Após o encerramento, as notas não podem mais ser alteradas.</p>
      <form id="form-fechar" class="filtros">
        <label>Semestre<select name="semestre" required><option value="">Selecione...</option>${abertos.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
        <button class="btn primario">Fechar semestre</button>
      </form>
      <div id="previa"></div>
    </div>`;
  const form = $('#form-fechar');
  form.semestre.onchange = () => {
    const doSemestre = turmas.filter((t) => t.semestre === form.semestre.value && t.status === 'Aberta');
    $('#previa').innerHTML = doSemestre.length ? `<h4>Turmas que serão encerradas</h4>${tabela([
      { c: 'descricao', t: 'Turma' }, { c: 'professor', t: 'Professor' }, { c: 'matriculados', t: 'Matriculados', f: 'num' },
    ], doSemestre)}` : '';
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const semestre = form.semestre.value;
    if (!confirm(`Encerrar todas as turmas abertas de ${semestre}? Esta operação não pode ser desfeita.`)) return;
    try {
      const r = await api('POST', '/api/semestre/fechar', { semestre });
      toast(`Semestre ${r.semestre} fechado: ${r.turmas_encerradas} turma(s) encerrada(s), ${r.matriculas_finalizadas_automaticamente} matrícula(s) finalizada(s).`);
      await telas.fechar.abrir();
    } catch (erro) { toast(erro.message, true); }
  };
}

// ------------------------------ Telas e menu (por perfil) ------------------------------
const telas = {
  alunos: { grupo: 'Secretaria', titulo: 'Alunos', perfis: TODOS, render: telaCrud(CRUD.alunos) },
  matriculas: { grupo: 'Secretaria', titulo: 'Matrículas e notas', perfis: TODOS, render: telaMatriculas() },
  turmas: { grupo: 'Secretaria', titulo: 'Turmas', perfis: TODOS, render: telaCrud(CRUD.turmas) },
  boletim: { grupo: 'Secretaria', titulo: 'Boletim e histórico', perfis: TODOS, render: telaBoletim },
  lotacao: {
    grupo: 'Secretaria', titulo: 'Lotação das turmas', perfis: TODOS,
    render: telaRelatorio('/api/relatorios/lotacao', [
      { c: 'turma', t: 'Turma' }, { c: 'professor', t: 'Professor' }, { c: 'status', t: 'Status', f: 'etiqueta' },
      { c: 'vagas_totais', t: 'Vagas', f: 'num' }, { c: 'matriculados', t: 'Matriculados', f: 'num' },
      { c: 'vagas_restantes', t: 'Restantes', f: 'num' }, { c: 'perc_ocupacao', t: 'Ocupação', f: 'ocupacao' },
    ]),
  },
  cursos: { grupo: 'Coordenação', titulo: 'Cursos', perfis: [COORD], render: telaCrud(CRUD.cursos) },
  disciplinas: { grupo: 'Coordenação', titulo: 'Disciplinas', perfis: [COORD], render: telaCrud(CRUD.disciplinas) },
  prerequisitos: { grupo: 'Coordenação', titulo: 'Pré-requisitos', perfis: [COORD], render: telaPreRequisitos },
  professores: { grupo: 'Coordenação', titulo: 'Professores', perfis: [COORD], render: telaCrud(CRUD.professores) },
  usuarios: { grupo: 'Coordenação', titulo: 'Usuários', perfis: [COORD], render: telaCrud(CRUD.usuarios) },
  fechar: { grupo: 'Coordenação', titulo: 'Fechar semestre', perfis: [COORD], render: telaFecharSemestre },
  desempenho: {
    grupo: 'Relatórios avançados', titulo: 'Desempenho por turma', perfis: [COORD],
    render: telaRelatorio('/api/relatorios/desempenho', [
      { c: 'turma', t: 'Turma' }, { c: 'total_alunos', t: 'Alunos', f: 'num' }, { c: 'media_global', t: 'Média global', f: 'nota' },
      { c: 'maior_nota', t: 'Maior', f: 'nota' }, { c: 'menor_nota', t: 'Menor', f: 'nota' },
      { c: 'perc_aprovados', t: '% aprovados', f: 'pct' }, { c: 'perc_reprovados', t: '% reprovados', f: 'pct' },
    ]),
  },
  faturamento: {
    grupo: 'Relatórios avançados', titulo: 'Faturamento por curso', perfis: [COORD],
    render: telaRelatorio('/api/relatorios/faturamento', [
      { c: 'curso', t: 'Curso' }, { c: 'turno', t: 'Turno' }, { c: 'valor_mensalidade', t: 'Mensalidade', f: 'moeda' },
      { c: 'alunos_ativos', t: 'Alunos ativos', f: 'num' }, { c: 'faturamento_mensal', t: 'Mensal', f: 'moeda' },
      { c: 'faturamento_semestral', t: 'Semestral', f: 'moeda' },
    ], (l) => cards([
      ['Alunos ativos', l.reduce((s, x) => s + x.alunos_ativos, 0)],
      ['Faturamento mensal', FORMATOS.moeda(l.reduce((s, x) => s + Number(x.faturamento_mensal), 0))],
      ['Faturamento semestral', FORMATOS.moeda(l.reduce((s, x) => s + Number(x.faturamento_semestral), 0))],
    ])),
  },
  auditoria: {
    grupo: 'Relatórios avançados', titulo: 'Auditoria de notas', perfis: [COORD],
    render: telaRelatorio('/api/relatorios/auditoria', [
      { c: 'data_hora', t: 'Data/hora', f: 'datahora' }, { c: 'aluno', t: 'Aluno' }, { c: 'disciplina', t: 'Disciplina' },
      { c: 'semestre', t: 'Semestre' }, { c: 'campo', t: 'Campo' }, { c: 'valor_antigo', t: 'De' },
      { c: 'valor_novo', t: 'Para' }, { c: 'usuario', t: 'Usuário' },
    ]),
  },
};

for (const [chave, tela] of Object.entries(telas)) {
  tela.abrir = async () => {
    telaAtual = chave;
    $('#titulo').textContent = tela.titulo;
    const acoesTopo = $('#acoes-topo');
    const conteudo = $('#conteudo');
    acoesTopo.innerHTML = '';
    conteudo.innerHTML = '<div class="vazio">Carregando...</div>';
    document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === chave));
    $('#tela-app').classList.remove('menu-aberto');
    try {
      await tela.render(conteudo, acoesTopo);
    } catch (erro) {
      conteudo.innerHTML = `<p class="erro">${esc(erro.message)}</p>`;
    }
  };
}

function montarMenu() {
  const nav = $('#menu');
  nav.innerHTML = '';
  let grupoAtual = null;
  for (const [chave, tela] of Object.entries(telas)) {
    if (!tela.perfis.includes(usuario.perfil)) continue;
    if (tela.grupo !== grupoAtual) {
      grupoAtual = tela.grupo;
      nav.insertAdjacentHTML('beforeend', `<div class="grupo">${esc(grupoAtual)}</div>`);
    }
    const a = document.createElement('a');
    a.href = `#${chave}`;
    a.dataset.tela = chave;
    a.textContent = tela.titulo;
    nav.append(a);
  }
}

function rotear() {
  const chave = location.hash.slice(1);
  const tela = telas[chave];
  if (tela && tela.perfis.includes(usuario.perfil)) tela.abrir();
  else location.hash = '#alunos';
}

// ------------------------------ Login / sessão ------------------------------
function mostrarLogin() {
  usuario = null;
  $('#tela-app').hidden = true;
  $('#tela-login').hidden = false;
}

function entrar(dados) {
  usuario = dados;
  $('#usuario-nome').textContent = usuario.nome;
  $('#usuario-perfil').textContent = usuario.perfil === SECR ? 'Secretário' : usuario.perfil;
  $('#tela-login').hidden = true;
  $('#tela-app').hidden = false;
  montarMenu();
  rotear();
}

$('#form-login').onsubmit = async (ev) => {
  ev.preventDefault();
  $('#login-erro').textContent = '';
  try {
    entrar(await api('POST', '/api/login', Object.fromEntries(new FormData(ev.target).entries())));
    ev.target.reset();
  } catch (erro) {
    $('#login-erro').textContent = erro.message;
  }
};
$('#btn-sair').onclick = async () => { await api('POST', '/api/logout'); location.hash = ''; mostrarLogin(); };
$('#btn-menu').onclick = () => $('#tela-app').classList.toggle('menu-aberto');
window.addEventListener('hashchange', () => { if (usuario) rotear(); });

api('GET', '/api/me').then(entrar).catch(mostrarLogin);
