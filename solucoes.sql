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


