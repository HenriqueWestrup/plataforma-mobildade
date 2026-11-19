// admin_shared.js (v9)
const SUPABASE_URL = 'https://mmcwmzesjtnqgpcdspir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY3dtemVzanRucWdwY2RzcGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NTgyMzUsImV4cCI6MjExMDAzNDIzNX0.VfOyJpZ5Xl30CvLtP-ZpAl1BO1ijVU8ChpabOPmel-E';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_USER_PADRAO = 'admin';
function obterSenhaMestre() {
  return localStorage.getItem('admin_master_pass') || 'admin123';
}

let listaUsuariosCache = [];
let usuarioModalAtual = null;

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
    user.veiculo2_placa
  );
}

// Injeta Layout Base (Login, Header, Navegação e Modais)
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
          <h1 class="text-sm font-extrabold text-white">Painel Administrativo <span class="text-[10px] text-slate-500 font-mono">v9</span></h1>
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

          <!-- ABA DADOS -->
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

            <div id="edit-bloco-veiculo" class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 hidden">
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">Veículo (1º Carro)</label>
                <input type="text" id="edit-veiculo-modelo" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100">
              </div>
              <div class="space-y-1">
                <label class="text-slate-300 font-medium">Placa (1º Carro)</label>
                <input type="text" id="edit-veiculo-placa" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 uppercase text-slate-100">
              </div>
            </div>
          </div>

          <!-- ABA VEÍCULOS (EXCLUSIVA PARA MOTORISTA) -->
          <div id="modal-conteudo-veiculos" class="space-y-3 hidden">
            <!-- 1º VEÍCULO + CRLV -->
            <div class="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold text-emerald-400 uppercase">
                  <i class="fa-solid fa-car mr-1"></i> 1º Veículo Cadastrado
                </span>
                <span class="text-[10px] text-slate-400">Base da Conta</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div><span class="text-slate-400">Marca:</span> <strong id="v1-marca" class="text-white">-</strong></div>
                <div><span class="text-slate-400">Modelo:</span> <strong id="v1-modelo" class="text-white">-</strong></div>
                <div><span class="text-slate-400">Cor:</span> <strong id="v1-cor" class="text-white">-</strong></div>
                <div><span class="text-slate-400">Ano / Placa:</span> <strong id="v1-ano-placa" class="text-white font-mono">-</strong></div>
              </div>
              <div class="pt-2 border-t border-slate-800/80 space-y-2">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-slate-400">CRLV (1º Carro): <strong id="v1-doc-nome" class="text-slate-200 font-mono">-</strong></span>
                  <a id="v1-doc-link" href="#" target="_blank" rel="noopener" class="hidden text-emerald-400 hover:underline font-bold">Abrir CRLV</a>
                </div>
                <img id="v1-doc-img" src="" alt="CRLV 1º carro" class="hidden w-full max-h-40 object-contain rounded-xl border border-slate-800 bg-slate-900">
              </div>
            </div>

            <!-- 2º VEÍCULO + CRLV + MODIFICAÇÃO + APROVAÇÃO/RECUSA -->
            <div class="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-extrabold text-amber-400 uppercase">
                  <i class="fa-solid fa-car-side mr-1"></i> 2º Veículo (Análise / CRLV)
                </span>
                <span id="v2-status-badge" class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300">pendente</span>
              </div>

              <p id="v2-sem-cadastro-aviso" class="text-[11px] text-slate-400 hidden">
                Nenhum 2º veículo cadastrado para este motorista no momento.
              </p>

              <div id="v2-campos-edicao" class="space-y-2.5">
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-slate-300 text-[10px] font-medium">Marca (2º Carro)</label>
                    <input type="text" id="edit-v2-marca" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                  </div>
                  <div class="space-y-1">
                    <label class="text-slate-300 text-[10px] font-medium">Modelo (2º Carro)</label>
                    <input type="text" id="edit-v2-modelo" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <label class="text-slate-300 text-[10px] font-medium">Cor</label>
                    <input type="text" id="edit-v2-cor" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                  </div>
                  <div class="space-y-1">
                    <label class="text-slate-300 text-[10px] font-medium">Ano</label>
                    <input type="text" id="edit-v2-ano" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                  </div>
                  <div class="space-y-1">
                    <label class="text-slate-300 text-[10px] font-medium">Placa</label>
                    <input type="text" id="edit-v2-placa" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 uppercase text-slate-100 text-[11px]">
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-slate-300 text-[10px] font-medium">Status do 2º Veículo</label>
                  <select id="edit-v2-status" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 text-[11px]">
                    <option value="pendente">pendente (em análise)</option>
                    <option value="aprovado">aprovado</option>
                    <option value="recusado">recusado</option>
                  </select>
                </div>

                <!-- CONFERÊNCIA DO CRLV DO 2º VEÍCULO -->
                <div class="pt-2 border-t border-slate-800 space-y-2">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="text-slate-300 font-bold">CRLV Enviado (2º Carro): <span id="v2-doc-nome" class="text-amber-300 font-mono">-</span></span>
                    <a id="v2-doc-link" href="#" target="_blank" rel="noopener" class="hidden text-emerald-400 hover:underline font-bold">Abrir CRLV</a>
                  </div>
                  <img id="v2-doc-img" src="" alt="CRLV 2º carro" class="hidden w-full max-h-48 object-contain rounded-xl border border-slate-700 bg-slate-900">
                </div>

                <!-- AÇÕES RÁPIDAS PARA ACEITAR OU RECUSAR O 2º CARRO -->
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onclick="decidirSegundoVeiculoAdmin('aprovado')" class="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-check"></i> Aprovar 2º Carro
                  </button>
                  <button type="button" onclick="decidirSegundoVeiculoAdmin('recusado')" class="bg-red-600/20 hover:bg-red-600/35 text-red-300 border border-red-500/40 py-2 px-3 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-xmark"></i> Recusar 2º Carro
                  </button>
                </div>
              </div>
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
              <label class="text-slate-300 font-bold block mb-1">Status da Conta</label>
              <div class="grid grid-cols-3 gap-2">
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
                <input type="text" id="edit-senha-temp" placeholder="Gerar..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold tracking-wider text-center">
                <button type="button" onclick="gerarSenhaTemporaria()" class="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/40 px-3 py-2 rounded-xl font-bold transition">Gerar</button>
                <button type="button" onclick="copiarSenhaTemporaria()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl font-bold"><i class="fa-solid fa-copy"></i></button>
              </div>
            </div>
          </div>

          <div class="flex gap-2 pt-3 border-t border-slate-800">
            <button type="button" onclick="fecharModalEdicao()" class="flex-1 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl">Salvar Alterações</button>
          </div>
        </form>
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

