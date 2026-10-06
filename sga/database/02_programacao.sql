-- =====================================================================
--  SGA - Sistema de Gestão Acadêmica | Faculdade do Bug Infinito (FBI)
--  02_programacao.sql -> Functions, Triggers, Views e Stored Procedures
--  (inclui as procedures de CRUD usadas pela interface)
-- =====================================================================
USE sga_fbi;
SET NAMES utf8mb4;

DELIMITER $$

-- =====================================================================
-- 1. USER-DEFINED FUNCTIONS
-- =====================================================================

-- RN01 / RN03: média parcial (sem exame) ou média final (com exame)
DROP FUNCTION IF EXISTS fn_calcular_media $$
CREATE FUNCTION fn_calcular_media(p_n1 DECIMAL(4,2), p_n2 DECIMAL(4,2), p_exame DECIMAL(4,2))
RETURNS DECIMAL(4,2)
DETERMINISTIC
BEGIN
    DECLARE v_parcial DECIMAL(6,3);
    IF p_n1 IS NULL OR p_n2 IS NULL THEN
        RETURN NULL;
    END IF;
    SET v_parcial = (p_n1 + p_n2) / 2;                       -- RN01
    IF p_exame IS NULL OR v_parcial >= 7.0 OR v_parcial < 4.0 THEN
        RETURN ROUND(v_parcial, 2);
    END IF;
    RETURN ROUND((v_parcial + p_exame) / 2, 2);              -- RN03
END $$

-- Auxiliar: percentual de presença a partir de total de aulas e faltas
DROP FUNCTION IF EXISTS fn_frequencia_calc $$
CREATE FUNCTION fn_frequencia_calc(p_total_aulas INT, p_faltas INT)
RETURNS DECIMAL(5,2)
DETERMINISTIC
BEGIN
    IF p_total_aulas IS NULL OR p_total_aulas <= 0 THEN
        RETURN NULL;
    END IF;
    RETURN ROUND(((p_total_aulas - IFNULL(p_faltas, 0)) / p_total_aulas) * 100, 2);
END $$

-- fn_frequencia: ((total_aulas - faltas) / total_aulas) * 100
DROP FUNCTION IF EXISTS fn_frequencia $$
CREATE FUNCTION fn_frequencia(p_id_matricula INT)
RETURNS DECIMAL(5,2)
READS SQL DATA
BEGIN
    DECLARE v_total INT;
    DECLARE v_faltas INT;
    SELECT t.total_aulas, m.faltas INTO v_total, v_faltas
      FROM matricula m
      JOIN turma t ON t.id_turma = m.id_turma
     WHERE m.id_matricula = p_id_matricula;
    RETURN fn_frequencia_calc(v_total, v_faltas);
END $$

-- Auxiliar: regra de situação a partir dos valores (usada também pelos triggers,
-- que não podem reler a própria linha que está sendo alterada)
DROP FUNCTION IF EXISTS fn_situacao_calc $$
CREATE FUNCTION fn_situacao_calc(p_n1 DECIMAL(4,2), p_n2 DECIMAL(4,2), p_exame DECIMAL(4,2),
                                 p_faltas INT, p_total_aulas INT)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE v_parcial DECIMAL(6,3);
    IF p_n1 IS NULL OR p_n2 IS NULL THEN
        RETURN 'Cursando';
    END IF;
    IF fn_frequencia_calc(p_total_aulas, p_faltas) < 75 THEN  -- RN04 (prevalece sobre as notas)
        RETURN 'Reprovado por Falta';
    END IF;
    SET v_parcial = (p_n1 + p_n2) / 2;
    IF v_parcial >= 7.0 THEN RETURN 'Aprovado'; END IF;       -- RN02
    IF v_parcial < 4.0  THEN RETURN 'Reprovado por Nota'; END IF;
    IF p_exame IS NULL  THEN RETURN 'Em Exame'; END IF;
    IF fn_calcular_media(p_n1, p_n2, p_exame) >= 5.0 THEN     -- RN03
        RETURN 'Aprovado';
    END IF;
    RETURN 'Reprovado por Nota';
END $$

-- fn_situacao: combina RN02, RN03 e RN04
DROP FUNCTION IF EXISTS fn_situacao $$
CREATE FUNCTION fn_situacao(p_id_matricula INT)
RETURNS VARCHAR(20)
READS SQL DATA
BEGIN
    DECLARE v_n1, v_n2, v_exame DECIMAL(4,2);
    DECLARE v_faltas, v_total INT;
    SELECT m.n1, m.n2, m.exame, m.faltas, t.total_aulas
      INTO v_n1, v_n2, v_exame, v_faltas, v_total
      FROM matricula m
      JOIN turma t ON t.id_turma = m.id_turma
     WHERE m.id_matricula = p_id_matricula;
    RETURN fn_situacao_calc(v_n1, v_n2, v_exame, v_faltas, v_total);
END $$

-- fn_cr_aluno (opcional): coeficiente de rendimento ponderado pela carga horária
DROP FUNCTION IF EXISTS fn_cr_aluno $$
CREATE FUNCTION fn_cr_aluno(p_id_aluno INT)
RETURNS DECIMAL(4,2)
READS SQL DATA
BEGIN
    DECLARE v_cr DECIMAL(6,3);
    SELECT SUM(m.media_final * d.carga_horaria) / SUM(d.carga_horaria) INTO v_cr
      FROM matricula m
      JOIN turma t      ON t.id_turma = m.id_turma
      JOIN disciplina d ON d.id_disciplina = t.id_disciplina
     WHERE m.id_aluno = p_id_aluno
       AND m.media_final IS NOT NULL
       AND m.situacao IN ('Aprovado', 'Reprovado por Nota', 'Reprovado por Falta');
    RETURN ROUND(v_cr, 2);
