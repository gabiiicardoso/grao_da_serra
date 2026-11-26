USE grao_da_serra;

-- Questão 1: fn_total_pedido


DROP FUNCTION IF EXISTS fn_total_pedido;

DELIMITER $$

CREATE FUNCTION fn_total_pedido(p_id_pedido INT) 
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(10,2);

    SELECT COALESCE(SUM(quantidade * preco_unitario), 0.00)
      INTO v_total
      FROM item_pedido
     WHERE id_pedido = p_id_pedido;

    RETURN v_total;
END$$

DELIMITER ;
SELECT fn_total_pedido(1), fn_total_pedido(3), fn_total_pedido(99);

-- Questão 2: fn_situacao_estoque

DROP FUNCTION IF EXISTS fn_situacao_estoque;

DELIMITER $$

CREATE FUNCTION fn_situacao_estoque(p_id_produto INT) 
RETURNS VARCHAR(20)
READS SQL DATA
BEGIN
    DECLARE v_estoque INT;
    DECLARE v_estoque_minimo INT;
    DECLARE v_situacao VARCHAR(20);

    SELECT estoque, estoque_minimo
      INTO v_estoque, v_estoque_minimo
      FROM produto
     WHERE id_produto = p_id_produto;

    IF v_estoque = 0 THEN
        SET v_situacao = 'ESGOTADO';
    ELSEIF v_estoque <= v_estoque_minimo THEN
        SET v_situacao = 'REPOR';
    ELSE
        SET v_situacao = 'OK';
    END IF;

    RETURN v_situacao;
END$$

DELIMITER ;
SELECT nome, estoque, estoque_minimo, fn_situacao_estoque(id_produto) FROM produto;

-- Questão 3: fn_desconto_fidelidade

DROP FUNCTION IF EXISTS fn_desconto_fidelidade;

DELIMITER $$

CREATE FUNCTION fn_desconto_fidelidade(p_id_cliente INT) 
RETURNS DECIMAL(4,2)
READS SQL DATA
BEGIN
    DECLARE v_qtd_pedidos INT;
    DECLARE v_desconto DECIMAL(4,2);

    SELECT COUNT(*)
      INTO v_qtd_pedidos
      FROM pedido
     WHERE id_cliente = p_id_cliente
       AND status = 'PAGO';

    IF v_qtd_pedidos >= 4 THEN
        SET v_desconto = 10.00;
    ELSEIF v_qtd_pedidos >= 2 THEN
        SET v_desconto = 5.00;
    ELSE
        SET v_desconto = 0.00;
    END IF;

    RETURN v_desconto;
END$$

DELIMITER ;

SELECT nome, fn_desconto_fidelidade(id_cliente) FROM cliente;

-- Questão 4: sp_abrir_pedido

DROP PROCEDURE IF EXISTS sp_abrir_pedido;

DELIMITER $$

CREATE PROCEDURE sp_abrir_pedido(
    IN p_id_cliente INT, 
    IN p_id_funcionario INT, 
    OUT p_id_pedido INT
)
BEGIN
    INSERT INTO pedido (id_cliente, id_funcionario)
    VALUES (p_id_cliente, p_id_funcionario);

    SET p_id_pedido = LAST_INSERT_ID();
END$$

DELIMITER ;

CALL sp_abrir_pedido(5, 1, @novo);

SELECT @novo;

-- Questão 5: sp_adicionar_item

DROP PROCEDURE IF EXISTS sp_adicionar_item;

DELIMITER $$

CREATE PROCEDURE sp_adicionar_item(
    IN p_id_pedido INT, 
    IN p_id_produto INT, 
    IN p_quantidade INT
)
BEGIN
    DECLARE v_status_pedido VARCHAR(20);
    DECLARE v_ativo TINYINT;
    DECLARE v_estoque INT;
    DECLARE v_preco DECIMAL(10,2);

    -- 1. Valida a quantidade informada
    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'A quantidade deve ser maior que zero.';
    END IF;

    -- 2. Busca e valida o pedido
    SELECT status
      INTO v_status_pedido
      FROM pedido
     WHERE id_pedido = p_id_pedido;

    IF v_status_pedido IS NULL THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'Pedido não encontrado.';
    ELSEIF v_status_pedido <> 'ABERTO' THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'Não é possível adicionar itens: o pedido não está ABERTO.';
    END IF;

    -- 3. Busca e valida o produto
    SELECT ativo, estoque, preco
      INTO v_ativo, v_estoque, v_preco
      FROM produto
     WHERE id_produto = p_id_produto;

    IF v_ativo IS NULL THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'Produto não encontrado.';
    ELSEIF v_ativo = 0 THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'Produto inativo: não está disponível no cardápio.';
    ELSEIF v_estoque < p_quantidade THEN
        SIGNAL SQLSTATE '45000' 
           SET MESSAGE_TEXT = 'Estoque insuficiente para a quantidade solicitada.';
    END IF;

    -- 4. Insere o item com o preço atual da tabela produto
    INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
    VALUES (p_id_pedido, p_id_produto, p_quantidade, v_preco);
END$$

