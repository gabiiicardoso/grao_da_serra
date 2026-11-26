/* =====================================================================
 * api.js — ÚNICO módulo de acesso a dados da interface
 * Empório & Café Grão da Serra
 *
 * ATENÇÃO: neste momento as funções devolvem DADOS FICTÍCIOS (em memória).
 * Para conectar ao banco, substitua o corpo de cada função por uma chamada
 * real: SELECT nas views e CALL nas procedures (ver comentário "BANCO:"
 * em cada função). O resto da interface (app.js) não precisa mudar,
 * desde que as funções continuem devolvendo os mesmos nomes de colunas.
 *
 * Todas as funções são assíncronas (devolvem Promise), porque a conexão
 * real também será (fetch para um servidor intermediário, por exemplo).
 * Em caso de erro (SIGNAL das procedures/triggers), lance:
 *     throw new Error("mensagem em português vinda do banco");
 * =====================================================================*/

const api = (() => {
  // ------------------------------------------------------------------
  // DADOS FICTÍCIOS (espelham os dados de teste do exercício)
  // ------------------------------------------------------------------
  const categorias = [
    { id_categoria: 1, nome: 'Cafés' },
    { id_categoria: 2, nome: 'Bebidas geladas' },
    { id_categoria: 3, nome: 'Salgados' },
    { id_categoria: 4, nome: 'Doces' },
    { id_categoria: 5, nome: 'Empório' },
  ];

  const produtos = [
    [1, 'Café expresso', 6.0, 200, 30, 1, 1], [2, 'Cappuccino', 11.5, 120, 20, 1, 1],
    [3, 'Café coado na hora', 8.0, 150, 20, 1, 1], [4, 'Suco de laranja', 9.0, 40, 10, 1, 2],
    [5, 'Chá gelado de hibisco', 8.5, 8, 10, 1, 2], [6, 'Pão de queijo', 5.5, 60, 15, 1, 3],
    [7, 'Empada de palmito', 9.5, 4, 10, 1, 3], [8, 'Quiche de alho-poró', 12.0, 0, 6, 1, 3],
    [9, 'Cuca de banana (fatia)', 7.5, 25, 8, 1, 4], [10, 'Strudel de maçã', 13.0, 12, 5, 1, 4],
    [11, 'Bolo de cenoura (fatia)', 8.0, 18, 6, 1, 4], [12, 'Café em grãos 250 g', 34.9, 30, 8, 1, 5],
    [13, 'Geleia colonial de morango', 18.0, 5, 5, 1, 5], [14, 'Mel silvestre 300 g', 27.0, 14, 4, 1, 5],
    [15, 'Torta alemã (fatia)', 12.5, 0, 4, 0, 4],
  ].map(([id_produto, nome, preco, estoque, estoque_minimo, ativo, id_categoria]) =>
    ({ id_produto, nome, preco, estoque, estoque_minimo, ativo, id_categoria }));

  const clientes = [
    { id_cliente: 1, nome: 'Ana Beatriz Schroeder' }, { id_cliente: 2, nome: 'Rafael Linzmeyer' },
    { id_cliente: 3, nome: 'Luana Pscheidt' }, { id_cliente: 4, nome: 'Diego Fendrich' },
    { id_cliente: 5, nome: 'Helena Rudnick' },
  ];

  const funcionarios = [
    { id_funcionario: 1, nome: 'Bruno Tavares', cargo: 'Atendente' },
    { id_funcionario: 2, nome: 'Sofia Grossl', cargo: 'Caixa' },
    { id_funcionario: 3, nome: 'Otávio Weiss', cargo: 'Gerente' },
  ];

  const pedidos = [
    [1, '2026-11-03 08:20:00', 'PAGO', 1, 1], [2, '2026-11-03 15:45:00', 'PAGO', 2, 1],
    [3, '2026-11-04 09:10:00', 'PAGO', 1, 2], [4, '2026-11-05 16:30:00', 'PAGO', 3, 1],
    [5, '2026-11-06 08:05:00', 'PAGO', 1, 2], [6, '2026-11-07 10:50:00', 'PAGO', 2, 1],
    [7, '2026-11-07 17:15:00', 'CANCELADO', 4, 2], [8, '2026-11-09 08:30:00', 'PAGO', 1, 1],
    [9, '2026-11-10 14:00:00', 'ABERTO', 3, 2], [10, '2026-11-10 14:25:00', 'ABERTO', 2, 1],
  ].map(([id_pedido, data_pedido, status, id_cliente, id_funcionario]) =>
    ({ id_pedido, data_pedido, status, desconto_percentual: 0, valor_total: 0, id_cliente, id_funcionario }));

  const itens = [
    [1, 1, 2, 6.0], [1, 6, 4, 5.5], [2, 2, 1, 11.5], [2, 10, 1, 13.0], [3, 3, 1, 8.0], [3, 9, 2, 7.5],
    [3, 12, 1, 34.9], [4, 4, 2, 9.0], [4, 7, 2, 9.5], [5, 1, 1, 6.0], [5, 11, 1, 8.0], [6, 2, 2, 11.5],
    [6, 6, 6, 5.5], [6, 14, 1, 27.0], [7, 13, 2, 18.0], [8, 1, 1, 6.0], [8, 9, 1, 7.5], [9, 5, 2, 8.5],
    [9, 10, 1, 13.0], [10, 3, 2, 8.0], [10, 6, 2, 5.5],
  ].map(([id_pedido, id_produto, quantidade, preco_unitario]) =>
    ({ id_pedido, id_produto, quantidade, preco_unitario }));

  const historico = []; // historico_preco
  const arred = (n) => Math.round(n * 100) / 100;
  const espera = (v) => new Promise((ok) => setTimeout(() => ok(JSON.parse(JSON.stringify(v))), 120));
  const erro = (msg) => Promise.reject(new Error(msg));

  // Apoio interno do FICTÍCIO (no banco real isso são as functions/views)
  const totalPedido = (id) => arred(itens.filter(i => i.id_pedido === id)
    .reduce((s, i) => s + i.quantidade * i.preco_unitario, 0));
  const situacao = (p) => p.estoque === 0 ? 'ESGOTADO' : p.estoque <= p.estoque_minimo ? 'REPOR' : 'OK';
  const nomeCat = (id) => categorias.find(c => c.id_categoria === id).nome;
  pedidos.filter(p => p.status === 'PAGO').forEach(p => { p.valor_total = totalPedido(p.id_pedido); });

  // ------------------------------------------------------------------
  // CONSULTAS
  // ------------------------------------------------------------------

  // BANCO: SELECT * FROM vw_cardapio ORDER BY categoria, produto;
  // Colunas: id_produto, categoria, produto, preco, situacao
  function listarCardapio() {
    return espera(produtos.filter(p => p.ativo).map(p => ({
      id_produto: p.id_produto, categoria: nomeCat(p.id_categoria), produto: p.nome,
      preco: p.preco, situacao: situacao(p),
    })));
  }

    // BANCO: SELECT id_cliente, nome FROM cliente ORDER BY nome;
  async function listarClientes() {
    const resposta = await fetch('http://localhost:3000/clientes');
    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || 'Erro ao buscar clientes no servidor');
    }

    return dados;
  }


  // BANCO: SELECT id_funcionario, nome, cargo FROM funcionario ORDER BY nome;
  function listarFuncionarios() { return espera(funcionarios); }

  // EXTRA (não está na lista do enunciado, mas a tela "Novo pedido" precisa dela):
  // BANCO: SELECT id_categoria, nome FROM categoria ORDER BY nome;
  function listarCategorias() { return espera(categorias); }

  // EXTRA: mostra os itens do pedido em andamento na tela "Novo pedido".
  // BANCO: SELECT i.id_produto, p.nome AS produto, i.quantidade, i.preco_unitario
  //        FROM item_pedido i JOIN produto p ON p.id_produto = i.id_produto
  //        WHERE i.id_pedido = ?;
  function listarItensPedido(idPedido) {
    return espera(itens.filter(i => i.id_pedido === idPedido).map(i => ({
      id_produto: i.id_produto, produto: produtos.find(p => p.id_produto === i.id_produto).nome,
      quantidade: i.quantidade, preco_unitario: i.preco_unitario,
    })));
  }

  // BANCO: SELECT * FROM vw_pedidos_detalhados [WHERE status = ?] ORDER BY id_pedido DESC;
  // Colunas: id_pedido, data_pedido, status, cliente, atendente, qtd_itens,
  //          valor_bruto, desconto_percentual, valor_total
  function listarPedidos(status) {
    return espera(pedidos.filter(p => !status || p.status === status).map(p => ({
      id_pedido: p.id_pedido, data_pedido: p.data_pedido, status: p.status,
      cliente: clientes.find(c => c.id_cliente === p.id_cliente).nome,
      atendente: funcionarios.find(f => f.id_funcionario === p.id_funcionario).nome,
      qtd_itens: itens.filter(i => i.id_pedido === p.id_pedido).length,
      valor_bruto: totalPedido(p.id_pedido),
      desconto_percentual: p.desconto_percentual, valor_total: p.valor_total,
    })).sort((a, b) => b.id_pedido - a.id_pedido));
  }

  // BANCO: SELECT * FROM vw_produtos_para_repor;
  // Colunas: id_produto, produto, categoria, estoque, estoque_minimo, faltam
  function listarProdutosParaRepor() {
    return espera(produtos.filter(p => p.ativo && p.estoque <= p.estoque_minimo).map(p => ({
      id_produto: p.id_produto, produto: p.nome, categoria: nomeCat(p.id_categoria),
      estoque: p.estoque, estoque_minimo: p.estoque_minimo, faltam: p.estoque_minimo - p.estoque,
    })));
  }

  // BANCO: SELECT * FROM vw_vendas_por_categoria;
  // Colunas: categoria, unidades, faturamento
  function listarVendasPorCategoria() {
    return espera(categorias.map(c => {
      const vendidos = itens.filter(i => pedidos.find(p => p.id_pedido === i.id_pedido).status === 'PAGO'
        && produtos.find(p => p.id_produto === i.id_produto).id_categoria === c.id_categoria);
      return {
        categoria: c.nome, unidades: vendidos.reduce((s, i) => s + i.quantidade, 0),
        faturamento: arred(vendidos.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)),
      };
    }));
  }

  // BANCO: SELECT * FROM historico_preco ORDER BY id_historico DESC;
  // Colunas: id_historico, id_produto, preco_antigo, preco_novo, data_alteracao, usuario
  function listarHistoricoPrecos() { return espera([...historico].reverse()); }

  // ------------------------------------------------------------------
  // OPERAÇÕES (procedures)
  // ------------------------------------------------------------------

  // BANCO: CALL sp_abrir_pedido(?, ?, @id); SELECT @id AS id_pedido;
  // Devolve: { id_pedido }
  function abrirPedido(idCliente, idFuncionario) {
    const id = Math.max(...pedidos.map(p => p.id_pedido)) + 1;
    pedidos.push({ id_pedido: id, data_pedido: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'ABERTO', desconto_percentual: 0, valor_total: 0,
      id_cliente: idCliente, id_funcionario: idFuncionario });
    return espera({ id_pedido: id });
  }

  // BANCO: CALL sp_adicionar_item(?, ?, ?);
  // Os erros (SIGNAL) chegam como exceção com a mensagem do banco.
  function adicionarItem(idPedido, idProduto, quantidade) {
    // (validações abaixo existem só para o FICTÍCIO exibir mensagens; no banco
    //  quem valida é a procedure)
    const ped = pedidos.find(p => p.id_pedido === idPedido);
    const prod = produtos.find(p => p.id_produto === idProduto);
    if (!ped || ped.status !== 'ABERTO') return erro('Pedido inexistente ou não está aberto.');
    if (!prod || !prod.ativo) return erro('Produto inexistente ou inativo.');
    if (!(quantidade > 0)) return erro('A quantidade deve ser maior que zero.');
    if (prod.estoque < quantidade) return erro('Estoque insuficiente para a quantidade pedida.');
    const existente = itens.find(i => i.id_pedido === idPedido && i.id_produto === idProduto);
    if (existente) return erro('Duplicate entry: este produto já está no pedido (remova-o e adicione de novo).');
    itens.push({ id_pedido: idPedido, id_produto: idProduto, quantidade, preco_unitario: prod.preco });
    prod.estoque -= quantidade; // (no banco: trigger trg_item_baixa_estoque)
    return espera({ ok: true });
  }

  // BANCO: DELETE FROM item_pedido WHERE id_pedido = ? AND id_produto = ?;
  function removerItem(idPedido, idProduto) {
    const pos = itens.findIndex(i => i.id_pedido === idPedido && i.id_produto === idProduto);
    if (pos >= 0) {
      produtos.find(p => p.id_produto === idProduto).estoque += itens[pos].quantidade; // (trigger)
      itens.splice(pos, 1);
    }
    return espera({ ok: true });
  }

  // BANCO: CALL sp_finalizar_pedido(?); depois
  //        SELECT desconto_percentual, valor_total FROM vw_pedidos_detalhados WHERE id_pedido = ?;
  // Devolve: { desconto_percentual, valor_total }
  function finalizarPedido(idPedido) {
    const ped = pedidos.find(p => p.id_pedido === idPedido);
    if (!ped) return erro('Pedido inexistente.');
    if (ped.status !== 'ABERTO') return erro('Só é possível finalizar pedidos abertos.');
    if (!itens.some(i => i.id_pedido === idPedido)) return erro('O pedido não possui itens.');
    const pagos = pedidos.filter(p => p.id_cliente === ped.id_cliente && p.status === 'PAGO').length;
    ped.desconto_percentual = pagos >= 4 ? 10 : pagos >= 2 ? 5 : 0;
    ped.valor_total = arred(totalPedido(idPedido) * (1 - ped.desconto_percentual / 100));
    ped.status = 'PAGO';
    return espera({ desconto_percentual: ped.desconto_percentual, valor_total: ped.valor_total });
  }

  // BANCO: CALL sp_reajustar_precos_categoria(?, ?);
  function reajustarPrecos(idCategoria, percentual) {
    if (!categorias.some(c => c.id_categoria === idCategoria)) return erro('Categoria inexistente.');
    if (percentual <= -100) return erro('O percentual não pode ser menor ou igual a -100.');
    produtos.filter(p => p.id_categoria === idCategoria).forEach(p => {
      const novo = arred(p.preco * (1 + percentual / 100));
      if (novo !== p.preco) {
        historico.push({ id_historico: historico.length + 1, id_produto: p.id_produto, preco_antigo: p.preco,
          preco_novo: novo, data_alteracao: new Date().toISOString().slice(0, 19).replace('T', ' '),
          usuario: 'gerente@localhost' }); // (no banco: trigger trg_produto_historico_preco)
        p.preco = novo;
      }
    });
    return espera({ ok: true });
  }

  return { listarCardapio, listarClientes, listarFuncionarios, listarCategorias, listarItensPedido,
    abrirPedido, adicionarItem, removerItem, finalizarPedido, listarPedidos,
    listarProdutosParaRepor, listarVendasPorCategoria, reajustarPrecos, listarHistoricoPrecos };
})();