// --- AUTENTICAÇÃO E CONTADORES GLOBAIS ---
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

// --- SENHA MESTRE ---
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

// --- CARD PADRÃO DE USUÁRIO / MOTORISTA ---
function gerarCardAdmin(user) {
  const statusNorm = normalizarStatusConta(user.status);
  const isBloqueado = statusNorm === 'bloqueado';
  const isPendente = statusNorm === 'pendente';
  const isMotorista = ehPerfilMotoristaAdmin(user);
  const isOnline = user.online === true;

  let badge = '';
  if (isBloqueado) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400">Bloqueado</span>';
  else if (isPendente) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400">Em Análise</span>';
  else if (isOnline) badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Online</span>';

  const temV2Pendente = isMotorista && (user.veiculo2_modelo || user.veiculo2_placa) && String(user.veiculo2_status || 'pendente').toLowerCase() === 'pendente';

  return `
    <div class="bg-slate-900 p-4 rounded-2xl border ${isBloqueado ? 'border-red-500/40' : (temV2Pendente ? 'border-amber-500/50' : (isOnline ? 'border-emerald-500/40' : 'border-slate-800'))} space-y-3 shadow">
      <div class="flex items-center gap-3">
        <img src="${user.foto_url || 'https://ui-avatars.com/api/?name=Usuario'}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-700">
        <div class="flex-1">
          <div class="flex justify-between items-start gap-2">
            <h3 class="font-extrabold text-white text-xs">${user.nome || 'Sem Nome'}</h3>
            ${badge}
          </div>
          <p class="text-slate-400 text-[11px]">Cel: ${user.telefone || '-'} • CPF: ${user.cpf || '-'}</p>
          ${isMotorista ? `<p class="text-slate-300 font-bold text-[11px]">Veículo: ${user.veiculo_modelo || 'Não informado'} (${user.veiculo_placa || 'Sem placa'})</p>` : ''}
          ${temV2Pendente ? `<p class="text-amber-300 font-bold text-[10px] mt-0.5"><i class="fa-solid fa-car-side mr-1"></i> 2º carro pendente: ${user.veiculo2_modelo || ''} (${user.veiculo2_placa || '-'})</p>` : ''}
        </div>
      </div>
      <div class="flex gap-2 pt-2 border-t border-slate-800 text-[11px]">
        <button onclick="abrirModalEdicao('${user.id}')" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl">Editar Perfil / Suporte</button>
        ${isBloqueado 
          ? `<button onclick="mudarStatusConta('${user.id}', 'aprovado')" class="bg-emerald-600/20 text-emerald-400 px-3 py-2 rounded-xl font-bold">Desbloquear</button>` 
          : `<button onclick="mudarStatusConta('${user.id}', 'bloqueado')" class="bg-red-600/20 text-red-400 px-3 py-2 rounded-xl font-bold">Bloquear</button>`}
      </div>
    </div>
  `;
}

