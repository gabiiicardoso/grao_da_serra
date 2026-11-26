/* =====================================================================
 * app.js — lógica da interface (telas e navegação)
 * A interface NÃO calcula totais, descontos nem estoque: só exibe o que
 * o banco devolve (via api.js) e aciona as rotinas.
 * =====================================================================*/

const $ = (id) => document.getElementById(id);
const dinheiro = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let pedidoAtual = null;      // número do pedido em andamento (devolvido por sp_abrir_pedido)
let filtroStatus = '';       // filtro da tela Pedidos

// ---------- Mensagens (sucesso / erro do banco) ----------
let temporizador;
function mostrarMensagem(texto, tipo = 'ok') {
  const el = $('mensagem');
  el.textContent = texto; el.className = 'mensagem ' + tipo; el.hidden = false;
  clearTimeout(temporizador);
  if (tipo === 'ok') temporizador = setTimeout(() => (el.hidden = true), 4000);
}

// Executa uma operação, mostra o erro (SIGNAL) se houver e recarrega os dados da tela
async function executar(operacao, mensagemOk) {
  try {
    const r = await operacao();
    if (mensagemOk) mostrarMensagem(mensagemOk);
    return r;
  } catch (e) {
    mostrarMensagem(e.message || 'Erro inesperado.', 'erro');
    return undefined;
  } finally {
    await recarregarTudo();
  }
}

// ---------- Navegação ----------
$('menu').addEventListener('click', (ev) => {
  const tela = ev.target.dataset.tela; if (!tela) return;
  document.querySelectorAll('#menu button').forEach((b) => b.classList.toggle('ativo', b === ev.target));
  document.querySelectorAll('.tela').forEach((s) => (s.hidden = s.id !== 'tela-' + tela));
  $('mensagem').hidden = true;
  recarregarTudo();
});

// ---------- Telas ----------
async function carregarCardapio() {
  const lista = await api.listarCardapio();
  const grupos = {};
  lista.forEach((p) => (grupos[p.categoria] ||= []).push(p));
  $('cardapio').innerHTML = Object.entries(grupos).map(([cat, ps]) => `
    <div class="categoria"><h2>${escapar(cat)}</h2><div class="produtos">
      ${ps.map((p) => `<div class="produto ${p.situacao}">
        <div>${escapar(p.produto)}</div><div class="preco">${dinheiro(p.preco)}</div>
        ${p.situacao === 'ESGOTADO' ? '<span class="aviso">Esgotado</span>' : ''}
        ${p.situacao === 'REPOR' ? '<span class="aviso">Últimas unidades</span>' : ''}
      </div>`).join('')}
    </div></div>`).join('');
  // Lista de produtos da tela "Novo pedido": esgotados ficam desabilitados
  const sel = $('selProduto'), atual = sel.value;
  sel.innerHTML = lista.map((p) => `<option value="${p.id_produto}" ${p.situacao === 'ESGOTADO' ? 'disabled' : ''}>
    ${escapar(p.produto)} — ${dinheiro(p.preco)}${p.situacao === 'ESGOTADO' ? ' (esgotado)' : ''}</option>`).join('');
  if (atual) sel.value = atual;
}

async function carregarCadastros() {
  const [clientes, funcs, cats] = await Promise.all([api.listarClientes(), api.listarFuncionarios(), api.listarCategorias()]);
  const manter = (sel, html) => { const v = sel.value; sel.innerHTML = html; if (v) sel.value = v; };
  manter($('selCliente'), clientes.map((c) => `<option value="${c.id_cliente}">${escapar(c.nome)}</option>`).join(''));
  manter($('selFuncionario'), funcs.map((f) => `<option value="${f.id_funcionario}">${escapar(f.nome)} (${escapar(f.cargo)})</option>`).join(''));
  manter($('selCategoria'), cats.map((c) => `<option value="${c.id_categoria}">${escapar(c.nome)}</option>`).join(''));
}