END $$

-- =====================================================================
-- 2. TRIGGERS
-- =====================================================================

-- RN05: bloqueia matrícula em turma lotada
DROP TRIGGER IF EXISTS trg_valida_vagas $$
CREATE TRIGGER trg_valida_vagas
BEFORE INSERT ON matricula
FOR EACH ROW
BEGIN
    DECLARE v_vagas INT;
    DECLARE v_ocupadas INT;
    SELECT vagas INTO v_vagas FROM turma WHERE id_turma = NEW.id_turma;
    SELECT COUNT(*) INTO v_ocupadas FROM matricula WHERE id_turma = NEW.id_turma;
    IF v_ocupadas >= v_vagas THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN05: Turma lotada. Limite maximo de vagas atingido.';
    END IF;
END $$

-- Calcula média e situação também na inserção (ex.: carga de dados históricos)
DROP TRIGGER IF EXISTS trg_situacao_insert $$
CREATE TRIGGER trg_situacao_insert
BEFORE INSERT ON matricula
FOR EACH ROW FOLLOWS trg_valida_vagas
BEGIN
    DECLARE v_total INT;
    SELECT total_aulas INTO v_total FROM turma WHERE id_turma = NEW.id_turma;
    SET NEW.media_final = fn_calcular_media(NEW.n1, NEW.n2, NEW.exame);
    SET NEW.situacao    = fn_situacao_calc(NEW.n1, NEW.n2, NEW.exame, NEW.faltas, v_total);
END $$

-- Recalcula automaticamente média final e situação quando notas/faltas mudam.
-- Se apenas a situação for alterada (fechamento de semestre), o valor informado é mantido.
DROP TRIGGER IF EXISTS trg_atualiza_situacao $$
CREATE TRIGGER trg_atualiza_situacao
BEFORE UPDATE ON matricula
FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    IF NOT (NEW.n1 <=> OLD.n1) OR NOT (NEW.n2 <=> OLD.n2)
       OR NOT (NEW.exame <=> OLD.exame) OR NOT (NEW.faltas <=> OLD.faltas) THEN
        SELECT total_aulas INTO v_total FROM turma WHERE id_turma = NEW.id_turma;
        SET NEW.media_final = fn_calcular_media(NEW.n1, NEW.n2, NEW.exame);
        SET NEW.situacao    = fn_situacao_calc(NEW.n1, NEW.n2, NEW.exame, NEW.faltas, v_total);
    END IF;
END $$

-- RN08: auditoria automática de alterações de notas
DROP TRIGGER IF EXISTS trg_auditoria_nota $$
CREATE TRIGGER trg_auditoria_nota
AFTER UPDATE ON matricula
FOR EACH ROW
BEGIN
    DECLARE v_usuario VARCHAR(100);
    SET v_usuario = COALESCE(@sga_usuario, CURRENT_USER());
    IF NOT (NEW.n1 <=> OLD.n1) THEN
        INSERT INTO log_nota (id_matricula, campo, valor_antigo, valor_novo, usuario)
        VALUES (NEW.id_matricula, 'n1', OLD.n1, NEW.n1, v_usuario);
    END IF;
    IF NOT (NEW.n2 <=> OLD.n2) THEN
        INSERT INTO log_nota (id_matricula, campo, valor_antigo, valor_novo, usuario)
        VALUES (NEW.id_matricula, 'n2', OLD.n2, NEW.n2, v_usuario);
    END IF;
    IF NOT (NEW.exame <=> OLD.exame) THEN
        INSERT INTO log_nota (id_matricula, campo, valor_antigo, valor_novo, usuario)
        VALUES (NEW.id_matricula, 'exame', OLD.exame, NEW.exame, v_usuario);
    END IF;
    IF NOT (NEW.faltas <=> OLD.faltas) THEN
        INSERT INTO log_nota (id_matricula, campo, valor_antigo, valor_novo, usuario)
        VALUES (NEW.id_matricula, 'faltas', OLD.faltas, NEW.faltas, v_usuario);
    END IF;
    IF NOT (NEW.media_final <=> OLD.media_final) THEN
        INSERT INTO log_nota (id_matricula, campo, valor_antigo, valor_novo, usuario)
        VALUES (NEW.id_matricula, 'media_final', OLD.media_final, NEW.media_final, v_usuario);
    END IF;
END $$

DELIMITER ;

-- =====================================================================
-- 3. VIEWS
-- =====================================================================

-- Boletim do aluno
CREATE OR REPLACE VIEW vw_boletim AS
SELECT a.id_aluno,
       a.nome            AS aluno,
       a.ra,
       m.id_matricula,
       d.nome            AS disciplina,
       t.semestre,
       m.n1,
       m.n2,
       m.exame,
       m.media_final,
       m.faltas,
       fn_frequencia_calc(t.total_aulas, m.faltas) AS frequencia,
       m.situacao
  FROM matricula m
  JOIN aluno a      ON a.id_aluno = m.id_aluno
  JOIN turma t      ON t.id_turma = m.id_turma
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina;