// --- FUNÇÕES DO MODAL COMPARTILHADO ---
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

function preencherDocumentoCrlvAdmin(url, nome, linkElId, imgElId, nomeElId) {
  const linkEl = document.getElementById(linkElId);
  const imgEl = document.getElementById(imgElId);
  const nomeEl = document.getElementById(nomeElId);
  if (nomeEl) nomeEl.innerText = nome || (url ? 'CRLV anexado' : 'Nenhum arquivo');

  if (url) {
    if (linkEl) {
      linkEl.href = url;
      linkEl.classList.remove('hidden');
    }
    if (imgEl) {
      if (String(url).startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(url))) {
        imgEl.src = url;
        imgEl.classList.remove('hidden');
      } else {
        imgEl.classList.add('hidden');
      }
    }
  } else {
    if (linkEl) linkEl.classList.add('hidden');
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

  // 1º Veículo + CRLV
  document.getElementById('v1-marca').innerText = user.veiculo_marca || '-';
  document.getElementById('v1-modelo').innerText = user.veiculo_modelo || '-';
  document.getElementById('v1-cor').innerText = user.veiculo_cor || '-';
  document.getElementById('v1-ano-placa').innerText = `${user.veiculo_ano || '-'} • ${(user.veiculo_placa || '-').toUpperCase()}`;
  preencherDocumentoCrlvAdmin(
    user.documento_identificacao_url,
    user.documento_identificacao_nome,
    'v1-doc-link',
    'v1-doc-img',
    'v1-doc-nome'
  );

  // 2º Veículo + CRLV
  const temV2 = Boolean(
    user.veiculo2_marca || user.veiculo2_modelo || user.veiculo2_cor ||
    user.veiculo2_ano || user.veiculo2_placa || user.veiculo2_documento_url
  );
  const statusV2 = String(user.veiculo2_status || 'pendente').toLowerCase();
  const badgeV2 = document.getElementById('v2-status-badge');
  badgeV2.innerText = statusV2;
  if (statusV2 === 'aprovado') {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300';
  } else if (statusV2 === 'recusado') {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300';
  } else {
    badgeV2.className = 'text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300';
  }

  document.getElementById('v2-sem-cadastro-aviso').classList.toggle('hidden', temV2);
  document.getElementById('v2-campos-edicao').classList.toggle('hidden', !temV2);

  document.getElementById('edit-v2-marca').value = user.veiculo2_marca || '';
  document.getElementById('edit-v2-modelo').value = user.veiculo2_modelo || '';
  document.getElementById('edit-v2-cor').value = user.veiculo2_cor || '';
  document.getElementById('edit-v2-ano').value = user.veiculo2_ano || '';
  document.getElementById('edit-v2-placa').value = (user.veiculo2_placa || '').toUpperCase();
  document.getElementById('edit-v2-status').value = ['pendente', 'aprovado', 'recusado'].includes(statusV2) ? statusV2 : 'pendente';

  preencherDocumentoCrlvAdmin(
    user.veiculo2_documento_url,
    user.veiculo2_documento_nome,
    'v2-doc-link',
    'v2-doc-img',
    'v2-doc-nome'
  );
}

