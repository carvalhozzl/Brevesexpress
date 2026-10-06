# SGA — Sistema de Gestão Acadêmica (Faculdade do Bug Infinito)

O trabalho final de LBD tem duas partes: um banco **MySQL 8** e uma interface web em **Node.js**. O enunciado proíbe PHP, e a interface não usa.
A interface só conversa com o banco por **Stored Procedures** (`CALL`) e **Views** (`SELECT` em view). Nenhum `INSERT`, `UPDATE` ou `DELETE` sai da aplicação.

```
sga/
├── database/
│   ├── 01_estrutura.sql    tabelas, constraints (PK, FK, UNIQUE, CHECK) e índices
│   ├── 02_programacao.sql  functions, triggers, views e procedures (regras + CRUD)
│   ├── 03_dados.sql        massa de dados (5 usuários, 3 cursos, 6 disciplinas,
│   │                       5 professores, 20 alunos, 5 turmas, 35 matrículas)
│   └── 04_testes.sql       roteiro de testes obrigatórios
├── public/                 front-end (HTML + CSS + JavaScript puro)
├── server.js               servidor Express (API + controle de sessão e perfil)
└── package.json            dependências
```

## Como executar

1. **Banco de dados**: no MySQL Workbench (ou `mysql` no terminal), execute os scripts nesta ordem:
   `01_estrutura.sql` → `02_programacao.sql` → `03_dados.sql`. Depois rode `04_testes.sql` para ver os testes.
   > O `04_testes.sql` altera notas e cria uma turma de teste. Para voltar ao estado inicial, rode de novo os scripts 01 a 03.

2. **Interface** (exige Node.js 18 ou mais recente):
   ```bash
   cd sga
   npm install
   # Linux/macOS
   DB_USER=root DB_PASSWORD=sua_senha npm start
   # Windows (PowerShell)
   $env:DB_USER="root"; $env:DB_PASSWORD="sua_senha"; npm start
   ```
   Depois abra http://localhost:3000.

   Variáveis de ambiente aceitas: `DB_HOST` (padrão `localhost`), `DB_PORT` (`3306`), `DB_USER` (`root`),
   `DB_PASSWORD` (vazia), `DB_NAME` (`sga_fbi`), `PORT` (`3000`) e `SESSION_SECRET`.

### Usuários de exemplo (senha `fbi@2026` para todos)

| Login          | Perfil      |
|----------------|-------------|
| `ana.coord`    | Coordenador |
| `carlos.coord` | Coordenador |
| `beatriz.sec`  | Secretário  |
| `diego.sec`    | Secretário  |
| `elisa.sec`    | Secretário  |

## Segurança

- **Senha com hash**: a aplicação calcula o SHA-256 da senha digitada e manda só o hash para `sp_LoginUsuario`.
  A tabela `usuario` guarda apenas `senha_hash CHAR(64)`. A view `vw_usuarios` não expõe esse campo.
- **Perfis verificados em duas camadas**:
  1. A API (`server.js`) bloqueia as rotas pelo perfil gravado na sessão.
  2. As próprias procedures validam o perfil por meio de `sp_valida_coordenador` e `sp_valida_usuario`.
     Assim, quem chamar o banco direto também não consegue fazer o que o perfil não permite.
- **SQL parametrizado**: todos os valores vão como parâmetros `?`. Os nomes de procedures e views ficam numa lista fixa no servidor.

## CRUD e permissões

| Cadastro / função                 | Secretário            | Coordenador | Procedures / views                                   |
|-----------------------------------|-----------------------|-------------|------------------------------------------------------|
| Alunos                            | incluir, alterar, excluir | tudo    | `sp_aluno_inserir/atualizar/excluir`, `vw_alunos`    |
| Matrículas                        | matricular, cancelar  | tudo        | `sp_matricular_aluno`, `sp_matricula_cancelar`, `vw_matriculas` |
| Lançar notas e exame              | —                     | ✔           | `sp_lancar_notas`, `sp_lancar_exame`                 |
| Turmas                            | só consulta           | CRUD        | `sp_turma_*`, `vw_turmas`                            |
| Cursos, disciplinas, pré-requisitos, professores, usuários | — | CRUD | `sp_curso_*`, `sp_disciplina_*`, `sp_prerequisito_*`, `sp_professor_*`, `sp_usuario_*` |
| Boletim e histórico               | ✔                     | ✔           | `vw_boletim`, `sp_historico_aluno`                   |
| Lotação das turmas                | ✔                     | ✔           | `vw_turmas_lotacao`                                  |
| Desempenho, faturamento, auditoria | —                    | ✔           | `vw_desempenho_turma`, `vw_faturamento_curso`, `vw_log_nota` |
| Fechar semestre                   | —                     | ✔           | `sp_fechar_semestre` (cursor + transação)            |

As exclusões que deixariam o histórico inconsistente são bloqueadas com uma mensagem clara. Exemplos:

- aluno com matrículas: o sistema sugere trocar o status para *Trancado*;
- curso com alunos;
- turma com matrículas.

## Regras de negócio implementadas no banco

- **RN01, RN03**: `fn_calcular_media`.
- **RN02, RN03, RN04**: `fn_situacao`, que usa a função auxiliar `fn_situacao_calc`.
- **Frequência**: `fn_frequencia`. **Coeficiente de rendimento**: `fn_cr_aluno`.
- **RN05**:
  - `trg_valida_vagas` bloqueia matrícula em turma lotada (BEFORE INSERT);
  - `sp_matricular_aluno` faz a mesma verificação.
- **RN06, RN09**: `sp_matricular_aluno`, com `SIGNAL SQLSTATE '45000'`.
- **RN07**: CHECK constraints nas colunas `n1`, `n2`, `exame` e `media_final`.
- **RN08**: `trg_auditoria_nota` (AFTER UPDATE) grava em `log_nota` o login de quem alterou a nota.
- **Média e situação automáticas**: o trigger `trg_atualiza_situacao` (BEFORE UPDATE) recalcula as duas.
  Na carga de dados, quem faz isso é o `trg_situacao_insert`.

### Escolhas além do enunciado

- **`curso.valor_mensalidade`**: o relatório de faturamento por curso precisa de um valor de mensalidade, e o enunciado não traz esse campo.
- **`turma.status`** (`Aberta` / `Encerrada`): o `sp_fechar_semestre` usa esse campo. Depois de encerrada, a turma não aceita matrículas e as notas não podem ser alteradas.
- **Fechamento do semestre**: quem continua "Em Exame" sem nota de exame, ou sem notas lançadas, sai como reprovado.