-- Lotação das turmas
CREATE OR REPLACE VIEW vw_turmas_lotacao AS
SELECT t.id_turma,
       CONCAT('T', LPAD(t.id_turma, 3, '0'), ' - ', d.nome, ' (', t.semestre, ')') AS turma,
       d.nome      AS disciplina,
       p.nome      AS professor,
       t.semestre,
       t.status,
       t.vagas     AS vagas_totais,
       COUNT(m.id_matricula)           AS matriculados,
       t.vagas - COUNT(m.id_matricula) AS vagas_restantes,
       ROUND(COUNT(m.id_matricula) / t.vagas * 100, 2) AS perc_ocupacao
  FROM turma t
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina
  JOIN professor p  ON p.id_professor = t.id_professor
  LEFT JOIN matricula m ON m.id_turma = t.id_turma
 GROUP BY t.id_turma, d.nome, p.nome, t.semestre, t.status, t.vagas;

-- Desempenho das turmas
CREATE OR REPLACE VIEW vw_desempenho_turma AS
SELECT t.id_turma,
       CONCAT('T', LPAD(t.id_turma, 3, '0'), ' - ', d.nome, ' (', t.semestre, ')') AS turma,
       d.nome AS disciplina,
       t.semestre,
       COUNT(m.id_matricula)           AS total_alunos,
       ROUND(AVG(m.media_final), 2)    AS media_global,
       MAX(m.media_final)              AS maior_nota,
       MIN(m.media_final)              AS menor_nota,
       ROUND(IFNULL(SUM(m.situacao = 'Aprovado') / NULLIF(COUNT(m.id_matricula), 0) * 100, 0), 2)
                                       AS perc_aprovados,
       ROUND(IFNULL(SUM(m.situacao IN ('Reprovado por Nota', 'Reprovado por Falta'))
             / NULLIF(COUNT(m.id_matricula), 0) * 100, 0), 2)
                                       AS perc_reprovados
  FROM turma t
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina
  LEFT JOIN matricula m ON m.id_turma = t.id_turma
 GROUP BY t.id_turma, d.nome, t.semestre;

-- Faturamento financeiro por curso (somente Coordenador na interface)
CREATE OR REPLACE VIEW vw_faturamento_curso AS
SELECT c.id_curso,
       c.nome AS curso,
       c.turno,
       c.valor_mensalidade,
       COUNT(a.id_aluno)                                AS alunos_ativos,
       COUNT(a.id_aluno) * c.valor_mensalidade          AS faturamento_mensal,
       COUNT(a.id_aluno) * c.valor_mensalidade * 6      AS faturamento_semestral
  FROM curso c
  LEFT JOIN aluno a ON a.id_curso = c.id_curso AND a.status = 'Ativo'
 GROUP BY c.id_curso, c.nome, c.turno, c.valor_mensalidade;

-- ----- Views de listagem usadas pelas telas de CRUD -----

-- Usuários (nunca expõe o hash da senha)
CREATE OR REPLACE VIEW vw_usuarios AS
SELECT id_usuario, nome, cpf, email, login, perfil FROM usuario;

CREATE OR REPLACE VIEW vw_cursos AS
SELECT c.id_curso, c.nome, c.carga_horaria_total, c.turno, c.valor_mensalidade,
       (SELECT COUNT(*) FROM aluno a WHERE a.id_curso = c.id_curso)           AS total_alunos,
       (SELECT COUNT(*) FROM disciplina d WHERE d.id_curso = c.id_curso)      AS total_disciplinas
  FROM curso c;

CREATE OR REPLACE VIEW vw_disciplinas AS
SELECT d.id_disciplina, d.id_curso, c.nome AS curso, d.nome, d.carga_horaria, d.periodo,
       (SELECT GROUP_CONCAT(r.nome ORDER BY r.nome SEPARATOR ', ')
          FROM pre_requisito pr
          JOIN disciplina r ON r.id_disciplina = pr.id_disciplina_requisito
         WHERE pr.id_disciplina = d.id_disciplina) AS pre_requisitos
  FROM disciplina d
  JOIN curso c ON c.id_curso = d.id_curso;

CREATE OR REPLACE VIEW vw_pre_requisitos AS
SELECT pr.id_disciplina, d.nome AS disciplina,
       pr.id_disciplina_requisito, r.nome AS requisito,
       c.nome AS curso
  FROM pre_requisito pr
  JOIN disciplina d ON d.id_disciplina = pr.id_disciplina
  JOIN disciplina r ON r.id_disciplina = pr.id_disciplina_requisito
  JOIN curso c      ON c.id_curso = d.id_curso;

CREATE OR REPLACE VIEW vw_professores AS
SELECT id_professor, nome, cpf, email, titulacao, data_admissao FROM professor;

CREATE OR REPLACE VIEW vw_alunos AS
SELECT a.id_aluno, a.ra, a.nome, a.cpf, a.email, a.data_nascimento,
       a.id_curso, c.nome AS curso, a.status, fn_cr_aluno(a.id_aluno) AS cr
  FROM aluno a
  JOIN curso c ON c.id_curso = a.id_curso;

CREATE OR REPLACE VIEW vw_turmas AS
SELECT t.id_turma,
       CONCAT('T', LPAD(t.id_turma, 3, '0'), ' - ', d.nome, ' (', t.semestre, ')') AS descricao,
       t.id_disciplina, d.nome AS disciplina,
       t.id_professor, p.nome AS professor,
       t.semestre, t.vagas, t.total_aulas, t.status,
       (SELECT COUNT(*) FROM matricula m WHERE m.id_turma = t.id_turma) AS matriculados
  FROM turma t
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina
  JOIN professor p  ON p.id_professor = t.id_professor;