async function decidirSegundoVeiculoAdmin(novoStatusV2) {
  const idUsuario = document.getElementById('edit-id').value;
  if (!idUsuario) return;

  const marcaV2 = (document.getElementById('edit-v2-marca').value || '').trim() || null;
  const modeloV2 = (document.getElementById('edit-v2-modelo').value || '').trim() || null;
  const corV2 = (document.getElementById('edit-v2-cor').value || '').trim() || null;
  const anoV2 = (document.getElementById('edit-v2-ano').value || '').trim() || null;
  const placaV2 = ((document.getElementById('edit-v2-placa').value || '').trim()).toUpperCase() || null;

  const atualizacaoV2 = {
    veiculo2_marca: marcaV2,
    veiculo2_modelo: modeloV2,
    veiculo2_cor: corV2,
    veiculo2_ano: anoV2,
    veiculo2_placa: placaV2,
    veiculo2_status: novoStatusV2
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
        veiculo2_marca: marcaV2,
        veiculo2_modelo: modeloV2,
        veiculo2_cor: corV2,
        veiculo2_ano: anoV2,
        veiculo2_placa: placaV2,
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
    novoStatusV2 === 'aprovado'
      ? "2º veículo aprovado! O motorista já pode selecioná-lo com o app desligado."
      : "2º veículo recusado.",
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
  document.getElementById('edit-senha-temp').value = Math.floor(100000 + Math.random() * 900000);
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
  document.getElementById('edit-bloco-veiculo').classList.toggle('hidden', !isMotorista);
  if (isMotorista) {
    document.getElementById('edit-veiculo-modelo').value = user.veiculo_modelo || '';
    document.getElementById('edit-veiculo-placa').value = user.veiculo_placa || '';
  }

  preencherAbaVeiculosMotorista(user);
  definirStatusModal(user.status || 'aprovado');
  mudarAbaModal('dados');
  document.getElementById('modal-edicao').classList.remove('hidden');

  carregarHistoricoEGanhosModal(user.id, isMotorista);
  carregarHistoricoSuporteModal(user);
}

function fecharModalEdicao() {
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
  const senhaTemp = document.getElementById('edit-senha-temp').value.trim();
  const statusEscolhido = normalizarStatusConta(document.getElementById('edit-status-valor').value);
  const isMotorista = ehPerfilMotoristaAdmin(usuarioModalAtual);

  const atualizacao = {
    nome: document.getElementById('edit-nome').value,
    cpf: document.getElementById('edit-cpf').value,
    telefone: document.getElementById('edit-telefone').value,
    endereco: document.getElementById('edit-endereco').value,
    status: statusEscolhido
  };

  if (senhaTemp !== '') atualizacao.senha = senhaTemp;
  if (isMotorista) {
    atualizacao.veiculo_modelo = document.getElementById('edit-veiculo-modelo').value;
    atualizacao.veiculo_placa = document.getElementById('edit-veiculo-placa').value.toUpperCase();

    const temV2Visivel = !document.getElementById('v2-campos-edicao').classList.contains('hidden');
    if (temV2Visivel) {
      atualizacao.veiculo2_marca = (document.getElementById('edit-v2-marca').value || '').trim() || null;
      atualizacao.veiculo2_modelo = (document.getElementById('edit-v2-modelo').value || '').trim() || null;
      atualizacao.veiculo2_cor = (document.getElementById('edit-v2-cor').value || '').trim() || null;
      atualizacao.veiculo2_ano = (document.getElementById('edit-v2-ano').value || '').trim() || null;
      atualizacao.veiculo2_placa = ((document.getElementById('edit-v2-placa').value || '').trim()).toUpperCase() || null;
      atualizacao.veiculo2_status = document.getElementById('edit-v2-status').value || 'pendente';
    }
  }

  let { error } = await supabaseClient.from('usuarios').update(atualizacao).eq('id', id);

  if (!error) {
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