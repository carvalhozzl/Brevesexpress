-- =====================================================================
--  SGA - Sistema de Gestão Acadêmica | Faculdade do Bug Infinito (FBI)
--  03_dados.sql -> Massa de dados de exemplo
--  5 usuários, 3 cursos, 6 disciplinas, 5 professores, 20 alunos,
--  5 turmas e 35 matrículas.
--
--  Senha de TODOS os usuários de exemplo: fbi@2026
--  (armazenada apenas como hash SHA-256 - nunca em texto puro)
-- =====================================================================
USE sga_fbi;
SET NAMES utf8mb4;

-- Usuários: 2 Coordenadores e 3 Secretários
INSERT INTO usuario (nome, cpf, email, login, senha_hash, perfil) VALUES
('Ana Paula Ribeiro',   '11122233344', 'ana.ribeiro@fbi.edu.br',    'ana.coord',     SHA2('fbi@2026', 256), 'Coordenador'),
('Carlos Eduardo Lima', '22233344455', 'carlos.lima@fbi.edu.br',    'carlos.coord',  SHA2('fbi@2026', 256), 'Coordenador'),
('Beatriz Souza',       '33344455566', 'beatriz.souza@fbi.edu.br',  'beatriz.sec',   SHA2('fbi@2026', 256), 'Secretario'),
('Diego Martins',       '44455566677', 'diego.martins@fbi.edu.br',  'diego.sec',     SHA2('fbi@2026', 256), 'Secretario'),
('Elisa Fernandes',     '55566677788', 'elisa.fernandes@fbi.edu.br','elisa.sec',     SHA2('fbi@2026', 256), 'Secretario');

-- Cursos
INSERT INTO curso (nome, carga_horaria_total, turno, valor_mensalidade) VALUES
('Sistemas de Informação', 3000, 'Noturno',    890.00),
('Ciências Contábeis',     3000, 'Matutino',   750.00),
('Enfermagem',             4000, 'Vespertino', 1250.00);

-- Disciplinas
INSERT INTO disciplina (id_curso, nome, carga_horaria, periodo) VALUES
(1, 'Algoritmos e Lógica de Programação', 80, 1),   -- 1
(1, 'Estruturas de Dados',                80, 2),   -- 2 (pré-req: 1)
(1, 'Banco de Dados I',                   80, 2),   -- 3
(1, 'Banco de Dados II',                  80, 3),   -- 4 (pré-req: 3)
(2, 'Contabilidade Geral',                60, 1),   -- 5
(3, 'Anatomia Humana',                    60, 1);   -- 6

-- Pré-requisitos (autorrelacionamento)
INSERT INTO pre_requisito (id_disciplina, id_disciplina_requisito) VALUES
(2, 1),
(4, 3);

-- Professores
INSERT INTO professor (nome, cpf, email, titulacao, data_admissao) VALUES
('Roberto Almeida',   '60011122233', 'roberto.almeida@fbi.edu.br',  'Doutor',       '2015-02-01'),
('Juliana Castro',    '60022233344', 'juliana.castro@fbi.edu.br',   'Mestre',       '2018-08-01'),
('Marcos Vinícius',   '60033344455', 'marcos.vinicius@fbi.edu.br',  'Mestre',       '2019-02-01'),
('Patrícia Gomes',    '60044455566', 'patricia.gomes@fbi.edu.br',   'Especialista', '2020-08-01'),
('Fernando Teixeira', '60055566677', 'fernando.teixeira@fbi.edu.br','Doutor',       '2012-03-01');