CREATE OR REPLACE VIEW vw_matriculas AS
SELECT m.id_matricula, m.id_aluno, a.ra, a.nome AS aluno,
       m.id_turma, d.nome AS disciplina, t.semestre, t.status AS status_turma,
       m.data_matricula, m.n1, m.n2, m.exame, m.faltas,
       fn_frequencia_calc(t.total_aulas, m.faltas) AS frequencia,
       m.media_final, m.situacao, u.nome AS matriculado_por
  FROM matricula m
  JOIN aluno a      ON a.id_aluno = m.id_aluno
  JOIN turma t      ON t.id_turma = m.id_turma
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina
  JOIN usuario u    ON u.id_usuario = m.id_usuario;

CREATE OR REPLACE VIEW vw_log_nota AS
SELECT l.id_log, l.id_matricula, a.nome AS aluno, d.nome AS disciplina, t.semestre,
       l.campo, l.valor_antigo, l.valor_novo, l.usuario, l.data_hora
  FROM log_nota l
  JOIN matricula m  ON m.id_matricula = l.id_matricula
  JOIN aluno a      ON a.id_aluno = m.id_aluno
  JOIN turma t      ON t.id_turma = m.id_turma
  JOIN disciplina d ON d.id_disciplina = t.id_disciplina;

DELIMITER $$

-- =====================================================================
-- 4. STORED PROCEDURES - SEGURANÇA
-- =====================================================================

-- Valida as credenciais; retorna os dados do usuário (sem a senha) ou vazio
DROP PROCEDURE IF EXISTS sp_LoginUsuario $$
CREATE PROCEDURE sp_LoginUsuario(IN p_login VARCHAR(50), IN p_senha_hash CHAR(64))
BEGIN
    SELECT id_usuario, nome, email, login, perfil
      FROM usuario
     WHERE login = p_login
       AND senha_hash = LOWER(p_senha_hash);
END $$

-- Garante que o usuário existe e registra o login na sessão (usado pela auditoria)
DROP PROCEDURE IF EXISTS sp_valida_usuario $$
CREATE PROCEDURE sp_valida_usuario(IN p_id_usuario INT)
BEGIN
    DECLARE v_login VARCHAR(50);
    SELECT login INTO v_login FROM usuario WHERE id_usuario = p_id_usuario;
    IF v_login IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario invalido ou nao autenticado.';
    END IF;
    SET @sga_usuario = v_login;
END $$

-- Garante que o usuário tem perfil Coordenador
DROP PROCEDURE IF EXISTS sp_valida_coordenador $$
CREATE PROCEDURE sp_valida_coordenador(IN p_id_usuario INT)
BEGIN
    DECLARE v_perfil VARCHAR(20);
    CALL sp_valida_usuario(p_id_usuario);
    SELECT perfil INTO v_perfil FROM usuario WHERE id_usuario = p_id_usuario;
    IF v_perfil <> 'Coordenador' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Acesso negado: operacao exclusiva do perfil Coordenador.';
    END IF;
END $$

-- =====================================================================
-- 5. STORED PROCEDURES - REGRAS ACADÊMICAS
-- =====================================================================

-- Matrícula: valida RN09, RN05 e RN06
DROP PROCEDURE IF EXISTS sp_matricular_aluno $$
CREATE PROCEDURE sp_matricular_aluno(IN p_id_aluno INT, IN p_id_turma INT, IN p_id_usuario INT)
BEGIN
    DECLARE v_status_aluno VARCHAR(10);
    DECLARE v_status_turma VARCHAR(10);
    DECLARE v_id_disciplina INT;
    DECLARE v_vagas INT;
    DECLARE v_ocupadas INT;
    DECLARE v_pendentes INT;

    CALL sp_valida_usuario(p_id_usuario);

    SELECT status INTO v_status_aluno FROM aluno WHERE id_aluno = p_id_aluno;
    IF v_status_aluno IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aluno nao encontrado.';
    END IF;
    IF v_status_aluno IN ('Trancado', 'Formado') THEN                       -- RN09
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN09: Aluno com status Trancado ou Formado nao pode se matricular.';
    END IF;

    SELECT id_disciplina, vagas, status INTO v_id_disciplina, v_vagas, v_status_turma
      FROM turma WHERE id_turma = p_id_turma;
    IF v_id_disciplina IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma nao encontrada.';
    END IF;
    IF v_status_turma = 'Encerrada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma encerrada: nao aceita novas matriculas.';
    END IF;
    IF EXISTS (SELECT 1 FROM matricula WHERE id_aluno = p_id_aluno AND id_turma = p_id_turma) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aluno ja matriculado nesta turma.';
    END IF;

    SELECT COUNT(*) INTO v_ocupadas FROM matricula WHERE id_turma = p_id_turma;
    IF v_ocupadas >= v_vagas THEN                                            -- RN05
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN05: Turma lotada. Limite maximo de vagas atingido.';
    END IF;

    -- RN06: todos os pré-requisitos precisam ter uma matrícula com situação Aprovado
    SELECT COUNT(*) INTO v_pendentes
      FROM pre_requisito pr
     WHERE pr.id_disciplina = v_id_disciplina
       AND NOT EXISTS (SELECT 1
                         FROM matricula m
                         JOIN turma t ON t.id_turma = m.id_turma
                        WHERE m.id_aluno = p_id_aluno
                          AND t.id_disciplina = pr.id_disciplina_requisito
                          AND m.situacao = 'Aprovado');
    IF v_pendentes > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN06: Aluno nao foi aprovado em todos os pre-requisitos da disciplina.';
    END IF;

    INSERT INTO matricula (id_aluno, id_turma, id_usuario)
    VALUES (p_id_aluno, p_id_turma, p_id_usuario);

    SELECT LAST_INSERT_ID() AS id_matricula;
END $$

