// admin_shared.js (v16)
const SUPABASE_URL = 'https://mmcwmzesjtnqgpcdspir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY3dtemVzanRucWdwY2RzcGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NTgyMzUsImV4cCI6MjExMDAzNDIzNX0.VfOyJpZ5Xl30CvLtP-ZpAl1BO1ijVU8ChpabOPmel-E';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_USER_PADRAO = 'admin';
function obterSenhaMestre() {
  return localStorage.getItem('admin_master_pass') || 'admin123';
}

let listaUsuariosCache = [];
let usuarioModalAtual = null;
const blobUrlCacheAdmin = {};

function normalizarStatusConta(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'em_analise' || s === 'pendente') return 'pendente';
  if (s === 'bloqueado') return 'bloqueado';
  if (s === 'aprovado' || s === 'ativo') return 'aprovado';
  return 'aprovado';
}

function ehPerfilMotoristaAdmin(user) {
  if (!user) return false;
  return Boolean(
    user.tipo === 'motorista' ||
    user.veiculo_modelo ||
    user.veiculo_placa ||
    user.veiculo2_modelo ||
    user.veiculo2_placa ||
    user.veiculo2_documento_url
  );
}

function temSegundoVeiculoCadastrado(user) {
  if (!user) return false;
  return Boolean(
    user.veiculo2_marca ||
    user.veiculo2_modelo ||
    user.veiculo2_cor ||
    user.veiculo2_ano ||
    user.veiculo2_placa ||
    user.veiculo2_documento_url
  );
}

function temSegundoVeiculoPendenteAdmin(user) {
  if (!user || !temSegundoVeiculoCadastrado(user)) return false;
  const stV2 = String(user.veiculo2_status || 'pendente').toLowerCase().trim();
  return stV2 === 'pendente' || stV2 === 'em_analise' || stV2 === '';
}

function usuarioEstaAtivoNoAppAdmin(user) {
  if (!user || user.online !== true) return false;
  const refTempo = user.ultimo_acesso || user.ultima_atividade || user.updated_at;
  if (!refTempo) return false;
  const diffMs = Date.now() - new Date(refTempo).getTime();
  return !Number.isNaN(diffMs) && diffMs >= 0 && diffMs <= 60000;
}

function filtrarUsuariosPorSetorAdmin(lista, setor) {
  const arr = Array.isArray(lista) ? lista : [];
  const setorLimpo = String(setor || 'todos').toLowerCase().trim();

  if (setorLimpo === 'todos') {
    return arr.filter(u => normalizarStatusConta(u.status) === 'aprovado');
  }
  if (setorLimpo === 'online') {
    return arr.filter(u => usuarioEstaAtivoNoAppAdmin(u) && normalizarStatusConta(u.status) === 'aprovado');
  }
  if (setorLimpo === 'analise' || setorLimpo === 'pendente') {
    return arr.filter(u => normalizarStatusConta(u.status) === 'pendente');
  }
  if (setorLimpo === 'bloqueados' || setorLimpo === 'bloqueado') {
    return arr.filter(u => normalizarStatusConta(u.status) === 'bloqueado');
  }
  if (setorLimpo === 'segundo_carro') {
    return arr.filter(u => ehPerfilMotoristaAdmin(u) && temSegundoVeiculoPendenteAdmin(u));
  }
  return arr.filter(u => normalizarStatusConta(u.status) === normalizarStatusConta(setorLimpo));
}