-- Alunos (12 de SI, 5 de Contábeis, 3 de Enfermagem)
INSERT INTO aluno (ra, nome, cpf, email, data_nascimento, id_curso, status) VALUES
('2025001', 'Lucas Oliveira',      '70000000001', 'lucas.oliveira@aluno.fbi.edu.br',    '2005-03-12', 1, 'Ativo'),
('2025002', 'Mariana Santos',      '70000000002', 'mariana.santos@aluno.fbi.edu.br',    '2004-07-22', 1, 'Ativo'),
('2025003', 'Pedro Henrique Costa','70000000003', 'pedro.costa@aluno.fbi.edu.br',       '2005-01-05', 1, 'Ativo'),
('2025004', 'Gabriela Rocha',      '70000000004', 'gabriela.rocha@aluno.fbi.edu.br',    '2003-11-30', 1, 'Ativo'),
('2025005', 'Rafael Pereira',      '70000000005', 'rafael.pereira@aluno.fbi.edu.br',    '2004-05-18', 1, 'Ativo'),
('2025006', 'Camila Barbosa',      '70000000006', 'camila.barbosa@aluno.fbi.edu.br',    '2005-09-09', 1, 'Ativo'),
('2025007', 'Thiago Mendes',       '70000000007', 'thiago.mendes@aluno.fbi.edu.br',     '2004-02-14', 1, 'Ativo'),
('2025008', 'Larissa Cardoso',     '70000000008', 'larissa.cardoso@aluno.fbi.edu.br',   '2005-06-25', 1, 'Ativo'),
('2025009', 'Bruno Araújo',        '70000000009', 'bruno.araujo@aluno.fbi.edu.br',      '2003-10-01', 1, 'Ativo'),
('2025010', 'Isabela Freitas',     '70000000010', 'isabela.freitas@aluno.fbi.edu.br',   '2004-12-19', 1, 'Ativo'),
('2026001', 'Gustavo Nunes',       '70000000011', 'gustavo.nunes@aluno.fbi.edu.br',     '2006-04-03', 1, 'Ativo'),
('2026002', 'Fernanda Moreira',    '70000000012', 'fernanda.moreira@aluno.fbi.edu.br',  '2005-08-27', 1, 'Trancado'),
('2026003', 'Vinícius Ramos',      '70000000013', 'vinicius.ramos@aluno.fbi.edu.br',    '2006-01-15', 2, 'Ativo'),
('2026004', 'Amanda Correia',      '70000000014', 'amanda.correia@aluno.fbi.edu.br',    '2005-03-08', 2, 'Ativo'),
('2026005', 'Felipe Duarte',       '70000000015', 'felipe.duarte@aluno.fbi.edu.br',     '2004-09-21', 2, 'Ativo'),
('2026006', 'Juliana Pires',       '70000000016', 'juliana.pires@aluno.fbi.edu.br',     '2006-07-11', 2, 'Ativo'),
('2026007', 'Rodrigo Batista',     '70000000017', 'rodrigo.batista@aluno.fbi.edu.br',   '2005-05-29', 2, 'Ativo'),
('2026008', 'Letícia Monteiro',    '70000000018', 'leticia.monteiro@aluno.fbi.edu.br',  '2006-02-02', 3, 'Ativo'),
('2026009', 'Matheus Carvalho',    '70000000019', 'matheus.carvalho@aluno.fbi.edu.br',  '2005-10-17', 3, 'Ativo'),
('2026010', 'Beatriz Lopes',       '70000000020', 'beatriz.lopes@aluno.fbi.edu.br',     '2006-12-06', 3, 'Ativo');

-- Turmas
INSERT INTO turma (id_disciplina, id_professor, semestre, vagas, total_aulas, status) VALUES
(1, 1, '2025.2', 10, 40, 'Aberta'),   -- T001 Algoritmos (semestre anterior, encerrada abaixo)
(3, 2, '2026.2', 12, 40, 'Aberta'),   -- T002 Banco de Dados I
(2, 3, '2026.2', 10, 40, 'Aberta'),   -- T003 Estruturas de Dados (pré-req: Algoritmos)
(5, 4, '2026.2',  8, 60, 'Aberta'),   -- T004 Contabilidade Geral
(6, 5, '2026.2',  3, 60, 'Aberta');   -- T005 Anatomia Humana (ficará lotada)