-- Lançamento de N1, N2 e faltas (média e situação recalculadas pelo trigger via functions)
DROP PROCEDURE IF EXISTS sp_lancar_notas $$
CREATE PROCEDURE sp_lancar_notas(IN p_id_matricula INT, IN p_n1 DECIMAL(4,2), IN p_n2 DECIMAL(4,2),
                                 IN p_faltas INT, IN p_id_usuario INT)
BEGIN
    DECLARE v_total INT;
    DECLARE v_status_turma VARCHAR(10);

    CALL sp_valida_coordenador(p_id_usuario);

    SELECT t.total_aulas, t.status INTO v_total, v_status_turma
      FROM matricula m JOIN turma t ON t.id_turma = m.id_turma
     WHERE m.id_matricula = p_id_matricula;
    IF v_total IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Matricula nao encontrada.';
    END IF;
    IF v_status_turma = 'Encerrada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma encerrada: notas nao podem mais ser alteradas.';
    END IF;
    IF p_faltas < 0 OR p_faltas > v_total THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantidade de faltas invalida para o total de aulas da turma.';
    END IF;

    -- O intervalo 0..10 das notas é garantido pela CHECK constraint (RN07)
    UPDATE matricula
       SET n1 = p_n1, n2 = p_n2, faltas = p_faltas
     WHERE id_matricula = p_id_matricula;

    -- Garante o recálculo via functions mesmo quando nada mudou
    UPDATE matricula m
      JOIN turma t ON t.id_turma = m.id_turma
       SET m.media_final = fn_calcular_media(m.n1, m.n2, m.exame),
           m.situacao    = fn_situacao_calc(m.n1, m.n2, m.exame, m.faltas, t.total_aulas)
     WHERE m.id_matricula = p_id_matricula;

    SET @sga_usuario = NULL;
    SELECT id_matricula, n1, n2, exame, faltas, media_final, situacao
      FROM matricula WHERE id_matricula = p_id_matricula;
END $$

-- Lançamento da nota de exame (somente para situação "Em Exame")
DROP PROCEDURE IF EXISTS sp_lancar_exame $$
CREATE PROCEDURE sp_lancar_exame(IN p_id_matricula INT, IN p_exame DECIMAL(4,2), IN p_id_usuario INT)
BEGIN
    DECLARE v_situacao VARCHAR(20);
    DECLARE v_status_turma VARCHAR(10);

    CALL sp_valida_coordenador(p_id_usuario);

    SELECT m.situacao, t.status INTO v_situacao, v_status_turma
      FROM matricula m JOIN turma t ON t.id_turma = m.id_turma
     WHERE m.id_matricula = p_id_matricula;
    IF v_situacao IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Matricula nao encontrada.';
    END IF;
    IF v_status_turma = 'Encerrada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma encerrada: notas nao podem mais ser alteradas.';
    END IF;
    IF v_situacao <> 'Em Exame' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exame permitido somente para matriculas com situacao Em Exame.';
    END IF;

    UPDATE matricula SET exame = p_exame WHERE id_matricula = p_id_matricula;

    SET @sga_usuario = NULL;
    SELECT id_matricula, n1, n2, exame, faltas, media_final, situacao
      FROM matricula WHERE id_matricula = p_id_matricula;
END $$

-- Histórico escolar completo ordenado por semestre
DROP PROCEDURE IF EXISTS sp_historico_aluno $$
CREATE PROCEDURE sp_historico_aluno(IN p_id_aluno INT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aluno WHERE id_aluno = p_id_aluno) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aluno nao encontrado.';
    END IF;
    SELECT a.ra, a.nome AS aluno, c.nome AS curso, a.status,
           t.semestre, d.periodo, d.nome AS disciplina, d.carga_horaria,
           p.nome AS professor,
           m.n1, m.n2, m.exame, m.media_final, m.faltas,
           fn_frequencia_calc(t.total_aulas, m.faltas) AS frequencia,
           m.situacao,
           fn_cr_aluno(a.id_aluno) AS cr
      FROM aluno a
      JOIN curso c      ON c.id_curso = a.id_curso
      JOIN matricula m  ON m.id_aluno = a.id_aluno
      JOIN turma t      ON t.id_turma = m.id_turma
      JOIN disciplina d ON d.id_disciplina = t.id_disciplina
      JOIN professor p  ON p.id_professor = t.id_professor
     WHERE a.id_aluno = p_id_aluno
     ORDER BY t.semestre, d.periodo, d.nome;
END $$

