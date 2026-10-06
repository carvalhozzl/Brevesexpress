-- =====================================================================
--  SGA - Sistema de Gestão Acadêmica | Faculdade do Bug Infinito (FBI)
--  04_testes.sql -> Roteiro de testes obrigatórios
--
--  Execute após 01_estrutura.sql, 02_programacao.sql e 03_dados.sql.
--  Os testes que DEVEM falhar são executados dentro da procedure auxiliar
--  sp_teste_erro, que captura o erro (SQLSTATE + mensagem) e o exibe como
--  resultado. Assim o script roda inteiro no MySQL Workbench sem parar.
-- =====================================================================
USE sga_fbi;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS resultado_teste;
CREATE TABLE resultado_teste (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    teste     VARCHAR(80),
    esperado  VARCHAR(40),
    obtido    VARCHAR(40),
    sqlstate_ CHAR(5),
    mensagem  VARCHAR(255)
);

DELIMITER $$
-- Executa um comando que deve falhar e registra o erro retornado pelo banco
DROP PROCEDURE IF EXISTS sp_teste_erro $$
CREATE PROCEDURE sp_teste_erro(IN p_teste VARCHAR(80), IN p_comando TEXT)
BEGIN
    DECLARE v_state CHAR(5) DEFAULT NULL;
    DECLARE v_msg VARCHAR(255) DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        GET DIAGNOSTICS CONDITION 1 v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;

    SET @teste_sql = p_comando;
    PREPARE stmt FROM @teste_sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    INSERT INTO resultado_teste (teste, esperado, obtido, sqlstate_, mensagem)
    VALUES (p_teste, 'FALHA', IF(v_state IS NULL, 'SUCESSO (ERRO!)', 'FALHA (OK)'), v_state, v_msg);
END $$
DELIMITER ;

-- Ids usados nos testes
SET @coord := (SELECT id_usuario FROM usuario WHERE login = 'ana.coord');
SET @secr  := (SELECT id_usuario FROM usuario WHERE login = 'beatriz.sec');

-- ---------------------------------------------------------------------
-- TESTE 1: Login com senha incorreta / usuário inexistente -> vazio
-- ---------------------------------------------------------------------
CALL sp_LoginUsuario('ana.coord', SHA2('senha_errada', 256));     -- esperado: 0 linhas
CALL sp_LoginUsuario('usuario_fantasma', SHA2('fbi@2026', 256));  -- esperado: 0 linhas
CALL sp_LoginUsuario('ana.coord', SHA2('fbi@2026', 256));         -- controle: 1 linha (Coordenador)

-- ---------------------------------------------------------------------
-- TESTE 2: Matrícula em turma lotada -> SQLSTATE 45000
--   Turma 5 (Anatomia Humana) possui 3 vagas e 3 matriculados.
-- ---------------------------------------------------------------------
SELECT * FROM vw_turmas_lotacao WHERE id_turma = 5;
CALL sp_teste_erro('T2 - Matricula em turma lotada',
                   CONCAT('CALL sp_matricular_aluno(11, 5, ', @secr, ')'));
-- O trigger trg_valida_vagas também bloqueia um INSERT direto:
CALL sp_teste_erro('T2b - INSERT direto em turma lotada (trigger)',
                   CONCAT('INSERT INTO matricula (id_aluno, id_turma, id_usuario) VALUES (11, 5, ', @secr, ')'));

-- ---------------------------------------------------------------------
-- TESTE 3: Matrícula sem pré-requisito -> falha
--   Aluno 9 (Bruno) foi reprovado em Algoritmos; Estruturas de Dados (turma 3) exige Algoritmos.
-- ---------------------------------------------------------------------
CALL sp_teste_erro('T3 - Matricula sem pre-requisito',
                   CONCAT('CALL sp_matricular_aluno(9, 3, ', @secr, ')'));

-- ---------------------------------------------------------------------
-- TESTE 4: Matrícula de aluno Trancado -> falha
--   Aluno 12 (Fernanda) está com status Trancado.
-- ---------------------------------------------------------------------
CALL sp_teste_erro('T4 - Matricula de aluno Trancado',
                   CONCAT('CALL sp_matricular_aluno(12, 2, ', @secr, ')'));

-- ---------------------------------------------------------------------
-- TESTE 5: Nota fora do intervalo (11.0) -> falha pela CHECK constraint (RN07)
-- ---------------------------------------------------------------------
SET @mat_t5 := (SELECT id_matricula FROM matricula WHERE id_aluno = 6 AND id_turma = 2);
CALL sp_teste_erro('T5 - Nota 11.0 via procedure (CHECK)',
                   CONCAT('CALL sp_lancar_notas(', @mat_t5, ', 11.0, 8.0, 0, ', @coord, ')'));