-- Matrículas (média final e situação calculadas automaticamente por trigger)
-- T001 - Algoritmos 2025.2: 10 matrículas
INSERT INTO matricula (id_aluno, id_turma, data_matricula, n1, n2, exame, faltas, id_usuario) VALUES
( 1, 1, '2025-08-01 09:00:00',  8.0,  9.0, NULL,  2, 3),
( 2, 1, '2025-08-01 09:05:00',  7.0,  7.5, NULL,  4, 3),
( 3, 1, '2025-08-01 09:10:00',  9.0, 10.0, NULL,  0, 3),
( 4, 1, '2025-08-01 09:15:00',  6.0,  8.0, NULL,  6, 4),
( 5, 1, '2025-08-01 09:20:00',  5.0,  6.0,  7.0,  3, 4),
( 6, 1, '2025-08-01 09:25:00',  8.0,  7.0, NULL,  5, 4),
( 7, 1, '2025-08-01 09:30:00',  7.0,  8.0, NULL,  1, 5),
( 8, 1, '2025-08-01 09:35:00', 10.0,  9.0, NULL,  0, 5),
( 9, 1, '2025-08-01 09:40:00',  3.0,  2.0, NULL,  8, 5),
(10, 1, '2025-08-01 09:45:00',  8.0,  8.0, NULL, 15, 3);

-- T002 - Banco de Dados I 2026.2: 9 matrículas
INSERT INTO matricula (id_aluno, id_turma, data_matricula, n1, n2, exame, faltas, id_usuario) VALUES
( 1, 2, '2026-08-03 10:00:00', 8.0, 7.0, NULL, 2, 3),
( 2, 2, '2026-08-03 10:05:00', 5.0, 6.0, NULL, 4, 3),
( 3, 2, '2026-08-03 10:10:00', 9.0, 9.0, NULL, 0, 3),
( 4, 2, '2026-08-03 10:15:00', NULL, NULL, NULL, 0, 4),
( 5, 2, '2026-08-03 10:20:00', NULL, NULL, NULL, 0, 4),
( 6, 2, '2026-08-03 10:25:00', NULL, NULL, NULL, 0, 4),
( 7, 2, '2026-08-03 10:30:00', NULL, NULL, NULL, 0, 5),
( 8, 2, '2026-08-03 10:35:00', NULL, NULL, NULL, 0, 5),
( 9, 2, '2026-08-03 10:40:00', NULL, NULL, NULL, 0, 5);

-- T003 - Estruturas de Dados 2026.2: 8 matrículas (todos aprovados em Algoritmos)
INSERT INTO matricula (id_aluno, id_turma, data_matricula, n1, n2, exame, faltas, id_usuario) VALUES
(1, 3, '2026-08-04 08:00:00', NULL, NULL, NULL, 0, 3),
(2, 3, '2026-08-04 08:05:00', NULL, NULL, NULL, 0, 3),
(3, 3, '2026-08-04 08:10:00', NULL, NULL, NULL, 0, 3),
(4, 3, '2026-08-04 08:15:00', NULL, NULL, NULL, 0, 4),
(5, 3, '2026-08-04 08:20:00', NULL, NULL, NULL, 0, 4),
(6, 3, '2026-08-04 08:25:00', NULL, NULL, NULL, 0, 4),
(7, 3, '2026-08-04 08:30:00', NULL, NULL, NULL, 0, 5),
(8, 3, '2026-08-04 08:35:00', NULL, NULL, NULL, 0, 5);

-- T004 - Contabilidade Geral 2026.2: 5 matrículas
INSERT INTO matricula (id_aluno, id_turma, data_matricula, n1, n2, exame, faltas, id_usuario) VALUES
(13, 4, '2026-08-05 07:30:00', 7.5, 8.0, NULL,  3, 4),
(14, 4, '2026-08-05 07:35:00', 4.0, 5.0, NULL,  6, 4),
(15, 4, '2026-08-05 07:40:00', 2.5, 3.0, NULL, 10, 4),
(16, 4, '2026-08-05 07:45:00', 9.5, 9.0, NULL, 20, 5),
(17, 4, '2026-08-05 07:50:00', NULL, NULL, NULL, 0, 5);

-- T005 - Anatomia Humana 2026.2: 3 matrículas (turma lotada: 3/3)
INSERT INTO matricula (id_aluno, id_turma, data_matricula, n1, n2, exame, faltas, id_usuario) VALUES
(18, 5, '2026-08-06 13:00:00', NULL, NULL, NULL, 0, 3),
(19, 5, '2026-08-06 13:05:00', NULL, NULL, NULL, 0, 3),
(20, 5, '2026-08-06 13:10:00', NULL, NULL, NULL, 0, 3);

-- Turma do semestre anterior já encerrada
UPDATE turma SET status = 'Encerrada' WHERE id_turma = 1;