function obterUrlSeguraDocumentoAdmin(url, chaveCache) {
  if (!url) return '';
  const str = String(url).trim();
  if (!str.startsWith('data:')) return str;

  if (chaveCache && blobUrlCacheAdmin[chaveCache]) {
    return blobUrlCacheAdmin[chaveCache];
  }

  try {
    const partes = str.split(',');
    const meta = partes[0] || '';
    const base64 = partes[1] || '';
    const mimeMatch = meta.match(/data:([^;]+);base64/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    if (chaveCache) blobUrlCacheAdmin[chaveCache] = blobUrl;
    return blobUrl;
  } catch (e) {
    return str;
  }
}

function abrirDocumentoExternamenteAdmin(qualVeiculo) {
  if (!usuarioModalAtual) return;
  const isV2 = qualVeiculo === 'v2';
  const rawUrl = isV2 ? usuarioModalAtual.veiculo2_documento_url : usuarioModalAtual.documento_identificacao_url;
  const nomeArq = isV2
    ? (usuarioModalAtual.veiculo2_documento_nome || 'crlv_veiculo_2')
    : (usuarioModalAtual.documento_identificacao_nome || 'crlv_veiculo_1');

  if (!rawUrl) {
    mostrarAlertaModal("Nenhum arquivo de CRLV encontrado para este veículo.", "erro");
    return;
  }

  const safeUrl = obterUrlSeguraDocumentoAdmin(rawUrl, `${usuarioModalAtual.id}_${qualVeiculo}`);
  const win = window.open(safeUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    const a = document.createElement('a');
    a.href = safeUrl;
    a.download = nomeArq;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function ampliarPreviaDocumentoAdmin(qualVeiculo) {
  if (!usuarioModalAtual) return;
  const isV2 = qualVeiculo === 'v2';
  const rawUrl = isV2 ? usuarioModalAtual.veiculo2_documento_url : usuarioModalAtual.documento_identificacao_url;
  const nomeArq = isV2
    ? (usuarioModalAtual.veiculo2_documento_nome || 'CRLV do 2º Veículo')
    : (usuarioModalAtual.documento_identificacao_nome || 'CRLV do 1º Veículo');

  if (!rawUrl) return;

  const safeUrl = obterUrlSeguraDocumentoAdmin(rawUrl, `${usuarioModalAtual.id}_${qualVeiculo}`);
  const box = document.getElementById('modal-previa-ampliada');
  const titulo = document.getElementById('previa-ampliada-titulo');
  const img = document.getElementById('previa-ampliada-img');
  const frame = document.getElementById('previa-ampliada-frame');
  const btnExt = document.getElementById('previa-ampliada-btn-externo');

  titulo.innerText = nomeArq;
  btnExt.onclick = () => abrirDocumentoExternamenteAdmin(qualVeiculo);

  const isImagem = String(rawUrl).startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(rawUrl));
  if (isImagem) {
    img.src = safeUrl;
    img.classList.remove('hidden');
    frame.classList.add('hidden');
    frame.src = '';
  } else {
    frame.src = safeUrl;
    frame.classList.remove('hidden');
    img.classList.add('hidden');
    img.src = '';
  }

  box.classList.remove('hidden');
}

function fecharPreviaDocumentoAdmin() {
  const box = document.getElementById('modal-previa-ampliada');
  const img = document.getElementById('previa-ampliada-img');
  const frame = document.getElementById('previa-ampliada-frame');
  if (img) { img.src = ''; img.classList.add('hidden'); }
  if (frame) { frame.src = ''; frame.classList.add('hidden'); }
  if (box) box.classList.add('hidden');
}

function inicializarLayoutAdmin(paginaAtiva) {
  const headerENav = `
    <!-- TELA DE LOGIN MESTRE ADMIN -->
    <div id="tela-login-admin" class="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl">
        <div class="text-center space-y-2">
          <div class="w-14 h-14 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <i class="fa-solid fa-shield-halved text-2xl"></i>
          </div>
          <h2 class="text-base font-extrabold text-white">Acesso Administrativo</h2>
          <p class="text-[11px] text-slate-400">Insira as credenciais de Administrador Mestre</p>
        </div>
        <form onsubmit="autenticarAdmin(event)" class="space-y-3 text-xs">
          <div class="space-y-1">
            <label class="text-slate-300 font-medium">Usuário Admin</label>
            <input type="text" id="login-admin-user" required placeholder="admin" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:border-emerald-500 outline-none">
          </div>
          <div class="space-y-1">
            <label class="text-slate-300 font-medium">Senha Mestre</label>
            <input type="password" id="login-admin-pass" required placeholder="••••••" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:border-emerald-500 outline-none">
          </div>
          <p id="login-admin-erro" class="text-red-400 text-[11px] font-semibold hidden text-center">Usuário ou senha mestre incorretos.</p>
          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg">Entrar no Painel</button>
        </form>
        <div class="pt-2 border-t border-slate-800 text-center">
          <a href="index.html" class="text-[11px] text-slate-400 hover:text-emerald-400 transition">
            <i class="fa-solid fa-arrow-left mr-1"></i> Voltar para o Aplicativo
          </a>
        </div>
      </div>
    </div>

    <!-- TOPO FIXO -->
    <header class="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center shrink-0">
      <a href="admin.html" class="flex items-center gap-3 hover:opacity-90 transition">
        <div class="bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 p-2 rounded-xl">
          <i class="fa-solid fa-shield-halved text-base"></i>
        </div>
        <div>
          <h1 class="text-sm font-extrabold text-white">Painel Administrativo <span class="text-[10px] text-slate-500 font-mono">v16</span></h1>
          <p class="text-[10px] text-slate-400">Gestão Avançada e Suporte</p>
        </div>
      </a>
      <div class="flex gap-2">
        <button onclick="abrirModalSenhaMestre()" title="Alterar Senha Mestre" class="bg-slate-800 hover:bg-slate-700 text-amber-400 px-3 py-2 rounded-xl font-bold border border-slate-700">
          <i class="fa-solid fa-key"></i>
        </button>
        <button onclick="atualizarDadosGlobais()" title="Atualizar Dados" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl font-bold border border-slate-700">
          <i class="fa-solid fa-rotate"></i>
        </button>
        <button onclick="sairAdmin()" class="bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-400 px-3 py-2 rounded-xl font-bold border border-slate-700">Sair</button>
      </div>
    </header>

    <!-- NAVEGAÇÃO ENTRE PÁGINAS SEPARADAS -->
    <nav class="bg-slate-900 border-b border-slate-800 px-3 py-2 grid grid-cols-5 gap-1.5 shrink-0 text-[11px]">
      <a href="admin.html" class="py-2 px-1.5 rounded-xl font-bold ${paginaAtiva === 'inicio' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} transition text-center truncate">
        <i class="fa-solid fa-house mr-1"></i> Início
      </a>
      <a href="adminmotorista.html" class="py-2 px-1.5 rounded-xl font-bold ${paginaAtiva === 'motorista' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} transition text-center truncate">
        <i class="fa-solid fa-car mr-1"></i> Motoristas (<span id="nav-count-motoristas">0</span>)
      </a>
      <a href="adminpassageiro.html" class="py-2 px-1.5 rounded-xl font-bold ${paginaAtiva === 'passageiro' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} transition text-center truncate">
        <i class="fa-solid fa-users mr-1"></i> Passageiros (<span id="nav-count-passageiros">0</span>)
      </a>
      <a href="adminviagens.html" class="py-2 px-1.5 rounded-xl font-bold ${paginaAtiva === 'viagens' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} transition text-center truncate">
        <i class="fa-solid fa-route mr-1"></i> Viagens (<span id="nav-count-viagens">0</span>)
      </a>
      <a href="adminsuporte.html" class="relative py-2 px-1.5 rounded-xl font-bold ${paginaAtiva === 'suporte' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'} transition text-center truncate">
        <i class="fa-solid fa-headset mr-1"></i> Suporte
        <span id="nav-badge-suporte" class="hidden absolute -top-1 -right-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-extrabold animate-pulse">+0</span>
      </a>
    </nav>
  `;

  const modaisHtml = `
    <!-- MODAL DE EDIÇÃO AVANÇADA -->
    <div id="modal-edicao" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 hidden flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <div id="modal-alerta-toast" class="hidden p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-md">
          <i id="modal-alerta-icone" class="fa-solid text-sm"></i>
          <span id="modal-alerta-texto" class="flex-1"></span>
        </div>

        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 class="font-extrabold text-white text-sm flex items-center gap-2">
            <i class="fa-solid fa-user-pen text-emerald-400"></i> Gestão de Perfil do Usuário
          </h3>
          <button onclick="fecharModalEdicao()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark text-base"></i></button>
        </div>

        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
          <div>
            <span class="text-[10px] text-slate-400 block">ID Único no Banco:</span>
            <span id="edit-id-display" class="font-mono text-emerald-400 font-bold select-all text-[11px]">-</span>
          </div>
          <div class="text-right">
            <span id="edit-tipo-badge" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Usuário</span>
          </div>
        </div>

        <!-- ABAS DO MODAL (VEÍCULOS EXIBIDA APENAS QUANDO FOR MOTORISTA) -->
        <div id="abas-modal-usuario" class="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button type="button" onclick="mudarAbaModal('dados')" id="tab-btn-dados" class="flex-1 min-w-[65px] py-2 px-2 rounded-lg font-bold bg-emerald-600 text-white transition">Dados</button>
          <button type="button" onclick="mudarAbaModal('veiculos')" id="tab-btn-veiculos" class="flex-1 min-w-[75px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition hidden">Veículos</button>
          <button type="button" onclick="mudarAbaModal('viagens')" id="tab-btn-viagens" class="flex-1 min-w-[65px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition">Viagens</button>
          <button type="button" onclick="mudarAbaModal('chat')" id="tab-btn-chat" class="flex-1 min-w-[55px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition">Chat</button>
          <button type="button" onclick="mudarAbaModal('suporte')" id="tab-btn-suporte" class="flex-1 min-w-[65px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition">Suporte</button>
          <button type="button" onclick="mudarAbaModal('status')" id="tab-btn-status" class="flex-1 min-w-[60px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition">Status</button>
        </div>

        <form id="form-editar-usuario" onsubmit="salvarEdicaoUsuario(event)" class="space-y-4 text-xs">
          <input type="hidden" id="edit-id">

          <!-- ABA DADOS: SOMENTE NOME COMPLETO, CPF, CELULAR E ENDEREÇO -->
          <div id="modal-conteudo-dados" class="space-y-3">
            <div class="flex items-center gap-3 pb-2 border-b border-slate-800">
              <img id="edit-foto-preview" class="w-14 h-14 rounded-full object-cover border border-emerald-500">
              <div>
                <p class="font-bold text-white uppercase text-[10px]">Conta Verificada</p>
                <p class="text-[10px] text-slate-400">Painel Administrativo</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">Nome Completo</label>
                <input type="text" id="edit-nome" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
              </div>
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">CPF</label>
                <input type="text" id="edit-cpf" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">Celular</label>
                <input type="text" id="edit-telefone" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
              </div>
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">Endereço</label>
                <input type="text" id="edit-endereco" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
              </div>
            </div>
          </div>

          <!-- ABA VEÍCULOS (VEÍCULO 1 E VEÍCULO 2 COM EDIÇÃO MANUAL COMPLETA) -->
          <div id="modal-conteudo-veiculos" class="space-y-3 hidden">
            <div class="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button type="button" onclick="mudarSubAbaVeiculoModal('v1')" id="subtab-v1" class="py-2 px-2 rounded-lg font-bold bg-emerald-600 text-white transition">
                <i class="fa-solid fa-car mr-1"></i> Veículo 1
              </button>
              <button type="button" onclick="mudarSubAbaVeiculoModal('v2')" id="subtab-v2" class="py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition hidden">
                <i class="fa-solid fa-car-side mr-1"></i> Veículo 2 <span id="subtab-v2-badge" class="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Pendente</span>
              </button>
            </div>

            <!-- SUB-ABA VEÍCULO 1 (EDITÁVEL MANUALMENTE PELO ADMIN) -->
            <div id="conteudo-subtab-v1" class="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold text-emerald-400 uppercase">Dados do Veículo 1 (CRLV)</span>
                <span class="text-[10px] text-slate-400">Conta Principal</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Marca</label>
                  <input type="text" id="edit-v1-marca" placeholder="Ex: VW" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Modelo</label>
                  <input type="text" id="edit-v1-modelo" placeholder="Ex: Gol" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Cor</label>
                  <input type="text" id="edit-v1-cor" placeholder="Ex: Prata" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Ano</label>
                  <input type="text" id="edit-v1-ano" placeholder="Ex: 2015" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Placa</label>
                  <input type="text" id="edit-v1-placa" placeholder="ABC-1234" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 uppercase text-slate-100 font-mono text-[11px]">
                </div>
              </div>

              <div class="pt-2 border-t border-slate-800/80 space-y-2">
                <div class="flex items-center justify-between gap-2 text-[10px]">
                  <span class="text-slate-400 truncate">CRLV (Veículo 1): <strong id="v1-doc-nome" class="text-slate-200 font-mono">-</strong></span>
                  <button type="button" id="v1-doc-btn-ext" onclick="abrirDocumentoExternamenteAdmin('v1')" class="hidden shrink-0 bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-lg font-bold border border-slate-700">
                    <i class="fa-solid fa-up-right-from-square mr-1"></i> Abrir Original Externo
                  </button>
                </div>
                <img id="v1-doc-img" src="" alt="CRLV Veículo 1" onclick="ampliarPreviaDocumentoAdmin('v1')" title="Clique para ampliar prévia no modal" class="hidden w-full max-h-44 object-contain rounded-xl border border-slate-800 bg-slate-900 cursor-zoom-in">
              </div>
            </div>

            <!-- SUB-ABA VEÍCULO 2 (EDITÁVEL + APROVAR / RECUSAR VEÍCULO) -->
            <div id="conteudo-subtab-v2" class="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 space-y-3 hidden">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-extrabold text-amber-400 uppercase">Dados do Veículo 2 (CRLV)</span>
                <span id="v2-status-badge" class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300">pendente</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Marca</label>
                  <input type="text" id="edit-v2-marca" placeholder="Ex: Chevrolet" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Modelo</label>
                  <input type="text" id="edit-v2-modelo" placeholder="Ex: Onix" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Cor</label>
                  <input type="text" id="edit-v2-cor" placeholder="Ex: Branco" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Ano</label>
                  <input type="text" id="edit-v2-ano" placeholder="Ex: 2020" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                </div>
                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Placa</label>
                  <input type="text" id="edit-v2-placa" placeholder="DEF-5678" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 uppercase text-slate-100 font-mono text-[11px]">
                </div>
              </div>

              <div class="pt-2 border-t border-slate-800 space-y-2">
                <div class="flex items-center justify-between gap-2 text-[10px]">
                  <span class="text-slate-300 font-bold truncate">CRLV (Veículo 2): <span id="v2-doc-nome" class="text-amber-300 font-mono">-</span></span>
                  <button type="button" id="v2-doc-btn-ext" onclick="abrirDocumentoExternamenteAdmin('v2')" class="hidden shrink-0 bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-lg font-bold border border-slate-700">
                    <i class="fa-solid fa-up-right-from-square mr-1"></i> Abrir Original Externo
                  </button>
                </div>
                <img id="v2-doc-img" src="" alt="CRLV Veículo 2" onclick="ampliarPreviaDocumentoAdmin('v2')" title="Clique para ampliar prévia no modal" class="hidden w-full max-h-52 object-contain rounded-xl border border-slate-700 bg-slate-900 cursor-zoom-in">
              </div>

              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button type="button" onclick="decidirSegundoVeiculoAdmin('aprovado')" class="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5">
                  <i class="fa-solid fa-check"></i> Aprovar Veículo
                </button>
                <button type="button" onclick="decidirSegundoVeiculoAdmin('recusado')" class="bg-red-600/20 hover:bg-red-600/35 text-red-300 border border-red-500/40 py-2.5 px-3 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5">
                  <i class="fa-solid fa-xmark"></i> Recusar Veículo
                </button>
              </div>
              <p class="text-[10px] text-slate-400">
                Ao <strong>Recusar Veículo</strong>, o 2º veículo é removido/bloqueado para que o motorista possa enviar um novo cadastro corretamente, sem alterar o status da conta.
              </p>
            </div>
          </div>

          <!-- ABA VIAGENS -->
          <div id="modal-conteudo-viagens" class="space-y-3 hidden">
            <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 max-h-60 overflow-y-auto" id="detalhes-historico-usuario"></div>
          </div>

          <!-- ABA CHAT -->
          <div id="modal-conteudo-chat" class="space-y-3 hidden">
            <div class="space-y-2">
              <h4 class="font-extrabold text-white text-xs flex items-center gap-1.5">
                <i class="fa-solid fa-comments text-amber-400"></i> Histórico de Mensagens (Chat)
              </h4>
              <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto" id="detalhes-chat-usuario"></div>
            </div>
          </div>

          <!-- ABA SUPORTE -->
          <div id="modal-conteudo-suporte" class="space-y-3 hidden">
            <div class="space-y-3">
              <h4 class="font-extrabold text-white text-xs flex items-center gap-1.5">
                <i class="fa-solid fa-headset text-emerald-400"></i> Histórico de Ocorrências e Suporte com o Usuário
              </h4>
              <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-3 max-h-52 overflow-y-auto" id="detalhes-suporte-usuario"></div>
              <div class="bg-slate-950 p-3 rounded-2xl border border-emerald-500/30 space-y-2">
                <label class="text-emerald-400 font-bold block"><i class="fa-solid fa-paper-plane mr-1"></i> Enviar Mensagem/Aviso de Suporte ao App do Usuário</label>
                <textarea id="input-resposta-suporte" rows="2" placeholder="Digite sua resposta ou aviso para o usuário..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-xs outline-none focus:border-emerald-500"></textarea>
                <button type="button" onclick="enviarMensagemSuporteUsuario()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition shadow">Enviar Mensagem para o Usuário</button>
              </div>
            </div>
          </div>

          <!-- ABA STATUS -->
          <div id="modal-conteudo-status" class="space-y-3 hidden">
            <div class="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <label class="text-slate-300 font-bold block">Status da Conta & Setor</label>
              <p class="text-[10px] text-slate-400 leading-relaxed">
                <strong>Ativo:</strong> uso liberado. <strong>Em Análise:</strong> bloqueio temporário no app e envio ao setor <em>Em Análise</em>. <strong>Bloqueado:</strong> bloqueio severo e envio ao setor <em>Bloqueados</em>.
              </p>
              <div class="grid grid-cols-3 gap-2 pt-1">
                <button type="button" onclick="definirStatusModal('aprovado')" id="btn-status-ativo" class="py-2 rounded-xl font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">Ativo</button>
                <button type="button" onclick="definirStatusModal('pendente')" id="btn-status-analise" class="py-2 rounded-xl font-bold bg-slate-900 text-slate-400 border border-slate-800">Em Análise</button>
                <button type="button" onclick="definirStatusModal('bloqueado')" id="btn-status-bloqueado" class="py-2 rounded-xl font-bold bg-slate-900 text-slate-400 border border-slate-800">Bloqueado</button>
              </div>
              <input type="hidden" id="edit-status-valor" value="aprovado">
            </div>

            <div class="space-y-1.5 bg-slate-950/60 p-3 rounded-2xl border border-amber-500/20">
              <label class="text-amber-400 font-bold flex items-center justify-between">
                <span><i class="fa-solid fa-key mr-1"></i> Senha Temporária</span>
              </label>
              <div class="flex gap-1.5">
                <input type="text" id="edit-senha-temp" placeholder="Digite ou gere uma senha..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold tracking-wider">
                <button type="button" onclick="gerarSenhaTemporaria()" class="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/40 px-3 py-2 rounded-xl font-bold transition">Gerar</button>
                <button type="button" onclick="copiarSenhaTemporaria()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl font-bold"><i class="fa-solid fa-copy"></i></button>
              </div>
              <p class="text-[10px] text-slate-400">
                Ao salvar uma senha aqui, o usuário entra com ela e o app exige que crie uma nova senha (mín. 8 caracteres, letras + números).
              </p>
            </div>
          </div>

          <div class="flex gap-2 pt-3 border-t border-slate-800">
            <button type="button" onclick="fecharModalEdicao()" class="flex-1 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>

    <!-- PRÉVIA AMPLIADA DO DOCUMENTO / CRLV NO MODAL -->
    <div id="modal-previa-ampliada" class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl p-4 space-y-3 shadow-2xl max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
          <h4 id="previa-ampliada-titulo" class="font-extrabold text-white text-xs truncate">Prévia do Documento</h4>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" id="previa-ampliada-btn-externo" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-[11px]">
              <i class="fa-solid fa-up-right-from-square mr-1"></i> Abrir Original Externo
            </button>
            <button type="button" onclick="fecharPreviaDocumentoAdmin()" class="text-slate-400 hover:text-white px-2">
              <i class="fa-solid fa-xmark text-base"></i>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-2xl p-2 border border-slate-800">
          <img id="previa-ampliada-img" src="" alt="Prévia ampliada" class="hidden max-h-[68vh] w-auto object-contain rounded-xl">
          <iframe id="previa-ampliada-frame" src="" class="hidden w-full h-[68vh] rounded-xl bg-white"></iframe>
        </div>
      </div>
    </div>

    <!-- MODAL ALTERAR SENHA MESTRE -->
    <div id="modal-senha-mestre" class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 class="font-extrabold text-white text-sm flex items-center gap-2">
            <i class="fa-solid fa-key text-amber-400"></i> Configurar Senha Mestre
          </h3>
          <button onclick="fecharModalSenhaMestre()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark text-base"></i></button>
        </div>
        <div class="space-y-3 text-xs">
          <div class="space-y-1">
            <label class="text-slate-300 font-medium">Senha Mestre Atual</label>
            <input type="password" id="mestre-atual" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
          </div>
          <div class="space-y-1">
            <label class="text-slate-300 font-medium">Nova Senha Mestre</label>
            <input type="password" id="mestre-nova" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
          </div>
          <p id="msg-senha-mestre" class="text-emerald-400 text-[11px] font-semibold hidden text-center"></p>
          <div class="flex gap-2 pt-2">
            <button type="button" onclick="fecharModalSenhaMestre()" class="flex-1 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl">Cancelar</button>
            <button type="button" onclick="salvarNovaSenhaMestre()" class="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl">Atualizar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('afterbegin', headerENav);
  document.body.insertAdjacentHTML('beforeend', modaisHtml);
}

function verificarSessaoAdmin(paginaAtiva, callbackCarregarPagina) {
  inicializarLayoutAdmin(paginaAtiva);
  if (sessionStorage.getItem('admin_autenticado') === 'true') {
    document.getElementById('tela-login-admin').classList.add('hidden');
    atualizarContadoresNavegacao();
    if (callbackCarregarPagina) callbackCarregarPagina();
  } else {
    document.getElementById('tela-login-admin').classList.remove('hidden');
  }
}

function autenticarAdmin(e) {
  e.preventDefault();
  const user = document.getElementById('login-admin-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-admin-pass').value;
  if ((user === ADMIN_USER_PADRAO || user === 'admin@laguna.com') && pass === obterSenhaMestre()) {
    sessionStorage.setItem('admin_autenticado', 'true');
    document.getElementById('tela-login-admin').classList.add('hidden');
    location.reload();
  } else {
    document.getElementById('login-admin-erro').classList.remove('hidden');
  }
}

function sairAdmin() {
  sessionStorage.removeItem('admin_autenticado');
  window.location.href = 'auth.html';
}

function atualizarDadosGlobais() {
  atualizarContadoresNavegacao();
  if (typeof carregarPaginaAtual === 'function') carregarPaginaAtual();
}

async function atualizarContadoresNavegacao() {
  try {
    const { data: usuarios } = await supabaseClient.from('usuarios').select('*');
    const lista = usuarios || [];
    const totalMot = lista.filter(u => ehPerfilMotoristaAdmin(u)).length;
    const totalPass = lista.filter(u => !ehPerfilMotoristaAdmin(u)).length;

    const { count: totalViagens } = await supabaseClient
      .from('corridas')
      .select('id', { count: 'exact', head: true })
      .in('status', ['aceita', 'em_andamento', 'em_curso', 'pendente']);

    const { data: sup } = await supabaseClient
      .from('corridas')
      .select('id')
      .lt('avaliacao_motorista', 5);

    document.getElementById('nav-count-motoristas').innerText = totalMot;
    document.getElementById('nav-count-passageiros').innerText = totalPass;
    document.getElementById('nav-count-viagens').innerText = totalViagens || 0;

    const idsLidos = JSON.parse(localStorage.getItem('admin_suporte_lidos') || '[]');
    const pendentes = (sup || []).filter(s => !idsLidos.includes(String(s.id))).length;
    const badge = document.getElementById('nav-badge-suporte');
    if (pendentes > 0) {
      badge.innerText = `+${pendentes}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {}
}

function abrirModalSenhaMestre() {
  document.getElementById('mestre-atual').value = '';
  document.getElementById('mestre-nova').value = '';
  document.getElementById('msg-senha-mestre').classList.add('hidden');
  document.getElementById('modal-senha-mestre').classList.remove('hidden');
}

function fecharModalSenhaMestre() {
  document.getElementById('modal-senha-mestre').classList.add('hidden');
}

function salvarNovaSenhaMestre() {
  const atual = document.getElementById('mestre-atual').value;
  const nova = document.getElementById('mestre-nova').value.trim();
  const msgEl = document.getElementById('msg-senha-mestre');

  if (atual !== obterSenhaMestre()) {
    msgEl.innerText = "Senha mestre atual incorreta!";
    msgEl.className = "text-red-400 text-[11px] font-semibold text-center";
    msgEl.classList.remove('hidden');
    return;
  }
  if (nova.length < 4) {
    msgEl.innerText = "A nova senha deve ter pelo menos 4 caracteres.";
    msgEl.className = "text-red-400 text-[11px] font-semibold text-center";
    msgEl.classList.remove('hidden');
    return;
  }
  localStorage.setItem('admin_master_pass', nova);
  msgEl.innerText = "Senha mestre atualizada com sucesso!";
  msgEl.className = "text-emerald-400 text-[11px] font-semibold text-center";
  msgEl.classList.remove('hidden');
  setTimeout(() => fecharModalSenhaMestre(), 1500);
}

function alternarMenuRestricaoCardAdmin(idUsuario) {
  const gatilho = document.getElementById(`btn-gatilho-restricao-${idUsuario}`);
  const opcoes = document.getElementById(`opcoes-restricao-${idUsuario}`);
  if (!gatilho || !opcoes) return;

  const vaiAbrir = opcoes.classList.contains('hidden');

  document.querySelectorAll('[id^="opcoes-restricao-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="btn-gatilho-restricao-"]').forEach(el => el.classList.remove('hidden'));

  if (vaiAbrir) {
    gatilho.classList.add('hidden');
    opcoes.classList.remove('hidden');
  } else {
    opcoes.classList.add('hidden');
    gatilho.classList.remove('hidden');
  }
}

function gerarCardAdmin(user) {
  const statusNorm = normalizarStatusConta(user.status);
  const isBloqueado = statusNorm === 'bloqueado';
  const isPendente = statusNorm === 'pendente';
  const isMotorista = ehPerfilMotoristaAdmin(user);
  const isOnline = usuarioEstaAtivoNoAppAdmin(user) && !isBloqueado && !isPendente;

  let badge = '';
  if (isBloqueado) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400">Bloqueado</span>';
  else if (isPendente) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400">Em Análise</span>';
  else if (isOnline) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Online</span>';

  const bolinhaInferiorDireita = isOnline
    ? `<span title="Usuário online no aplicativo" class="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-emerald-400 animate-ping pointer-events-none"></span><span title="Usuário online no aplicativo" class="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-emerald-500 border border-slate-900 pointer-events-none"></span>`
    : '';

  const temV2Pendente = isMotorista && temSegundoVeiculoPendenteAdmin(user);

  const acaoRestricaoHtml = (isBloqueado || isPendente)
    ? `<button type="button" onclick="mudarStatusConta('${user.id}', 'aprovado')" class="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-2.5 py-2 rounded-xl font-bold shrink-0">Desbloquear</button>`
    : `
      <button type="button" id="btn-gatilho-restricao-${user.id}" onclick="alternarMenuRestricaoCardAdmin('${user.id}')" class="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-2.5 py-2 rounded-xl font-bold shrink-0">Bloquear</button>
      <div id="opcoes-restricao-${user.id}" class="hidden flex items-center gap-1 shrink-0">
        <button type="button" onclick="mudarStatusConta('${user.id}', 'pendente')" class="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-2 py-2 rounded-xl font-bold text-[10px] leading-none">Analisar</button>
        <button type="button" onclick="mudarStatusConta('${user.id}', 'bloqueado')" class="bg-red-600/25 hover:bg-red-600/40 text-red-300 border border-red-500/40 px-2 py-2 rounded-xl font-bold text-[10px] leading-none">Bloquear</button>
        <button type="button" onclick="alternarMenuRestricaoCardAdmin('${user.id}')" title="Fechar" class="text-slate-500 hover:text-slate-300 px-1 py-1.5 text-[10px] leading-none"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;

  return `
    <div class="relative bg-slate-900 p-4 rounded-2xl border ${isBloqueado ? 'border-red-500/40' : (isPendente || temV2Pendente ? 'border-amber-500/50' : (isOnline ? 'border-emerald-500/40' : 'border-slate-800'))} space-y-3 shadow">
      ${bolinhaInferiorDireita}
      <div class="flex items-center gap-3">
        <img src="${user.foto_url || 'https://ui-avatars.com/api/?name=Usuario'}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-700">
        <div class="flex-1">
          <div class="flex justify-between items-start gap-2">
            <h3 class="font-extrabold text-white text-xs">${user.nome || 'Sem Nome'}</h3>
            ${badge}
          </div>
          <p class="text-slate-400 text-[11px]">Cel: ${user.telefone || '-'} • CPF: ${user.cpf || '-'}</p>
          ${isMotorista ? `<p class="text-slate-300 font-bold text-[11px]">Veículo: ${user.veiculo_modelo || 'Não informado'} (${user.veiculo_placa || 'Sem placa'})</p>` : ''}
          ${temV2Pendente ? `<p class="text-amber-300 font-bold text-[10px] mt-0.5"><i class="fa-solid fa-car-side mr-1"></i> 2º carro aguardando aprovação: ${user.veiculo2_modelo || ''} (${user.veiculo2_placa || '-'})</p>` : ''}
        </div>
      </div>

      <div class="flex gap-1.5 pt-2 border-t border-slate-800 text-[11px] items-center">
        <button type="button" onclick="abrirModalEdicao('${user.id}')" class="flex-1 min-w-0 truncate bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-2.5 rounded-xl">${temV2Pendente ? 'Analisar 2º Carro / Perfil' : 'Editar Perfil / Suporte'}</button>
        ${acaoRestricaoHtml}
      </div>
    </div>
  `;
}

function mostrarAlertaModal(mensagem, tipo = 'sucesso') {
  const toast = document.getElementById('modal-alerta-toast');
  const texto = document.getElementById('modal-alerta-texto');
  const icone = document.getElementById('modal-alerta-icone');
  texto.innerText = mensagem;
  toast.classList.remove('hidden');
  toast.className = tipo === 'sucesso'
    ? "p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-md bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
    : "p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-md bg-red-950/80 border border-red-500/50 text-red-300";
  icone.className = tipo === 'sucesso' ? "fa-solid fa-circle-check text-emerald-400 text-sm" : "fa-solid fa-triangle-exclamation text-red-400 text-sm";
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function mudarAbaModal(aba) {
  if (aba === 'veiculos' && !ehPerfilMotoristaAdmin(usuarioModalAtual)) {
    aba = 'dados';
  }
  ['dados', 'veiculos', 'viagens', 'chat', 'suporte', 'status'].forEach(item => {
    const conteudo = document.getElementById(`modal-conteudo-${item}`);
    const botao = document.getElementById(`tab-btn-${item}`);
    if (conteudo) conteudo.classList.toggle('hidden', aba !== item);
    if (botao) {
      botao.className = aba === item
        ? 'flex-1 min-w-[60px] py-2 px-2 rounded-lg font-bold bg-emerald-600 text-white transition'
        : 'flex-1 min-w-[60px] py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition';
      if (item === 'veiculos' && !ehPerfilMotoristaAdmin(usuarioModalAtual)) {
        botao.classList.add('hidden');
      }
    }
  });
}

function mudarSubAbaVeiculoModal(sub) {
  const temV2 = temSegundoVeiculoCadastrado(usuarioModalAtual);
  if (sub === 'v2' && !temV2) sub = 'v1';

  document.getElementById('conteudo-subtab-v1').classList.toggle('hidden', sub !== 'v1');
  document.getElementById('conteudo-subtab-v2').classList.toggle('hidden', sub !== 'v2' || !temV2);

  document.getElementById('subtab-v1').className = sub === 'v1'
    ? 'py-2 px-2 rounded-lg font-bold bg-emerald-600 text-white transition'
    : 'py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition';

  const btnV2 = document.getElementById('subtab-v2');
  btnV2.classList.toggle('hidden', !temV2);
  btnV2.className = (sub === 'v2' && temV2)
    ? 'py-2 px-2 rounded-lg font-bold bg-amber-600 text-white transition'
    : 'py-2 px-2 rounded-lg font-bold bg-slate-900 text-slate-400 transition' + (temV2 ? '' : ' hidden');
}

function preencherDocumentoCrlvAdmin(url, nome, btnExtId, imgElId, nomeElId, chaveCache) {
  const btnExt = document.getElementById(btnExtId);
  const imgEl = document.getElementById(imgElId);
  const nomeEl = document.getElementById(nomeElId);
  if (nomeEl) nomeEl.innerText = nome || (url ? 'CRLV anexado' : 'Nenhum arquivo');

  if (url) {
    const safeUrl = obterUrlSeguraDocumentoAdmin(url, chaveCache);
    if (btnExt) btnExt.classList.remove('hidden');
    if (imgEl) {
      if (String(url).startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(url))) {
        imgEl.src = safeUrl;
        imgEl.classList.remove('hidden');
      } else {
        imgEl.classList.add('hidden');
      }
    }
  } else {
    if (btnExt) btnExt.classList.add('hidden');
    if (imgEl) imgEl.classList.add('hidden');
  }
}

function preencherAbaVeiculosMotorista(user) {
  const isMotorista = ehPerfilMotoristaAdmin(user);
  const tabBtnVeiculos = document.getElementById('tab-btn-veiculos');
  if (tabBtnVeiculos) {
    tabBtnVeiculos.classList.toggle('hidden', !isMotorista);
  }
  if (!isMotorista) return;

  // Veículo 1 (editável manualmente)
  document.getElementById('edit-v1-marca').value = user.veiculo_marca || '';
  document.getElementById('edit-v1-modelo').value = user.veiculo_modelo || '';
  document.getElementById('edit-v1-cor').value = user.veiculo_cor || '';
  document.getElementById('edit-v1-ano').value = user.veiculo_ano || '';
  document.getElementById('edit-v1-placa').value = (user.veiculo_placa || '').toUpperCase();

  preencherDocumentoCrlvAdmin(
    user.documento_identificacao_url,
    user.documento_identificacao_nome,
    'v1-doc-btn-ext',
    'v1-doc-img',
    'v1-doc-nome',
    `${user.id}_v1`
  );

  // Veículo 2
  const temV2 = temSegundoVeiculoCadastrado(user);
  const statusV2 = String(user.veiculo2_status || 'pendente').toLowerCase();
  const badgeV2 = document.getElementById('v2-status-badge');
  const subBadgeV2 = document.getElementById('subtab-v2-badge');

  badgeV2.innerText = statusV2;
  if (subBadgeV2) {
    subBadgeV2.innerText = statusV2 === 'aprovado' ? 'Aprovado' : 'Pendente';
    subBadgeV2.className = statusV2 === 'aprovado'
      ? 'ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200'
      : 'ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200';
  }

  if (statusV2 === 'aprovado') {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300';
  } else if (statusV2 === 'recusado') {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300';
  } else {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300';
  }

  document.getElementById('edit-v2-marca').value = user.veiculo2_marca || '';
  document.getElementById('edit-v2-modelo').value = user.veiculo2_modelo || '';
  document.getElementById('edit-v2-cor').value = user.veiculo2_cor || '';
  document.getElementById('edit-v2-ano').value = user.veiculo2_ano || '';
  document.getElementById('edit-v2-placa').value = (user.veiculo2_placa || '').toUpperCase();

  preencherDocumentoCrlvAdmin(
    user.veiculo2_documento_url,
    user.veiculo2_documento_nome,
    'v2-doc-btn-ext',
    'v2-doc-img',
    'v2-doc-nome',
    `${user.id}_v2`
  );

  mudarSubAbaVeiculoModal(temV2 ? 'v2' : 'v1');
}

async function decidirSegundoVeiculoAdmin(novoStatusV2) {
  const idUsuario = document.getElementById('edit-id').value;
  if (!idUsuario) return;

  const isRecusado = novoStatusV2 === 'recusado';

  const atualizacaoV2 = isRecusado
    ? {
        veiculo2_marca: null,
        veiculo2_modelo: null,
        veiculo2_cor: null,
        veiculo2_ano: null,
        veiculo2_placa: null,
        veiculo2_documento_url: null,
        veiculo2_documento_nome: null,
        veiculo2_status: 'recusado'
      }
    : {
        veiculo2_marca: (document.getElementById('edit-v2-marca').value || '').trim() || null,
        veiculo2_modelo: (document.getElementById('edit-v2-modelo').value || '').trim() || null,
        veiculo2_cor: (document.getElementById('edit-v2-cor').value || '').trim() || null,
        veiculo2_ano: (document.getElementById('edit-v2-ano').value || '').trim() || null,
        veiculo2_placa: ((document.getElementById('edit-v2-placa').value || '').trim()).toUpperCase() || null,
        veiculo2_status: 'aprovado'
      };

  const { error } = await supabaseClient
    .from('usuarios')
    .update(atualizacaoV2)
    .eq('id', idUsuario);

  if (error) {
    mostrarAlertaModal("Erro ao atualizar 2º veículo: " + error.message, "erro");
    return;
  }

  try {
    await supabaseClient
      .from('solicitacoes_segundo_veiculo')
      .update({
        status: novoStatusV2,
        alerta_admin: false,
        updated_at: new Date().toISOString()
      })
      .eq('usuario_id', idUsuario)
      .eq('status', 'pendente');
  } catch (e) {}

  usuarioModalAtual = { ...(usuarioModalAtual || {}), ...atualizacaoV2 };
  preencherAbaVeiculosMotorista(usuarioModalAtual);
  mostrarAlertaModal(
    isRecusado
      ? "2º veículo recusado e removido da lista! O motorista poderá enviar um novo veículo."
      : "2º veículo aprovado! Status da conta mantido sem bloqueio.",
    "sucesso"
  );
  atualizarDadosGlobais();
}

function definirStatusModal(status) {
  const st = normalizarStatusConta(status);
  document.getElementById('edit-status-valor').value = st;
  document.getElementById('btn-status-ativo').className = "py-2 rounded-xl font-bold " + (st === 'aprovado' ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-400 border border-slate-800");
  document.getElementById('btn-status-analise').className = "py-2 rounded-xl font-bold " + (st === 'pendente' ? "bg-amber-600/20 text-amber-400 border border-amber-500/30" : "bg-slate-900 text-slate-400 border border-slate-800");
  document.getElementById('btn-status-bloqueado').className = "py-2 rounded-xl font-bold " + (st === 'bloqueado' ? "bg-red-600/20 text-red-400 border border-red-500/30" : "bg-slate-900 text-slate-400 border border-slate-800");
}

function gerarSenhaTemporaria() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const numeros = '0123456789';
  const simbolos = '@#$*';
  let senha = '';
  for (let i = 0; i < 4; i++) senha += letras[Math.floor(Math.random() * letras.length)];
  for (let i = 0; i < 4; i++) senha += numeros[Math.floor(Math.random() * numeros.length)];
  senha += simbolos[Math.floor(Math.random() * simbolos.length)];
  document.getElementById('edit-senha-temp').value = senha;
}

function copiarSenhaTemporaria() {
  const input = document.getElementById('edit-senha-temp');
  if (!input.value) return;
  navigator.clipboard.writeText(input.value);
  mostrarAlertaModal("Senha copiada!", "sucesso");
}

async function abrirModalEdicao(id) {
  let user = listaUsuariosCache.find(item => String(item.id) === String(id));
  if (!user) {
    const { data } = await supabaseClient.from('usuarios').select('*').eq('id', id).single();
    user = data;
  }
  if (!user) return;
  usuarioModalAtual = user;

  document.getElementById('modal-alerta-toast').classList.add('hidden');
  document.getElementById('edit-id').value = user.id;
  document.getElementById('edit-id-display').innerText = user.id;
  document.getElementById('edit-nome').value = user.nome || '';
  document.getElementById('edit-cpf').value = user.cpf || '';
  document.getElementById('edit-telefone').value = user.telefone || '';
  document.getElementById('edit-endereco').value = user.endereco || '';
  document.getElementById('edit-senha-temp').value = '';
  document.getElementById('edit-foto-preview').src = user.foto_url || 'https://ui-avatars.com/api/?name=Usuario';
  document.getElementById('input-resposta-suporte').value = '';

  const isMotorista = ehPerfilMotoristaAdmin(user);
  document.getElementById('edit-tipo-badge').innerText = isMotorista ? "Motorista Parceiro" : "Passageiro";

  preencherAbaVeiculosMotorista(user);
  definirStatusModal(user.status || 'aprovado');

  const abrirEmV2 = isMotorista && temSegundoVeiculoPendenteAdmin(user);
  mudarAbaModal(abrirEmV2 ? 'veiculos' : 'dados');
  if (abrirEmV2) {
    mudarSubAbaVeiculoModal('v2');
  }

  document.getElementById('modal-edicao').classList.remove('hidden');

  carregarHistoricoEGanhosModal(user.id, isMotorista);
  carregarHistoricoSuporteModal(user);
}

function fecharModalEdicao() {
  fecharPreviaDocumentoAdmin();
  usuarioModalAtual = null;
  document.getElementById('modal-edicao').classList.add('hidden');
}

async function carregarHistoricoEGanhosModal(id, isMotorista) {
  const containerViagens = document.getElementById('detalhes-historico-usuario');
  const containerChat = document.getElementById('detalhes-chat-usuario');
  containerViagens.innerHTML = '<p class="text-slate-400 text-center py-2 animate-pulse">Buscando viagens e ganhos...</p>';
  containerChat.innerHTML = '<p class="text-slate-400 text-center py-2 animate-pulse">Buscando mensagens...</p>';

  const colunaBusca = isMotorista ? 'motorista_id' : 'passageiro_id';
  const { data: corridas } = await supabaseClient.from('corridas').select('*').eq(colunaBusca, id).order('id', { ascending: false });

  if (!corridas || corridas.length === 0) {
    containerViagens.innerHTML = '<p class="text-slate-500 text-center py-2">Nenhuma corrida registrada.</p>';
    containerChat.innerHTML = '<p class="text-slate-500 text-center py-2">Nenhuma mensagem registrada.</p>';
    return;
  }

  let htmlViagens = '';
  let totalGanhos = 0;

  corridas.forEach(c => {
    const valor = Number(c.valor || c.preco || 15.0);
    if (isMotorista) totalGanhos += valor;
    htmlViagens += `
      <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
        <div class="flex justify-between items-center text-[10px] text-slate-400">
          <span>Viagem #${c.id} • ${c.status || 'Concluída'}</span>
          <span class="text-emerald-400 font-bold">R$ ${valor.toFixed(2)}</span>
        </div>
        <p class="text-slate-300 truncate"><strong>De:</strong> ${c.origem || 'N/D'}</p>
        <p class="text-slate-300 truncate"><strong>Para:</strong> ${c.destino || 'N/D'}</p>
      </div>
    `;
  });

  if (isMotorista) {
    htmlViagens = `<div class="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30 text-emerald-300 text-center font-bold mb-2">Total de Ganhos: R$ ${totalGanhos.toFixed(2)}</div>` + htmlViagens;
  }
  containerViagens.innerHTML = htmlViagens;

  const idsCorridas = corridas.map(c => c.id);
  const { data: msgs } = await supabaseClient.from('mensagens_chat').select('*').in('corrida_id', idsCorridas);
  containerChat.innerHTML = (!msgs || msgs.length === 0)
    ? '<p class="text-slate-500 text-center py-2">Nenhuma mensagem encontrada.</p>'
    : msgs.map(m => `<div class="bg-slate-900 p-2 rounded-lg text-[10px] text-slate-300 mb-1"><strong>[Corrida #${m.corrida_id}]:</strong> ${m.mensagem || m.texto || '-'}</div>`).join('');
}

async function carregarHistoricoSuporteModal(user) {
  const containerSuporte = document.getElementById('detalhes-suporte-usuario');
  containerSuporte.innerHTML = '<p class="text-slate-400 text-center py-2 animate-pulse">Buscando ocorrências e mensagens...</p>';

  const itensUsuario = [];

  const { data: msgsApp } = await supabaseClient
    .from('mensagens_suporte_app')
    .select('*')
    .eq('usuario_id', String(user.id))
    .order('criado_em', { ascending: false });

  (msgsApp || []).forEach(m => {
    const isAdmin = m.remetente === 'admin';
    itensUsuario.push({
      tipo: 'msg_app',
      data: m.criado_em || new Date().toISOString(),
      html: `
        <div class="bg-slate-900 p-2.5 rounded-xl border ${isAdmin ? 'border-emerald-500/30' : 'border-sky-500/30'} space-y-1">
          <div class="flex justify-between items-center text-[10px] text-slate-400">
            <span class="${isAdmin ? 'text-emerald-400' : 'text-sky-400'} font-bold">
              <i class="fa-solid ${isAdmin ? 'fa-shield-halved' : 'fa-user'} mr-1"></i>${isAdmin ? 'Admin (Suporte)' : (user.nome || 'Usuário')}
            </span>
            <span>${new Date(m.criado_em || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <p class="text-slate-200 whitespace-pre-line">${m.mensagem}</p>
        </div>
      `
    });
  });

  const { data: corridas } = await supabaseClient
    .from('corridas')
    .select('*, motorista:motorista_id(id, nome), passageiro:passageiro_id(id, nome)')
    .or(`motorista_id.eq.${user.id},passageiro_id.eq.${user.id}`)
    .or('avaliacao_motorista.lt.5,avaliacao_passageiro.lt.5')
    .order('id', { ascending: false });

  (corridas || []).forEach(c => {
    if (c.avaliacao_motorista && c.avaliacao_motorista < 5) {
      itensUsuario.push({
        tipo: 'avaliacao',
        data: c.criado_em || new Date().toISOString(),
        html: `
          <div class="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 space-y-1.5">
            <div class="flex justify-between items-center text-[10px] text-slate-400">
              <span class="text-amber-400 font-bold"><i class="fa-solid fa-star"></i> ${c.avaliacao_motorista} Estrelas (Corrida #${c.id})</span>
              <span>${new Date(c.criado_em || Date.now()).toLocaleDateString('pt-BR')}</span>
            </div>
            <p class="text-emerald-400 text-[11px]">Reporte de <b>${c.passageiro?.nome || 'Passageiro'}</b> para <b>${c.motorista?.nome || 'Motorista'}</b></p>
            <p class="text-slate-300"><strong>Motivo:</strong> ${c.motivo_avaliacao_motorista || 'Nenhum motivo informado.'}</p>
          </div>
        `
      });
    }
    if (c.avaliacao_passageiro && c.avaliacao_passageiro < 5) {
      itensUsuario.push({
        tipo: 'avaliacao',
        data: c.criado_em || new Date().toISOString(),
        html: `
          <div class="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 space-y-1.5">
            <div class="flex justify-between items-center text-[10px] text-slate-400">
              <span class="text-amber-400 font-bold"><i class="fa-solid fa-star"></i> ${c.avaliacao_passageiro} Estrelas (Corrida #${c.id})</span>
              <span>${new Date(c.criado_em || Date.now()).toLocaleDateString('pt-BR')}</span>
            </div>
            <p class="text-emerald-400 text-[11px]">Reporte de <b>${c.motorista?.nome || 'Motorista'}</b> para <b>${c.passageiro?.nome || 'Passageiro'}</b></p>
            <p class="text-slate-300"><strong>Motivo:</strong> ${c.motivo_avaliacao_passageiro || 'Nenhum motivo informado.'}</p>
          </div>
        `
      });
    }
  });

  if (itensUsuario.length === 0) {
    containerSuporte.innerHTML = '<p class="text-slate-500 text-center py-2">Nenhuma ocorrência ou mensagem registrada para este usuário.</p>';
    return;
  }

  itensUsuario.sort((a, b) => new Date(b.data) - new Date(a.data));
  containerSuporte.innerHTML = itensUsuario.map(item => item.html).join('');
}

async function enviarMensagemSuporteUsuario() {
  const idUsuario = document.getElementById('edit-id').value;
  const mensagem = document.getElementById('input-resposta-suporte').value.trim();
  if (!mensagem) return mostrarAlertaModal("Digite uma mensagem antes de enviar.", "erro");

  const { error } = await supabaseClient.from('mensagens_suporte_app').insert([{
    usuario_id: String(idUsuario),
    mensagem,
    remetente: 'admin',
    lido: false
  }]);

  if (error) {
    return mostrarAlertaModal("Erro ao enviar: " + error.message, "erro");
  }

  mostrarAlertaModal("Mensagem enviada com sucesso para o app do usuário!", "sucesso");
  document.getElementById('input-resposta-suporte').value = '';
  await carregarHistoricoSuporteModal(usuarioModalAtual || { id: idUsuario, nome: document.getElementById('edit-nome').value });
}

async function salvarEdicaoUsuario(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const senhaTemp = document.getElementById('edit-senha-temp').value;
  const statusEscolhido = normalizarStatusConta(document.getElementById('edit-status-valor').value);
  const statusAnterior = usuarioModalAtual ? normalizarStatusConta(usuarioModalAtual.status) : statusEscolhido;
  const isMotorista = ehPerfilMotoristaAdmin(usuarioModalAtual);

  const atualizacao = {
    nome: document.getElementById('edit-nome').value,
    cpf: document.getElementById('edit-cpf').value,
    telefone: document.getElementById('edit-telefone').value,
    endereco: document.getElementById('edit-endereco').value,
    status: statusEscolhido
  };

  if (senhaTemp !== '') {
    atualizacao.senha = senhaTemp;
    atualizacao.senha_temporaria = true;
  }

  if (isMotorista) {
    atualizacao.veiculo_marca = (document.getElementById('edit-v1-marca').value || '').trim() || null;
    atualizacao.veiculo_modelo = (document.getElementById('edit-v1-modelo').value || '').trim() || null;
    atualizacao.veiculo_cor = (document.getElementById('edit-v1-cor').value || '').trim() || null;
    atualizacao.veiculo_ano = (document.getElementById('edit-v1-ano').value || '').trim() || null;
    atualizacao.veiculo_placa = ((document.getElementById('edit-v1-placa').value || '').trim()).toUpperCase() || null;

    if (temSegundoVeiculoCadastrado(usuarioModalAtual)) {
      atualizacao.veiculo2_marca = (document.getElementById('edit-v2-marca').value || '').trim() || null;
      atualizacao.veiculo2_modelo = (document.getElementById('edit-v2-modelo').value || '').trim() || null;
      atualizacao.veiculo2_cor = (document.getElementById('edit-v2-cor').value || '').trim() || null;
      atualizacao.veiculo2_ano = (document.getElementById('edit-v2-ano').value || '').trim() || null;
      atualizacao.veiculo2_placa = ((document.getElementById('edit-v2-placa').value || '').trim()).toUpperCase() || null;
    }
  }

  let { error } = await supabaseClient.from('usuarios').update(atualizacao).eq('id', id);

  if (!error && statusEscolhido !== statusAnterior) {
    const statusAprovacaoAlvo = statusEscolhido === 'aprovado' ? 'aprovado' : (statusEscolhido === 'bloqueado' ? 'bloqueado' : 'pendente');
    await supabaseClient.from('usuarios').update({ status_aprovacao: statusAprovacaoAlvo }).eq('id', id);
  }

  if (error) {
    mostrarAlertaModal("Erro: " + error.message, "erro");
  } else {
    mostrarAlertaModal("Atualizado com sucesso!", "sucesso");
    setTimeout(() => {
      fecharModalEdicao();
      atualizarDadosGlobais();
    }, 1000);
  }
}

async function mudarStatusConta(id, novoStatus) {
  const st = normalizarStatusConta(novoStatus);
  const { error } = await supabaseClient.from('usuarios').update({ status: st }).eq('id', id);
  if (!error) {
    const statusAprovacaoAlvo = st === 'aprovado' ? 'aprovado' : (st === 'bloqueado' ? 'bloqueado' : 'pendente');
    await supabaseClient.from('usuarios').update({ status_aprovacao: statusAprovacaoAlvo }).eq('id', id);
  }
  if (error) alert("Erro ao atualizar status: " + error.message);
  else atualizarDadosGlobais();
}