DELIMITER ;
CALL sp_adicionar_item(@novo, 2, 2);
SELECT * FROM item_pedido WHERE id_pedido = @novo;

CALL sp_adicionar_item(1, 1, 1);      -- pedido pago
CALL sp_adicionar_item(@novo, 15, 1); -- produto inativo
CALL sp_adicionar_item(@novo, 8, 1);  -- sem estoque

-- Questao 6: sp_finalizar_pedido

DROP PROCEDURE IF EXISTS sp_finalizar_pedido;

DELIMITER $$

CREATE PROCEDURE sp_finalizar_pedido(IN p_id_pedido INT)
BEGIN
    DECLARE v_id_cliente INT;
    DECLARE v_status VARCHAR(20);
    DECLARE v_valor_bruto DECIMAL(10,2);
    DECLARE v_desconto DECIMAL(4,2);
    DECLARE v_valor_final DECIMAL(10,2);

    -- 1. Busca os dados do pedido
    SELECT id_cliente, status
      INTO v_id_cliente, v_status
      FROM pedido
     WHERE id_pedido = p_id_pedido;

    -- 2. Valida se o pedido existe e se está ABERTO
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Pedido não encontrado.';
    ELSEIF v_status <> 'ABERTO' THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Apenas pedidos com status ABERTO podem ser finalizados.';
    END IF;

    -- 3. Obtém o valor bruto pela function e valida se há itens
    SET v_valor_bruto = fn_total_pedido(p_id_pedido);

    IF v_valor_bruto <= 0.00 THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Não é possível finalizar um pedido sem itens.';
    END IF;

    -- 4. Obtém o percentual de desconto do cliente e calcula o valor final
    SET v_desconto = fn_desconto_fidelidade(v_id_cliente);
    SET v_valor_final = ROUND(v_valor_bruto * (1 - (v_desconto / 100)), 2);

    -- 5. Atualiza o pedido com os valores fechados e o status PAGO
    UPDATE pedido
       SET desconto_percentual = v_desconto,
           valor_total = v_valor_final,
           status = 'PAGO'
     WHERE id_pedido = p_id_pedido;
END$$

DELIMITER ;
CALL sp_finalizar_pedido(10);
SELECT id_pedido, status, desconto_percentual, valor_total FROM pedido WHERE id_pedido IN (9, 10);
CALL sp_finalizar_pedido(9);

-- Questao 7: sp_reajustar_precos_categoria
DROP PROCEDURE IF EXISTS sp_reajustar_precos_categoria;

DELIMITER $$

CREATE PROCEDURE sp_reajustar_precos_categoria(
    IN p_id_categoria INT, 
    IN p_percentual DECIMAL(5,2)
)
BEGIN
    DECLARE v_existe INT;

    -- 1. Valida se o percentual não é menor ou igual a -100%
    IF p_percentual IS NULL OR p_percentual <= -100 THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'O percentual de reajuste deve ser maior que -100%.';
    END IF;

    -- 2. Verifica se a categoria existe
    SELECT COUNT(*)
      INTO v_existe
      FROM categoria
     WHERE id_categoria = p_id_categoria;

    IF v_existe = 0 THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Categoria não encontrada.';
    END IF;

    -- 3. Atualiza os preços de todos os produtos da categoria com arredondamento
    UPDATE produto
       SET preco = ROUND(preco * (1 + (p_percentual / 100)), 2)
     WHERE id_categoria = p_id_categoria;
END$$

DELIMITER ;

SELECT id_produto, nome, preco FROM produto WHERE id_categoria = 1;
CALL sp_reajustar_precos_categoria(1, 10);
SELECT id_produto, nome, preco FROM produto WHERE id_categoria = 1;
CALL sp_reajustar_precos_categoria(99, 10);   -- categoria inexistente
CALL sp_reajustar_precos_categoria(1, -100);  -- percentual inválido

-- Questao 8: vw_cardapio
DROP VIEW IF EXISTS vw_cardapio;

CREATE VIEW vw_cardapio AS
SELECT 
    p.id_produto,
    c.nome AS categoria,
    p.nome AS produto,
    p.preco,
    fn_situacao_estoque(p.id_produto) AS situacao
FROM produto p
INNER JOIN categoria c ON p.id_categoria = c.id_categoria
WHERE p.ativo = 1;

-- Teste Questao 8:
SELECT * FROM vw_cardapio ORDER BY categoria, produto;

-- Questao 9: vw_pedidos_detalhados
DROP VIEW IF EXISTS vw_pedidos_detalhados;

CREATE VIEW vw_pedidos_detalhados AS
SELECT 
    p.id_pedido,
    p.data_pedido,
    p.status,
    c.nome AS cliente,
    f.nome AS atendente,
    COUNT(ip.id_produto) AS qtd_itens,
    fn_total_pedido(p.id_pedido) AS valor_bruto,
    p.desconto_percentual,
    p.valor_total