-- Encerramento de turmas em lote (cursor + transação). Somente Coordenador.
DROP PROCEDURE IF EXISTS sp_fechar_semestre $$
CREATE PROCEDURE sp_fechar_semestre(IN p_semestre CHAR(6), IN p_id_usuario INT)
BEGIN
    DECLARE v_fim INT DEFAULT 0;
    DECLARE v_id_turma INT;
    DECLARE v_turmas INT DEFAULT 0;
    DECLARE v_matriculas INT DEFAULT 0;

    DECLARE cur_turmas CURSOR FOR
        SELECT id_turma FROM turma WHERE semestre = p_semestre AND status = 'Aberta';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fim = 1;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @sga_usuario = NULL;
        RESIGNAL;
    END;

    CALL sp_valida_coordenador(p_id_usuario);

    IF NOT EXISTS (SELECT 1 FROM turma WHERE semestre = p_semestre AND status = 'Aberta') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nao ha turmas abertas para o semestre informado.';
    END IF;

    START TRANSACTION;

    OPEN cur_turmas;
    loop_turmas: LOOP
        FETCH cur_turmas INTO v_id_turma;
        IF v_fim = 1 THEN
            LEAVE loop_turmas;
        END IF;

        -- Quem ficou "Em Exame" sem nota de exame é reprovado por nota
        UPDATE matricula
           SET situacao = 'Reprovado por Nota'
         WHERE id_turma = v_id_turma AND situacao = 'Em Exame';
        SET v_matriculas = v_matriculas + ROW_COUNT();

        -- Quem ficou sem notas lançadas: notas ausentes contam como zero (RN04 ainda prevalece)
        UPDATE matricula m
          JOIN turma t ON t.id_turma = m.id_turma
           SET m.media_final = ROUND((IFNULL(m.n1, 0) + IFNULL(m.n2, 0)) / 2, 2),
               m.situacao = IF(fn_frequencia_calc(t.total_aulas, m.faltas) < 75,
                               'Reprovado por Falta', 'Reprovado por Nota')
         WHERE m.id_turma = v_id_turma AND m.situacao = 'Cursando';
        SET v_matriculas = v_matriculas + ROW_COUNT();

        UPDATE turma SET status = 'Encerrada' WHERE id_turma = v_id_turma;
        SET v_turmas = v_turmas + 1;
    END LOOP;
    CLOSE cur_turmas;

    COMMIT;
    SET @sga_usuario = NULL;

    SELECT p_semestre AS semestre, v_turmas AS turmas_encerradas,
           v_matriculas AS matriculas_finalizadas_automaticamente;
END $$

-- =====================================================================
-- 6. STORED PROCEDURES - CRUD
--    Todas recebem o id do usuário logado como 1º parâmetro e validam o perfil.
-- =====================================================================

-- ------------------------------ USUÁRIO ------------------------------
DROP PROCEDURE IF EXISTS sp_usuario_inserir $$
CREATE PROCEDURE sp_usuario_inserir(IN p_id_exec INT, IN p_nome VARCHAR(100), IN p_cpf CHAR(11),
    IN p_email VARCHAR(120), IN p_login VARCHAR(50), IN p_senha_hash CHAR(64), IN p_perfil VARCHAR(20))
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF p_senha_hash IS NULL OR CHAR_LENGTH(p_senha_hash) <> 64 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Senha obrigatoria (hash SHA-256 invalido).';
    END IF;
    INSERT INTO usuario (nome, cpf, email, login, senha_hash, perfil)
    VALUES (p_nome, p_cpf, p_email, p_login, LOWER(p_senha_hash), p_perfil);
    SELECT LAST_INSERT_ID() AS id;
END $$

-- p_senha_hash NULL mantém a senha atual
DROP PROCEDURE IF EXISTS sp_usuario_atualizar $$
CREATE PROCEDURE sp_usuario_atualizar(IN p_id_exec INT, IN p_id_usuario INT, IN p_nome VARCHAR(100),
    IN p_cpf CHAR(11), IN p_email VARCHAR(120), IN p_login VARCHAR(50), IN p_senha_hash CHAR(64),
    IN p_perfil VARCHAR(20))
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF NOT EXISTS (SELECT 1 FROM usuario WHERE id_usuario = p_id_usuario) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario nao encontrado.';
    END IF;
    IF p_id_exec = p_id_usuario AND p_perfil <> 'Coordenador' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voce nao pode remover o seu proprio perfil de Coordenador.';
    END IF;
    UPDATE usuario
       SET nome = p_nome, cpf = p_cpf, email = p_email, login = p_login, perfil = p_perfil,
           senha_hash = IF(p_senha_hash IS NULL OR p_senha_hash = '', senha_hash, LOWER(p_senha_hash))
     WHERE id_usuario = p_id_usuario;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_usuario_excluir $$