CALL sp_teste_erro('T5b - Nota -1.0 via UPDATE direto (CHECK)',
                   CONCAT('UPDATE matricula SET n2 = -1.0 WHERE id_matricula = ', @mat_t5));

-- Controle de perfil: Secretário não pode lançar notas nem fechar semestre
CALL sp_teste_erro('Perfil - Secretario lancando notas',
                   CONCAT('CALL sp_lancar_notas(', @mat_t5, ', 8.0, 8.0, 0, ', @secr, ')'));
CALL sp_teste_erro('Perfil - Secretario fechando semestre',
                   CONCAT('CALL sp_fechar_semestre(''2026.2'', ', @secr, ')'));

-- ---------------------------------------------------------------------
-- TESTE 6: Notas que levam a exame e, em seguida, nota de exame
--   N1 = 5.0, N2 = 6.0 -> Média Parcial 5.5 -> "Em Exame"
--   Exame = 6.0 -> Média Final (5.5 + 6.0) / 2 = 5.75 -> "Aprovado"
-- ---------------------------------------------------------------------
SET @mat_t6 := (SELECT id_matricula FROM matricula WHERE id_aluno = 4 AND id_turma = 2);
CALL sp_lancar_notas(@mat_t6, 5.0, 6.0, 2, @coord);   -- esperado: situacao = Em Exame
CALL sp_lancar_exame(@mat_t6, 6.0, @coord);           -- esperado: media_final = 5.75, Aprovado
SELECT fn_calcular_media(5.0, 6.0, 6.0) AS fn_calcular_media_esperado_5_75,
       fn_situacao(@mat_t6)            AS fn_situacao_esperado_aprovado;

-- Exame só é aceito quando a situação é "Em Exame"
CALL sp_teste_erro('T6b - Exame em matricula ja aprovada',
                   CONCAT('CALL sp_lancar_exame(', @mat_t6, ', 8.0, ', @coord, ')'));

-- ---------------------------------------------------------------------
-- TESTE 7: Média 9.0 e frequência < 75% -> "Reprovado por Falta"
--   Turma 2 tem 40 aulas; 12 faltas -> frequência de 70%.
-- ---------------------------------------------------------------------
SET @mat_t7 := (SELECT id_matricula FROM matricula WHERE id_aluno = 5 AND id_turma = 2);
CALL sp_lancar_notas(@mat_t7, 9.0, 9.0, 12, @coord);  -- esperado: Reprovado por Falta
SELECT fn_frequencia(@mat_t7) AS frequencia_esperado_70,
       fn_situacao(@mat_t7)   AS situacao_esperado_reprovado_por_falta;

-- ---------------------------------------------------------------------
-- TESTE 8: Alteração de notas -> registros em log_nota (RN08)
-- ---------------------------------------------------------------------
SET @mat_t8 := (SELECT id_matricula FROM matricula WHERE id_aluno = 1 AND id_turma = 2);
CALL sp_lancar_notas(@mat_t8, 8.5, 9.5, 2, @coord);   -- altera N1 (8.0->8.5) e N2 (7.0->9.5)
SELECT * FROM vw_log_nota ORDER BY id_log;

-- ---------------------------------------------------------------------
-- TESTE 9: Execução e consulta das 3 views acadêmicas
-- ---------------------------------------------------------------------
SELECT * FROM vw_boletim ORDER BY aluno, semestre, disciplina;
SELECT * FROM vw_turmas_lotacao ORDER BY id_turma;
SELECT * FROM vw_desempenho_turma ORDER BY id_turma;

-- ---------------------------------------------------------------------
-- EXTRA: histórico, CR e fechamento de semestre (cursor + transação)
--   Usa uma turma de teste em 2026.1 para não encerrar as turmas do semestre atual.
-- ---------------------------------------------------------------------
CALL sp_historico_aluno(1);
SELECT nome, fn_cr_aluno(id_aluno) AS cr FROM aluno WHERE id_aluno IN (1, 5, 9, 10);

CALL sp_turma_inserir(@coord, 3, 2, '2026.1', 5, 40);
SET @turma_teste := (SELECT MAX(id_turma) FROM turma);
CALL sp_matricular_aluno(11, @turma_teste, @secr);
CALL sp_fechar_semestre('2026.1', @coord);             -- 1 turma encerrada, 1 matrícula finalizada
SELECT * FROM vw_matriculas WHERE id_turma = @turma_teste;
SELECT id_turma, semestre, status FROM turma WHERE id_turma = @turma_teste;

-- ---------------------------------------------------------------------
-- RESUMO DOS TESTES DE FALHA
-- ---------------------------------------------------------------------
SELECT * FROM resultado_teste ORDER BY id;