FROM pedido p
INNER JOIN cliente c ON p.id_cliente = c.id_cliente
INNER JOIN funcionario f ON p.id_funcionario = f.id_funcionario
LEFT JOIN item_pedido ip ON p.id_pedido = ip.id_pedido
GROUP BY 
    p.id_pedido, 
    p.data_pedido, 
    p.status, 
    c.nome, 
    f.nome, 
    p.desconto_percentual, 
    p.valor_total;

-- Teste Questao 9:
SELECT * FROM vw_pedidos_detalhados WHERE status = 'ABERTO';

-- Questao 10: vw_produtos_para_repor
DROP VIEW IF EXISTS vw_produtos_para_repor;

CREATE VIEW vw_produtos_para_repor AS
SELECT 
    p.id_produto,
    p.nome AS produto,
    c.nome AS categoria,
    p.estoque,
    p.estoque_minimo,
    (p.estoque_minimo - p.estoque) AS faltam
FROM produto p
INNER JOIN categoria c ON p.id_categoria = c.id_categoria
WHERE p.ativo = 1
  AND p.estoque <= p.estoque_minimo;

-- Teste Questao 10:
SELECT * FROM vw_produtos_para_repor;

-- Alternativa segura Questao 11 (garante zerar itens não pagos):
-- Questao 11: vw_vendas_por_categoria (versão segura)
DROP VIEW IF EXISTS vw_vendas_por_categoria;

CREATE VIEW vw_vendas_por_categoria AS
SELECT 
    c.nome AS categoria,
    COALESCE(SUM(CASE WHEN ped.status = 'PAGO' THEN ip.quantidade ELSE 0 END), 0) AS unidades,
    COALESCE(SUM(CASE WHEN ped.status = 'PAGO' THEN ip.quantidade * ip.preco_unitario ELSE 0 END), 0.00) AS faturamento
FROM categoria c
LEFT JOIN produto p ON c.id_categoria = p.id_categoria
LEFT JOIN item_pedido ip ON p.id_produto = ip.id_produto
LEFT JOIN pedido ped ON ip.id_pedido = ped.id_pedido
GROUP BY c.id_categoria, c.nome;

-- Teste Questao 11:
SELECT * FROM vw_vendas_por_categoria;


-- Questao 12: trg_item_baixa_estoque
DROP TRIGGER IF EXISTS trg_item_baixa_estoque;

DELIMITER $$

CREATE TRIGGER trg_item_baixa_estoque
AFTER INSERT ON item_pedido
FOR EACH ROW
BEGIN
    UPDATE produto
       SET estoque = estoque - NEW.quantidade
     WHERE id_produto = NEW.id_produto;
END$$

DELIMITER ;

-- Teste Questao 12:
SELECT id_produto, nome, estoque FROM produto WHERE id_produto = 9;
CALL sp_adicionar_item(@novo, 9, 1);
SELECT id_produto, nome, estoque FROM produto WHERE id_produto = 9;

-- Questao 13: trg_item_devolve_estoque
DROP TRIGGER IF EXISTS trg_item_devolve_estoque;

DELIMITER $$

CREATE TRIGGER trg_item_devolve_estoque
AFTER DELETE ON item_pedido
FOR EACH ROW
BEGIN
    UPDATE produto
       SET estoque = estoque + OLD.quantidade
     WHERE id_produto = OLD.id_produto;
END$$

DELIMITER ;

-- Teste Questao 13:
DELETE FROM item_pedido WHERE id_pedido = @novo AND id_produto = 9;
SELECT id_produto, nome, estoque FROM produto WHERE id_produto = 9;

-- Questao 14: trg_produto_historico_preco
DROP TRIGGER IF EXISTS trg_produto_historico_preco;

DELIMITER $$

CREATE TRIGGER trg_produto_historico_preco
AFTER UPDATE ON produto
FOR EACH ROW
BEGIN
    IF OLD.preco <> NEW.preco THEN
        INSERT INTO historico_preco (id_produto, preco_antigo, preco_novo, usuario)
        VALUES (NEW.id_produto, OLD.preco, NEW.preco, CURRENT_USER());
    END IF;
END$$

DELIMITER ;

-- Teste Questao 14:
CALL sp_reajustar_precos_categoria(1, 5);
SELECT * FROM historico_preco;
UPDATE produto SET estoque = 199 WHERE id_produto = 1;
SELECT * FROM historico_preco;

-- Questao 15: trg_pedido_bloqueia_alteracao
DROP TRIGGER IF EXISTS trg_pedido_bloqueia_alteracao;

DELIMITER $$

CREATE TRIGGER trg_pedido_bloqueia_alteracao
BEFORE UPDATE ON pedido
FOR EACH ROW
BEGIN
    IF OLD.status IN ('PAGO', 'CANCELADO') THEN
        SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Não é permitido alterar pedidos com status PAGO ou CANCELADO.';
    END IF;
END$$

DELIMITER ;

-- Teste Questao 15:
-- 1) Deve dar erro:
UPDATE pedido SET valor_total = 1 WHERE id_pedido = 1;

-- 2) Deve funcionar normalmente (finaliza o pedido aberto @novo):
CALL sp_finalizar_pedido(@novo);
SELECT * FROM pedido WHERE id_pedido = @novo;
