async function carregarItens() {
  const ativo = pedidoAtual !== null;
  $('numPedido').textContent = ativo ? `(pedido nº ${pedidoAtual})` : '';
  $('infoPedido').textContent = ativo ? `Pedido nº ${pedidoAtual} aberto. Adicione os itens ao lado.` : 'Nenhum pedido em andamento.';
  ['btnAdicionar', 'btnFinalizar', 'selProduto', 'inpQtd'].forEach((id) => ($(id).disabled = !ativo));
  if (!ativo) { $('tabItens').innerHTML = '<tr><td colspan="4" class="vazio">Abra um pedido para começar.</td></tr>'; return; }
  const itens = await api.listarItensPedido(pedidoAtual);
  $('tabItens').innerHTML = itens.length ? itens.map((i) => `<tr><td>${escapar(i.produto)}</td>
      <td class="num">${i.quantidade}</td><td class="num">${dinheiro(i.preco_unitario)}</td>
      <td class="num"><button class="botao-remover" data-remover="${i.id_produto}">Remover</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="vazio">Nenhum item ainda.</td></tr>';
}

async function carregarPedidos() {
  const lista = await api.listarPedidos(filtroStatus || undefined);
  $('tabPedidos').innerHTML = lista.length ? lista.map((p) => `<tr>
      <td>${p.id_pedido}</td><td>${escapar(p.data_pedido)}</td>
      <td><span class="etiqueta ${p.status}">${p.status}</span></td>
      <td>${escapar(p.cliente)}</td><td>${escapar(p.atendente)}</td><td class="num">${p.qtd_itens}</td>
      <td class="num">${dinheiro(p.valor_bruto)}</td><td class="num">${Number(p.desconto_percentual).toFixed(0)}%</td>
      <td class="num">${dinheiro(p.valor_total)}</td></tr>`).join('')
    : '<tr><td colspan="9" class="vazio">Nenhum pedido encontrado.</td></tr>';
}

async function carregarGerencia() {
  const [repor, vendas, hist] = await Promise.all([api.listarProdutosParaRepor(), api.listarVendasPorCategoria(), api.listarHistoricoPrecos()]);
  $('tabRepor').innerHTML = repor.length ? repor.map((p) => `<tr><td>${escapar(p.produto)}</td><td>${escapar(p.categoria)}</td>
    <td class="num">${p.estoque}</td><td class="num">${p.estoque_minimo}</td><td class="num">${p.faltam}</td></tr>`).join('')
    : '<tr><td colspan="5" class="vazio">Nada para repor.</td></tr>';
  $('tabVendas').innerHTML = vendas.map((v) => `<tr><td>${escapar(v.categoria)}</td><td class="num">${v.unidades}</td>
    <td class="num">${dinheiro(v.faturamento)}</td></tr>`).join('');
  $('tabHistorico').innerHTML = hist.length ? hist.map((h) => `<tr><td>${escapar(h.data_alteracao)}</td><td>${h.id_produto}</td>
    <td class="num">${dinheiro(h.preco_antigo)}</td><td class="num">${dinheiro(h.preco_novo)}</td><td>${escapar(h.usuario)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="vazio">Nenhum reajuste registrado.</td></tr>';
}

// Recarrega tudo após cada operação (estoque e situação mudam por causa dos triggers)
async function recarregarTudo() {
  try { await Promise.all([carregarCardapio(), carregarCadastros(), carregarItens(), carregarPedidos(), carregarGerencia()]); }
  catch (e) { mostrarMensagem('Falha ao carregar dados: ' + e.message, 'erro'); }
}

// ---------- Ações ----------
$('btnAbrir').onclick = () => executar(async () => {
  const r = await api.abrirPedido(Number($('selCliente').value), Number($('selFuncionario').value));
  pedidoAtual = r.id_pedido; $('resultadoFinal').hidden = true;
}, 'Pedido aberto.');

$('btnAdicionar').onclick = () => executar(
  () => api.adicionarItem(pedidoAtual, Number($('selProduto').value), Number($('inpQtd').value)), 'Item adicionado.');

$('tabItens').onclick = (ev) => {
  const id = ev.target.dataset.remover; if (!id) return;
  executar(() => api.removerItem(pedidoAtual, Number(id)), 'Item removido.');
};

$('btnFinalizar').onclick = async () => {
  const r = await executar(() => api.finalizarPedido(pedidoAtual));
  if (!r) return; // erro já exibido
  const el = $('resultadoFinal');
  el.innerHTML = `Pedido nº ${pedidoAtual} pago.<br>Desconto aplicado: <strong>${Number(r.desconto_percentual).toFixed(0)}%</strong><br>
    Valor total: <strong>${dinheiro(r.valor_total)}</strong>`;
  el.hidden = false; pedidoAtual = null; await carregarItens();
};

$('filtros').onclick = (ev) => {
  if (ev.target.dataset.status === undefined) return;
  filtroStatus = ev.target.dataset.status;
  document.querySelectorAll('#filtros button').forEach((b) => b.classList.toggle('ativo', b === ev.target));
  carregarPedidos();
};

$('btnReajustar').onclick = () => executar(
  () => api.reajustarPrecos(Number($('selCategoria').value), Number($('inpPercentual').value)), 'Reajuste aplicado.');

recarregarTudo();