CREATE PROCEDURE sp_usuario_excluir(IN p_id_exec INT, IN p_id_usuario INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF p_id_exec = p_id_usuario THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voce nao pode excluir o proprio usuario.';
    END IF;
    IF EXISTS (SELECT 1 FROM matricula WHERE id_usuario = p_id_usuario) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario possui matriculas registradas e nao pode ser excluido.';
    END IF;
    DELETE FROM usuario WHERE id_usuario = p_id_usuario;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ------------------------------- CURSO -------------------------------
DROP PROCEDURE IF EXISTS sp_curso_inserir $$
CREATE PROCEDURE sp_curso_inserir(IN p_id_exec INT, IN p_nome VARCHAR(100), IN p_carga_horaria_total INT,
    IN p_turno VARCHAR(10), IN p_valor_mensalidade DECIMAL(10,2))
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    INSERT INTO curso (nome, carga_horaria_total, turno, valor_mensalidade)
    VALUES (p_nome, p_carga_horaria_total, p_turno, IFNULL(p_valor_mensalidade, 0));
    SELECT LAST_INSERT_ID() AS id;
END $$

DROP PROCEDURE IF EXISTS sp_curso_atualizar $$
CREATE PROCEDURE sp_curso_atualizar(IN p_id_exec INT, IN p_id_curso INT, IN p_nome VARCHAR(100),
    IN p_carga_horaria_total INT, IN p_turno VARCHAR(10), IN p_valor_mensalidade DECIMAL(10,2))
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF NOT EXISTS (SELECT 1 FROM curso WHERE id_curso = p_id_curso) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Curso nao encontrado.';
    END IF;
    UPDATE curso
       SET nome = p_nome, carga_horaria_total = p_carga_horaria_total, turno = p_turno,
           valor_mensalidade = IFNULL(p_valor_mensalidade, 0)
     WHERE id_curso = p_id_curso;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_curso_excluir $$
CREATE PROCEDURE sp_curso_excluir(IN p_id_exec INT, IN p_id_curso INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF EXISTS (SELECT 1 FROM aluno WHERE id_curso = p_id_curso)
       OR EXISTS (SELECT 1 FROM disciplina WHERE id_curso = p_id_curso) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Curso possui alunos ou disciplinas vinculados e nao pode ser excluido.';
    END IF;
    DELETE FROM curso WHERE id_curso = p_id_curso;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ----------------------------- DISCIPLINA ----------------------------
DROP PROCEDURE IF EXISTS sp_disciplina_inserir $$
CREATE PROCEDURE sp_disciplina_inserir(IN p_id_exec INT, IN p_id_curso INT, IN p_nome VARCHAR(100),
    IN p_carga_horaria INT, IN p_periodo INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    INSERT INTO disciplina (id_curso, nome, carga_horaria, periodo)
    VALUES (p_id_curso, p_nome, p_carga_horaria, p_periodo);
    SELECT LAST_INSERT_ID() AS id;
END $$

DROP PROCEDURE IF EXISTS sp_disciplina_atualizar $$
CREATE PROCEDURE sp_disciplina_atualizar(IN p_id_exec INT, IN p_id_disciplina INT, IN p_id_curso INT,
    IN p_nome VARCHAR(100), IN p_carga_horaria INT, IN p_periodo INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF NOT EXISTS (SELECT 1 FROM disciplina WHERE id_disciplina = p_id_disciplina) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Disciplina nao encontrada.';
    END IF;
    UPDATE disciplina
       SET id_curso = p_id_curso, nome = p_nome, carga_horaria = p_carga_horaria, periodo = p_periodo
     WHERE id_disciplina = p_id_disciplina;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_disciplina_excluir $$
CREATE PROCEDURE sp_disciplina_excluir(IN p_id_exec INT, IN p_id_disciplina INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF EXISTS (SELECT 1 FROM turma WHERE id_disciplina = p_id_disciplina) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Disciplina possui turmas vinculadas e nao pode ser excluida.';
    END IF;
    DELETE FROM disciplina WHERE id_disciplina = p_id_disciplina;  -- pré-requisitos removidos em cascata
    SELECT ROW_COUNT() AS afetados;
END $$

-- --------------------------- PRÉ-REQUISITO ---------------------------
DROP PROCEDURE IF EXISTS sp_prerequisito_inserir $$
CREATE PROCEDURE sp_prerequisito_inserir(IN p_id_exec INT, IN p_id_disciplina INT,
    IN p_id_disciplina_requisito INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF p_id_disciplina = p_id_disciplina_requisito THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Uma disciplina nao pode ser pre-requisito dela mesma.';
    END IF;
    IF EXISTS (SELECT 1 FROM pre_requisito
                WHERE id_disciplina = p_id_disciplina_requisito
                  AND id_disciplina_requisito = p_id_disciplina) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Dependencia circular entre as disciplinas.';
    END IF;
    INSERT INTO pre_requisito (id_disciplina, id_disciplina_requisito)
    VALUES (p_id_disciplina, p_id_disciplina_requisito);
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_prerequisito_excluir $$
CREATE PROCEDURE sp_prerequisito_excluir(IN p_id_exec INT, IN p_id_disciplina INT,
    IN p_id_disciplina_requisito INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    DELETE FROM pre_requisito
     WHERE id_disciplina = p_id_disciplina AND id_disciplina_requisito = p_id_disciplina_requisito;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ----------------------------- PROFESSOR -----------------------------
DROP PROCEDURE IF EXISTS sp_professor_inserir $$
CREATE PROCEDURE sp_professor_inserir(IN p_id_exec INT, IN p_nome VARCHAR(100), IN p_cpf CHAR(11),
    IN p_email VARCHAR(120), IN p_titulacao VARCHAR(20), IN p_data_admissao DATE)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    INSERT INTO professor (nome, cpf, email, titulacao, data_admissao)
    VALUES (p_nome, p_cpf, p_email, p_titulacao, p_data_admissao);
    SELECT LAST_INSERT_ID() AS id;
END $$

DROP PROCEDURE IF EXISTS sp_professor_atualizar $$
CREATE PROCEDURE sp_professor_atualizar(IN p_id_exec INT, IN p_id_professor INT, IN p_nome VARCHAR(100),
    IN p_cpf CHAR(11), IN p_email VARCHAR(120), IN p_titulacao VARCHAR(20), IN p_data_admissao DATE)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF NOT EXISTS (SELECT 1 FROM professor WHERE id_professor = p_id_professor) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Professor nao encontrado.';
    END IF;
    UPDATE professor
       SET nome = p_nome, cpf = p_cpf, email = p_email, titulacao = p_titulacao,
           data_admissao = p_data_admissao
     WHERE id_professor = p_id_professor;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_professor_excluir $$
CREATE PROCEDURE sp_professor_excluir(IN p_id_exec INT, IN p_id_professor INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF EXISTS (SELECT 1 FROM turma WHERE id_professor = p_id_professor) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Professor possui turmas vinculadas e nao pode ser excluido.';
    END IF;
    DELETE FROM professor WHERE id_professor = p_id_professor;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ------------------------------- ALUNO -------------------------------
-- Secretário e Coordenador podem cadastrar, editar e excluir alunos
DROP PROCEDURE IF EXISTS sp_aluno_inserir $$
CREATE PROCEDURE sp_aluno_inserir(IN p_id_exec INT, IN p_ra VARCHAR(20), IN p_nome VARCHAR(100),
    IN p_cpf CHAR(11), IN p_email VARCHAR(120), IN p_data_nascimento DATE, IN p_id_curso INT,
    IN p_status VARCHAR(10))
BEGIN
    CALL sp_valida_usuario(p_id_exec);
    INSERT INTO aluno (ra, nome, cpf, email, data_nascimento, id_curso, status)
    VALUES (p_ra, p_nome, p_cpf, p_email, p_data_nascimento, p_id_curso, IFNULL(p_status, 'Ativo'));
    SELECT LAST_INSERT_ID() AS id;
END $$

DROP PROCEDURE IF EXISTS sp_aluno_atualizar $$
CREATE PROCEDURE sp_aluno_atualizar(IN p_id_exec INT, IN p_id_aluno INT, IN p_ra VARCHAR(20),
    IN p_nome VARCHAR(100), IN p_cpf CHAR(11), IN p_email VARCHAR(120), IN p_data_nascimento DATE,
    IN p_id_curso INT, IN p_status VARCHAR(10))
BEGIN
    CALL sp_valida_usuario(p_id_exec);
    IF NOT EXISTS (SELECT 1 FROM aluno WHERE id_aluno = p_id_aluno) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aluno nao encontrado.';
    END IF;
    UPDATE aluno
       SET ra = p_ra, nome = p_nome, cpf = p_cpf, email = p_email,
           data_nascimento = p_data_nascimento, id_curso = p_id_curso, status = p_status
     WHERE id_aluno = p_id_aluno;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_aluno_excluir $$
CREATE PROCEDURE sp_aluno_excluir(IN p_id_exec INT, IN p_id_aluno INT)
BEGIN
    CALL sp_valida_usuario(p_id_exec);
    IF EXISTS (SELECT 1 FROM matricula WHERE id_aluno = p_id_aluno) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Aluno possui historico de matriculas. Altere o status para Trancado.';
    END IF;
    DELETE FROM aluno WHERE id_aluno = p_id_aluno;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ------------------------------- TURMA -------------------------------
DROP PROCEDURE IF EXISTS sp_turma_inserir $$
CREATE PROCEDURE sp_turma_inserir(IN p_id_exec INT, IN p_id_disciplina INT, IN p_id_professor INT,
    IN p_semestre CHAR(6), IN p_vagas INT, IN p_total_aulas INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    INSERT INTO turma (id_disciplina, id_professor, semestre, vagas, total_aulas)
    VALUES (p_id_disciplina, p_id_professor, p_semestre, p_vagas, p_total_aulas);
    SELECT LAST_INSERT_ID() AS id;
END $$

DROP PROCEDURE IF EXISTS sp_turma_atualizar $$
CREATE PROCEDURE sp_turma_atualizar(IN p_id_exec INT, IN p_id_turma INT, IN p_id_disciplina INT,
    IN p_id_professor INT, IN p_semestre CHAR(6), IN p_vagas INT, IN p_total_aulas INT)
BEGIN
    DECLARE v_status VARCHAR(10);
    DECLARE v_matriculados INT;
    CALL sp_valida_coordenador(p_id_exec);
    SELECT status INTO v_status FROM turma WHERE id_turma = p_id_turma;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma nao encontrada.';
    END IF;
    IF v_status = 'Encerrada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma encerrada nao pode ser alterada.';
    END IF;
    SELECT COUNT(*) INTO v_matriculados FROM matricula WHERE id_turma = p_id_turma;
    IF p_vagas < v_matriculados THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vagas nao pode ser menor que o numero de alunos ja matriculados.';
    END IF;
    IF v_matriculados > 0 AND EXISTS (SELECT 1 FROM turma WHERE id_turma = p_id_turma
                                         AND id_disciplina <> p_id_disciplina) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma com matriculas nao pode trocar de disciplina.';
    END IF;
    UPDATE turma
       SET id_disciplina = p_id_disciplina, id_professor = p_id_professor, semestre = p_semestre,
           vagas = p_vagas, total_aulas = p_total_aulas
     WHERE id_turma = p_id_turma;
    SELECT ROW_COUNT() AS afetados;
END $$

DROP PROCEDURE IF EXISTS sp_turma_excluir $$
CREATE PROCEDURE sp_turma_excluir(IN p_id_exec INT, IN p_id_turma INT)
BEGIN
    CALL sp_valida_coordenador(p_id_exec);
    IF EXISTS (SELECT 1 FROM matricula WHERE id_turma = p_id_turma) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Turma possui matriculas e nao pode ser excluida.';
    END IF;
    DELETE FROM turma WHERE id_turma = p_id_turma;
    SELECT ROW_COUNT() AS afetados;
END $$

-- ----------------------------- MATRÍCULA -----------------------------
-- Inserção: sp_matricular_aluno | Atualização: sp_lancar_notas / sp_lancar_exame
DROP PROCEDURE IF EXISTS sp_matricula_cancelar $$
CREATE PROCEDURE sp_matricula_cancelar(IN p_id_exec INT, IN p_id_matricula INT)
BEGIN
    DECLARE v_status_turma VARCHAR(10);
    CALL sp_valida_usuario(p_id_exec);
    SELECT t.status INTO v_status_turma
      FROM matricula m JOIN turma t ON t.id_turma = m.id_turma
     WHERE m.id_matricula = p_id_matricula;
    IF v_status_turma IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Matricula nao encontrada.';
    END IF;
    IF v_status_turma = 'Encerrada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Matricula de turma encerrada faz parte do historico e nao pode ser cancelada.';
    END IF;
    DELETE FROM matricula WHERE id_matricula = p_id_matricula;
    SELECT ROW_COUNT() AS afetados;
END $$

DELIMITER ;
