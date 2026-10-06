-- =====================================================================
--  SGA - Sistema de Gestão Acadêmica | Faculdade do Bug Infinito (FBI)
--  01_estrutura.sql  -> Criação do banco, tabelas, constraints e índices
--  SGBD: MySQL 8.0.16+ (CHECK constraints são aplicadas a partir da 8.0.16)
-- =====================================================================

SET NAMES utf8mb4;
DROP DATABASE IF EXISTS sga_fbi;
CREATE DATABASE sga_fbi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sga_fbi;

-- ---------------------------------------------------------------------
-- usuario: usuários do sistema (senha armazenada SOMENTE como hash SHA-256)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    cpf         CHAR(11)     NOT NULL,
    email       VARCHAR(120) NOT NULL,
    login       VARCHAR(50)  NOT NULL,
    senha_hash  CHAR(64)     NOT NULL,           -- SHA-256 em hexadecimal
    perfil      VARCHAR(20)  NOT NULL,
    CONSTRAINT uq_usuario_cpf   UNIQUE (cpf),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT uq_usuario_login UNIQUE (login),
    CONSTRAINT ck_usuario_perfil CHECK (perfil IN ('Secretario', 'Coordenador')),
    CONSTRAINT ck_usuario_hash   CHECK (CHAR_LENGTH(senha_hash) = 64)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- curso
-- ---------------------------------------------------------------------
CREATE TABLE curso (
    id_curso            INT AUTO_INCREMENT PRIMARY KEY,
    nome                VARCHAR(100)  NOT NULL,
    carga_horaria_total INT           NOT NULL,
    turno               VARCHAR(10)   NOT NULL,
    valor_mensalidade   DECIMAL(10,2) NOT NULL DEFAULT 0.00,  -- usado no relatório de faturamento
    CONSTRAINT uq_curso_nome  UNIQUE (nome),
    CONSTRAINT ck_curso_turno CHECK (turno IN ('Matutino', 'Vespertino', 'Noturno')),
    CONSTRAINT ck_curso_ch    CHECK (carga_horaria_total > 0),
    CONSTRAINT ck_curso_valor CHECK (valor_mensalidade >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- disciplina
-- ---------------------------------------------------------------------
CREATE TABLE disciplina (
    id_disciplina INT AUTO_INCREMENT PRIMARY KEY,
    id_curso      INT          NOT NULL,
    nome          VARCHAR(100) NOT NULL,
    carga_horaria INT          NOT NULL,
    periodo       INT          NOT NULL,
    CONSTRAINT fk_disciplina_curso FOREIGN KEY (id_curso) REFERENCES curso (id_curso),
    CONSTRAINT uq_disciplina_curso_nome UNIQUE (id_curso, nome),
    CONSTRAINT ck_disciplina_ch      CHECK (carga_horaria > 0),
    CONSTRAINT ck_disciplina_periodo CHECK (periodo BETWEEN 1 AND 12)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- pre_requisito: autorrelacionamento N:N de disciplina
-- ---------------------------------------------------------------------
CREATE TABLE pre_requisito (
    id_disciplina           INT NOT NULL,
    id_disciplina_requisito INT NOT NULL,
    PRIMARY KEY (id_disciplina, id_disciplina_requisito),
    CONSTRAINT fk_prereq_disciplina FOREIGN KEY (id_disciplina)
        REFERENCES disciplina (id_disciplina) ON DELETE CASCADE,
    CONSTRAINT fk_prereq_requisito  FOREIGN KEY (id_disciplina_requisito)
        REFERENCES disciplina (id_disciplina) ON DELETE CASCADE,
    CONSTRAINT ck_prereq_diferente CHECK (id_disciplina <> id_disciplina_requisito)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- professor
-- ---------------------------------------------------------------------
CREATE TABLE professor (
    id_professor  INT AUTO_INCREMENT PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    cpf           CHAR(11)     NOT NULL,
    email         VARCHAR(120) NOT NULL,
    titulacao     VARCHAR(20)  NOT NULL,
    data_admissao DATE         NOT NULL,
    CONSTRAINT uq_professor_cpf   UNIQUE (cpf),
    CONSTRAINT uq_professor_email UNIQUE (email),
    CONSTRAINT ck_professor_titulacao
        CHECK (titulacao IN ('Graduado', 'Especialista', 'Mestre', 'Doutor'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- aluno
-- ---------------------------------------------------------------------
CREATE TABLE aluno (
    id_aluno        INT AUTO_INCREMENT PRIMARY KEY,
    ra              VARCHAR(20)  NOT NULL,
    nome            VARCHAR(100) NOT NULL,
    cpf             CHAR(11)     NOT NULL,
    email           VARCHAR(120) NOT NULL,
    data_nascimento DATE         NOT NULL,
    id_curso        INT          NOT NULL,
    status          VARCHAR(10)  NOT NULL DEFAULT 'Ativo',
    CONSTRAINT fk_aluno_curso FOREIGN KEY (id_curso) REFERENCES curso (id_curso),
    CONSTRAINT uq_aluno_ra    UNIQUE (ra),
    CONSTRAINT uq_aluno_cpf   UNIQUE (cpf),
    CONSTRAINT uq_aluno_email UNIQUE (email),
    CONSTRAINT ck_aluno_status CHECK (status IN ('Ativo', 'Trancado', 'Formado'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- turma
-- ---------------------------------------------------------------------
CREATE TABLE turma (
    id_turma      INT AUTO_INCREMENT PRIMARY KEY,
    id_disciplina INT         NOT NULL,
    id_professor  INT         NOT NULL,
    semestre      CHAR(6)     NOT NULL,                  -- formato AAAA.S (ex.: 2026.2)
    vagas         INT         NOT NULL,
    total_aulas   INT         NOT NULL,
    status        VARCHAR(10) NOT NULL DEFAULT 'Aberta', -- controlado por sp_fechar_semestre
    CONSTRAINT fk_turma_disciplina FOREIGN KEY (id_disciplina) REFERENCES disciplina (id_disciplina),
    CONSTRAINT fk_turma_professor  FOREIGN KEY (id_professor)  REFERENCES professor (id_professor),
    CONSTRAINT ck_turma_vagas    CHECK (vagas > 0),
    CONSTRAINT ck_turma_aulas    CHECK (total_aulas > 0),
    CONSTRAINT ck_turma_semestre CHECK (semestre REGEXP '^[0-9]{4}\\.[12]$'),
    CONSTRAINT ck_turma_status   CHECK (status IN ('Aberta', 'Encerrada'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- matricula
-- ---------------------------------------------------------------------
CREATE TABLE matricula (
    id_matricula   INT AUTO_INCREMENT PRIMARY KEY,
    id_aluno       INT          NOT NULL,
    id_turma       INT          NOT NULL,
    data_matricula DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    n1             DECIMAL(4,2) NULL,
    n2             DECIMAL(4,2) NULL,
    exame          DECIMAL(4,2) NULL,
    faltas         INT          NOT NULL DEFAULT 0,
    media_final    DECIMAL(4,2) NULL,
    situacao       VARCHAR(20)  NOT NULL DEFAULT 'Cursando',
    id_usuario     INT          NOT NULL,                 -- usuário que realizou a matrícula
    CONSTRAINT fk_matricula_aluno   FOREIGN KEY (id_aluno)   REFERENCES aluno (id_aluno),
    CONSTRAINT fk_matricula_turma   FOREIGN KEY (id_turma)   REFERENCES turma (id_turma),
    CONSTRAINT fk_matricula_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
    CONSTRAINT uq_matricula_aluno_turma UNIQUE (id_aluno, id_turma),
    -- RN07: notas sempre entre 0,0 e 10,0
    CONSTRAINT ck_matricula_n1    CHECK (n1    IS NULL OR n1    BETWEEN 0.0 AND 10.0),
    CONSTRAINT ck_matricula_n2    CHECK (n2    IS NULL OR n2    BETWEEN 0.0 AND 10.0),
    CONSTRAINT ck_matricula_exame CHECK (exame IS NULL OR exame BETWEEN 0.0 AND 10.0),
    CONSTRAINT ck_matricula_media CHECK (media_final IS NULL OR media_final BETWEEN 0.0 AND 10.0),
    CONSTRAINT ck_matricula_faltas CHECK (faltas >= 0),
    CONSTRAINT ck_matricula_situacao CHECK (situacao IN
        ('Cursando', 'Aprovado', 'Em Exame', 'Reprovado por Nota', 'Reprovado por Falta'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- log_nota: auditoria de alterações de notas (RN08)
-- ---------------------------------------------------------------------
CREATE TABLE log_nota (
    id_log       INT AUTO_INCREMENT PRIMARY KEY,
    id_matricula INT          NOT NULL,
    campo        VARCHAR(20)  NOT NULL,
    valor_antigo VARCHAR(20)  NULL,
    valor_novo   VARCHAR(20)  NULL,
    usuario      VARCHAR(100) NOT NULL,
    data_hora    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_matricula FOREIGN KEY (id_matricula)
        REFERENCES matricula (id_matricula) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Índices de apoio às consultas mais frequentes
-- ---------------------------------------------------------------------
CREATE INDEX idx_aluno_nome        ON aluno (nome);
CREATE INDEX idx_aluno_status      ON aluno (status);
CREATE INDEX idx_professor_nome    ON professor (nome);
CREATE INDEX idx_turma_semestre    ON turma (semestre);
CREATE INDEX idx_matricula_turma   ON matricula (id_turma);
CREATE INDEX idx_matricula_situacao ON matricula (situacao);
CREATE INDEX idx_log_data          ON log_nota (data_hora);
