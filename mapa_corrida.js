// mapa_corrida.js
var enviandoAvaliacaoPassageiro = false;
var STATUS_ATIVOS_MAPA_CORRIDA = [
  'pendente',
  'procurando',
  'aceita',
  'aceito',
  'a_caminho',
  'no_local',
  'em_andamento',
  'em_curso',
  'em_viagem',
  'iniciada',
  'viagem_iniciada'
];

var STATUS_FINALIZADOS_MAPA_CORRIDA = [
  'concluido',
  'concluida',
  'finalizada'
];

var STATUS_CANCELADOS_MAPA_CORRIDA = [
  'cancelado',
  'cancelada',
  'expirado',
  'expirada'
];

function normalizarStatusCorrida(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function statusEhViagemIniciada(statusNorm) {
  return [
    'em_andamento',
    'em_curso',
    'em_viagem',
    'iniciada',
    'viagem_iniciada'
  ].includes(statusNorm);
}

function obterNomeCurtoMotorista(nomeCompleto) {
  const limpo = String(nomeCompleto || 'Motorista Parceiro').trim();
  if (!limpo) return 'Motorista';
  if (typeof primeiroNome === 'function') {
    return primeiroNome(limpo);
  }
  return limpo.split(/\s+/)[0];
}

function obterClienteSupabaseMapa() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof supabaseMapa !== 'undefined' && supabaseMapa) return supabaseMapa;
  if (window.__supabaseMapaInstance) return window.__supabaseMapaInstance;
  return null;
}

function obterPassageiroLogadoSeguro() {
  try {
    const raw = localStorage.getItem('passageiro_logado');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
  } catch (_) {}

  try {
    const rawCache = localStorage.getItem('mobiurb_corrida_ativa_passageiro');
    if (rawCache) {
      const parsedCache = JSON.parse(rawCache);
      if (parsedCache && parsedCache.passageiro_id) {
        return { id: parsedCache.passageiro_id };
      }
    }
  } catch (_) {}

  return {};
}

function salvarCacheCorridaPassageiro(corrida) {
  try {
    const statusNorm = normalizarStatusCorrida(corrida?.status);
    if (!corrida || !corrida.id || !STATUS_ATIVOS_MAPA_CORRIDA.includes(statusNorm)) {
      localStorage.removeItem('mobiurb_corrida_ativa_passageiro');
      window.corridaAtivaPassageiro = null;
      return;
    }
    window.corridaAtivaPassageiro = corrida;
    window.corridaAtivaDados = corrida;
    window.corridaAtualId = corrida.id;
    localStorage.setItem('mobiurb_corrida_ativa_passageiro', JSON.stringify({
      passageiro_id: corrida.passageiro_id || null,
      corrida
    }));
  } catch (_) {}
}

function obterIdsCorridasAvaliadas() {
  try {
    const raw = localStorage.getItem('corridas_avaliadas_passageiro');
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.map(String) : [];
  } catch (_) {
    return [];
  }
}

function marcarCorridaComoAvaliadaLocal(id) {
  if (id === undefined || id === null) return;
  const idStr = String(id);
  const lista = obterIdsCorridasAvaliadas();
  if (!lista.includes(idStr)) {
    lista.push(idStr);
    localStorage.setItem('corridas_avaliadas_passageiro', JSON.stringify(lista));
  }
}

function corridaJaFoiAvaliada(corrida) {
  if (!corrida) return true;
  const jaTemNotaNoBanco = corrida.avaliacao_passageiro !== null && corrida.avaliacao_passageiro !== undefined;
  const jaAvaliadaLocal = obterIdsCorridasAvaliadas().includes(String(corrida.id));
  return jaTemNotaNoBanco || jaAvaliadaLocal;
}

async function buscarDadosMotoristaAtual(corrida) {
  const cliente = obterClienteSupabaseMapa();
  const motoristaId = corrida?.motorista_id || corrida?.motorista?.id || null;

  let base = corrida?.motorista && typeof corrida.motorista === 'object'
    ? { ...corrida.motorista }
    : {};

  if (motoristaId && cliente) {
    try {
      const { data: motRow } = await cliente
        .from('usuarios')
        .select('id, nome, foto_url, avaliacao, nota')
        .eq('id', motoristaId)
        .maybeSingle();

      if (motRow) {
        base = {
          ...base,
          id: motRow.id || motoristaId,
          nome: motRow.nome || base.nome || 'Motorista Parceiro',
          foto_url: motRow.foto_url || base.foto_url || '',
          avaliacao: motRow.avaliacao ?? motRow.nota ?? base.avaliacao ?? base.nota ?? 5.0,
          nota: motRow.nota ?? motRow.avaliacao ?? base.nota ?? base.avaliacao ?? 5.0
        };
      }
    } catch (_) {}
  }

  const nomeFinal = String(base.nome || 'Motorista Parceiro').trim();
  const nomeCurto = obterNomeCurtoMotorista(nomeFinal);
  const fotoUrl = String(base.foto_url || '').trim();
  const fotoFinal = fotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeCurto)}&background=059669&color=ffffff`;
  const rawNota = Number(base.avaliacao ?? base.nota ?? 5);
  const notaFinal = Number.isFinite(rawNota) ? rawNota.toFixed(1) : '5.0';

  return {
    id: base.id || motoristaId || null,
    nome: nomeFinal,
    nomeCurto,
    foto_url: fotoFinal,
    avaliacao: notaFinal,
    nota: notaFinal
  };
}

function atualizarIlustracaoJornada(statusCorrida) {
  const containerIlustracao = document.getElementById('container-ilustracao-jornada');
  if (!containerIlustracao) return;

  containerIlustracao.classList.remove('hidden');

  const statusNorm = normalizarStatusCorrida(statusCorrida);
  const viagemEmAndamento = statusEhViagemIniciada(statusNorm);

  if (viagemEmAndamento) {
    containerIlustracao.innerHTML = `
      <i class="fa-solid fa-house text-sky-400 text-base" title="Início do Trajeto"></i>
      <div class="flex-1 border-t-2 border-dashed border-emerald-500/50 relative flex items-center justify-center">
        <i class="fa-solid fa-car text-emerald-400 absolute bg-slate-950 px-1 text-xs"></i>
      </div>
      <i class="fa-solid fa-flag-checkered text-amber-400 text-base" title="Destino Final"></i>
    `;
  } else {
    containerIlustracao.innerHTML = `
      <i class="fa-solid fa-car text-emerald-400 text-base" title="Motorista a Caminho"></i>
      <div class="flex-1 border-t-2 border-dashed border-emerald-500/50 relative flex items-center justify-center">
        <i class="fa-solid fa-arrow-right text-emerald-500/80 absolute bg-slate-950 px-1 text-[10px]"></i>
      </div>
      <i class="fa-solid fa-house text-sky-400 text-base" title="Local de Embarque"></i>
    `;
  }
}

async function verificarCorridaAtivaPassageiro() {
  const dadosUsuario = obterPassageiroLogadoSeguro();
  const cliente = obterClienteSupabaseMapa();
  if (!dadosUsuario.id || !cliente) return null;

  try {
    const { data, error } = await cliente
      .from('corridas')
      .select('*')
      .eq('passageiro_id', dadosUsuario.id)
      .order('id', { ascending: false })
      .limit(5);

    if (error || !Array.isArray(data) || data.length === 0) {
      salvarCacheCorridaPassageiro(null);
      return null;
    }

    const corrida = data.find((item) => {
      const st = normalizarStatusCorrida(item?.status);
      return STATUS_ATIVOS_MAPA_CORRIDA.includes(st) || STATUS_FINALIZADOS_MAPA_CORRIDA.includes(st);
    });

    if (!corrida) {
      salvarCacheCorridaPassageiro(null);
      return null;
    }

    const statusNorm = normalizarStatusCorrida(corrida.status);
    const corridaConcluida = STATUS_FINALIZADOS_MAPA_CORRIDA.includes(statusNorm);

    if (corridaConcluida) {
      salvarCacheCorridaPassageiro(null);
      if (corridaJaFoiAvaliada(corrida)) {
        resetarPainelCompletoPassageiro(true);
        return null;
      }
      corridaAtualId = corrida.id;
      corridaAtivaDados = corrida;
      await exibirPainelAvaliacaoPassageiro(corrida);
      iniciarEscutaPassageiroRealtime();
      return corrida;
    }

    const motoristaInfo = await buscarDadosMotoristaAtual(corrida);
    corrida.motorista = motoristaInfo;
    corridaAtualId = corrida.id;
    corridaAtivaDados = corrida;
    salvarCacheCorridaPassageiro(corrida);

    if (typeof window.vincularCorridaComunicacaoPassageiro === 'function') {
      await window.vincularCorridaComunicacaoPassageiro(corrida);
    }

    if (statusNorm === 'procurando' || statusNorm === 'pendente') {
      const painelSol = document.getElementById('painel-solicitacao');
      const painelMot = document.getElementById('painel-motorista-encontrado');
      const painelAval = document.getElementById('painel-avaliacao-passageiro');
      const painelEsp = document.getElementById('painel-espera-corrida');
      if (painelSol) { painelSol.classList.add('hidden'); painelSol.style.display = 'none'; }
      if (painelMot) { painelMot.classList.add('hidden'); painelMot.style.display = 'none'; }
      if (painelAval) { painelAval.classList.add('hidden'); painelAval.style.display = 'none'; }
      if (painelEsp) { painelEsp.classList.remove('hidden'); painelEsp.style.display = ''; }
      iniciarTimerEsperaCorrida();
    } else {
      await exibirPainelMotoristaEncontrado(corrida);
    }

    iniciarEscutaPassageiroRealtime();
    return corrida;
  } catch (e) {
    return null;
  }
}

window.verificarCorridaAtivaPassageiro = verificarCorridaAtivaPassageiro;

async function iniciarRadarMotoristasOnline() {
  const cliente = obterClienteSupabaseMapa();
  if (!cliente) return;
  const regras = typeof obterRegrasMapa === 'function'
    ? obterRegrasMapa()
    : { intervalo_radar_ms: 8000, raio_alerta_proximidade_metros: 150 };
  atualizarPosicoesMotoristas();
  if (intervaloRadarMotoristas) clearInterval(intervaloRadarMotoristas);
  intervaloRadarMotoristas = setInterval(atualizarPosicoesMotoristas, regras.intervalo_radar_ms);
}

async function atualizarPosicoesMotoristas() {
  const cliente = obterClienteSupabaseMapa();
  if (!mapaLeaflet || !cliente) return;
  try {
    const { data: motoristas, error } = await cliente
      .from('usuarios')
      .select('id, lat, lng, online')
      .eq('online', true);

    if (error || !motoristas) return;

    const idsAtuais = motoristas.map(m => m.id);

    Object.keys(marcadoresMotoristas).forEach(id => {
      if (!idsAtuais.includes(id)) {
        mapaLeaflet.removeLayer(marcadoresMotoristas[id]);
        delete marcadoresMotoristas[id];
      }
    });

    const iconeCarroMapa = L.divIcon({
      className: 'custom-car-radar',
      html: '<div style="background-color: #10b981; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.6); border: 2px solid #fff;"><i class="fa-solid fa-car text-[10px]"></i></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    motoristas.forEach(m => {
      if (m.lat && m.lng) {
        if (marcadoresMotoristas[m.id]) {
          marcadoresMotoristas[m.id].setLatLng([m.lat, m.lng]);
        } else {
          const marcador = L.marker([m.lat, m.lng], { icon: iconeCarroMapa }).addTo(mapaLeaflet);
          marcadoresMotoristas[m.id] = marcador;
        }
      }
    });

    if (corridaAtualId) {
      const { data: corridaAtual } = await cliente
        .from('corridas')
        .select('motorista_id, status')
        .eq('id', corridaAtualId)
        .single();

      const stAtual = normalizarStatusCorrida(corridaAtual?.status);
      if (corridaAtual && corridaAtual.motorista_id && ['a_caminho', 'aceito', 'aceita'].includes(stAtual)) {
        const motEncontrado = motoristas.find(x => String(x.id) === String(corridaAtual.motorista_id));
        if (motEncontrado && motEncontrado.lat && motEncontrado.lng && coordsOrigem && typeof calcularDistanciaMetros === 'function') {
          const regras = typeof obterRegrasMapa === 'function'
            ? obterRegrasMapa()
            : { raio_alerta_proximidade_metros: 150 };
          const distancia = calcularDistanciaMetros(coordsOrigem.lat, coordsOrigem.lng, motEncontrado.lat, motEncontrado.lng);
          if (distancia <= regras.raio_alerta_proximidade_metros && !ultimaNotificacaoProximidade) {
            ultimaNotificacaoProximidade = true;
            mostrarModal('Motorista Próximo!', `O motorista está a menos de ${regras.raio_alerta_proximidade_metros} metros do seu local de embarque.`, 'sucesso', 4000);
          }
        }
      }
    }
  } catch (err) {}
}

async function chamarMotorista() {
  if (!calculoRotaPronto || valorCalculadoAtual <= 0) {
    mostrarModal('Aguarde o Cálculo', 'Selecione os endereços e aguarde o cálculo do valor antes de chamar.', 'cancelar', 3000);
    return;
  }

  const dadosUsuario = obterPassageiroLogadoSeguro();
  if (!dadosUsuario.id) {
    mostrarModal('Erro de Autenticação', 'Passageiro não identificado. Faça login novamente.', 'cancelar', 2500);
    setTimeout(() => (window.location.href = 'auth.html'), 2500);
    return;
  }

  const clienteSupabaseAtivo = obterClienteSupabaseMapa();
  if (!clienteSupabaseAtivo) {
    mostrarModal('Erro Crítico', 'Conexão com o banco de dados indisponível.', 'cancelar', 3500);
    return;
  }

  const btn = document.getElementById('btn-chamar-motorista');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Chamando motorista...</span>';

  try {
    const { data: usuarioAtualizado } = await clienteSupabaseAtivo
      .from('usuarios')
      .select('status')
      .eq('id', dadosUsuario.id)
      .single();

    if (usuarioAtualizado && (usuarioAtualizado.status === 'bloqueado' || usuarioAtualizado.status === 'pendente')) {
      mostrarModal('Conta Suspensa', 'Sua conta está suspensa ou pendente. Não é possível solicitar viagens.', 'cancelar', 4000);
      atualizarEstadoBotaoChamar('pronto');
      return;
    }
  } catch (e) {}

  const origem = document.getElementById('origem-corrida').value.trim();
  const destino = document.getElementById('destino-corrida').value.trim();
  const paradasValidas = typeof obterListaParadasValidas === 'function' ? obterListaParadasValidas() : [];
  const paradaTexto = paradasValidas.length > 0 ? paradasValidas.map(p => p.texto).join(' | ') : null;

  if (!origem || !destino) {
    mostrarModal('Campos Incompletos', 'Por favor, preencha a origem e o destino.', 'cancelar', 3500);
    atualizarEstadoBotaoChamar('bloqueado');
    return;
  }

  const payloadCorrida = {
    passageiro_id: dadosUsuario.id,
    origem,
    destino,
    valor: Number(valorCalculadoAtual.toFixed(2)),
    forma_pagamento: String(formaPagamentoSelecionada || 'PIX'),
    status: 'procurando'
  };

  if (paradaTexto) {
    payloadCorrida.parada = paradaTexto;
  }

  const { data, error } = await clienteSupabaseAtivo.from('corridas').insert([payloadCorrida]).select().single();

  if (error) {
    mostrarModal('Erro', 'Erro ao solicitar corrida: ' + error.message, 'cancelar', 4000);
    atualizarEstadoBotaoChamar('pronto');
  } else {
    corridaAtualId = data.id;
    corridaAtivaDados = data;
    salvarCacheCorridaPassageiro(data);
    const painelSol = document.getElementById('painel-solicitacao');
    const painelEsp = document.getElementById('painel-espera-corrida');
    if (painelSol) { painelSol.classList.add('hidden'); painelSol.style.display = 'none'; }
    if (painelEsp) { painelEsp.classList.remove('hidden'); painelEsp.style.display = ''; }

    if (typeof window.vincularCorridaComunicacaoPassageiro === 'function') {
      await window.vincularCorridaComunicacaoPassageiro(data);
    }

    mostrarModal('Buscando Motorista', 'Sua solicitação foi enviada aos motoristas próximos.', 'sucesso', 3500);
    iniciarTimerEsperaCorrida();
    iniciarEscutaPassageiroRealtime();
  }
}

function iniciarEscutaPassageiroRealtime() {
  const cliente = obterClienteSupabaseMapa();
  if (!corridaAtualId || !cliente) return;
  if (canalPassageiroRealtime) cliente.removeChannel(canalPassageiroRealtime);

  canalPassageiroRealtime = cliente
    .channel(`public:corridas_passageiro:${corridaAtualId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${corridaAtualId}` }, async payload => {
      if (payload.new) {
        const corridaAtualizada = payload.new;
        const statusNorm = normalizarStatusCorrida(corridaAtualizada.status);
        corridaAtivaDados = { ...(corridaAtivaDados || {}), ...corridaAtualizada };

        if (STATUS_ATIVOS_MAPA_CORRIDA.includes(statusNorm) && statusNorm !== 'procurando' && statusNorm !== 'pendente') {
          const motoristaInfo = await buscarDadosMotoristaAtual(corridaAtivaDados);
          corridaAtualizada.motorista = motoristaInfo;
          corridaAtivaDados = corridaAtualizada;
          salvarCacheCorridaPassageiro(corridaAtualizada);
          await exibirPainelMotoristaEncontrado(corridaAtualizada);
        } else if (STATUS_FINALIZADOS_MAPA_CORRIDA.includes(statusNorm)) {
          salvarCacheCorridaPassageiro(null);
          if (!corridaJaFoiAvaliada(corridaAtualizada)) {
            await exibirPainelAvaliacaoPassageiro(corridaAtualizada);
          } else {
            resetarPainelCompletoPassageiro(true);
          }
        } else if (STATUS_CANCELADOS_MAPA_CORRIDA.includes(statusNorm)) {
          salvarCacheCorridaPassageiro(null);
          tocarSom('cancelar');
          const msgAviso = corridaAtualizada.encerrado_por_admin
            ? 'A viagem foi encerrada pela administração.'
            : 'A corrida foi encerrada ou cancelada.';
          mostrarModal('Aviso', msgAviso, 'cancelar', 3500);
          resetarPainelCompletoPassageiro(true);
        }
      }
    })
    .subscribe();
}

async function exibirPainelMotoristaEncontrado(corrida) {
  if (timerIntervalId) clearInterval(timerIntervalId);
  const painelEsp = document.getElementById('painel-espera-corrida');
  const painelSol = document.getElementById('painel-solicitacao');
  const painelAval = document.getElementById('painel-avaliacao-passageiro');
  if (painelEsp) { painelEsp.classList.add('hidden'); painelEsp.style.display = 'none'; }
  if (painelSol) { painelSol.classList.add('hidden'); painelSol.style.display = 'none'; }
  if (painelAval) { painelAval.classList.add('hidden'); painelAval.style.display = 'none'; }

  const painelMotorista = document.getElementById('painel-motorista-encontrado');
  if (painelMotorista) {
    painelMotorista.classList.remove('hidden');
    painelMotorista.style.display = '';
  }

  const motorista = await buscarDadosMotoristaAtual(corrida);
  corridaAtivaDados = { ...(corridaAtivaDados || {}), ...corrida, motorista };
  corridaAtualId = corridaAtivaDados.id || corridaAtualId;
  salvarCacheCorridaPassageiro(corridaAtivaDados);

  if (typeof window.vincularCorridaComunicacaoPassageiro === 'function') {
    await window.vincularCorridaComunicacaoPassageiro(corridaAtivaDados);
  }

  const nomeExibido = motorista.nomeCurto || obterNomeCurtoMotorista(motorista.nome);
  const nomeEl = document.getElementById('passageiro-motorista-nome');
  const fotoEl = document.getElementById('passageiro-motorista-foto');
  const notaEl = document.getElementById('passageiro-motorista-nota');

  if (nomeEl) nomeEl.innerText = nomeExibido;
  if (fotoEl) {
    fotoEl.onerror = function () {
      this.onerror = null;
      this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeExibido)}&background=059669&color=ffffff`;
    };
    fotoEl.src = motorista.foto_url;
  }
  if (notaEl) notaEl.innerText = motorista.avaliacao;

  const destinoEl = document.getElementById('pass-ativa-destino');
  if (destinoEl) destinoEl.innerText = corrida.destino || corrida.destino_endereco || '-';

  const blocoParadaAtiva = document.getElementById('bloco-parada-ativa-container');
  const paradaEl = document.getElementById('pass-ativa-parada');
  const textoParada = corrida.parada || corrida.parada_endereco || '';
  if (textoParada) {
    if (paradaEl) paradaEl.innerText = textoParada;
    blocoParadaAtiva?.classList.remove('hidden');
  } else {
    blocoParadaAtiva?.classList.add('hidden');
  }

  const statusNorm = normalizarStatusCorrida(corrida.status);
  const textoStatus = document.getElementById('passageiro-status-viagem-texto');
  const btnCancelarAtivo = document.getElementById('btn-cancelar-passageiro-ativo');
  const blocoEmbarque = document.getElementById('bloco-embarque-container');

  atualizarIlustracaoJornada(statusNorm);

  if (statusEhViagemIniciada(statusNorm)) {
    if (textoStatus) textoStatus.innerText = 'Viagem em andamento';
    btnCancelarAtivo?.classList.add('hidden');
    if (blocoEmbarque) blocoEmbarque.style.display = 'none';
  } else {
    if (textoStatus) {
      textoStatus.innerText = statusNorm === 'no_local'
        ? 'Motorista no local de embarque'
        : 'Motorista a caminho do embarque';
    }
    btnCancelarAtivo?.classList.remove('hidden');
    if (blocoEmbarque) blocoEmbarque.style.display = 'block';
    const origemEl = document.getElementById('pass-ativa-origem');
    if (origemEl) origemEl.innerText = corrida.origem || corrida.origem_endereco || '-';
  }
}

window.exibirPainelMotoristaEncontrado = exibirPainelMotoristaEncontrado;

async function cancelarCorridaPassageiroAtiva() {
  const cliente = obterClienteSupabaseMapa();
  if (!corridaAtualId || !cliente) return;

  const stAtual = normalizarStatusCorrida(corridaAtivaDados?.status);
  if (statusEhViagemIniciada(stAtual)) {
    mostrarModal('Viagem em Andamento', 'Não é possível cancelar após o início da viagem.', 'cancelar', 3000);
    return;
  }

  if (confirm('Deseja realmente cancelar a corrida?')) {
    await cliente.from('corridas').update({ status: 'cancelado' }).eq('id', corridaAtualId);
    salvarCacheCorridaPassageiro(null);
    mostrarModal('Cancelado', 'Sua corrida foi cancelada.', 'cancelar', 3000);
    resetarPainelCompletoPassageiro(true);
  }
}

async function exibirPainelAvaliacaoPassageiro(corrida) {
  if (!corrida || corridaJaFoiAvaliada(corrida)) {
    resetarPainelCompletoPassageiro(true);
    return;
  }

  corridaAtualId = corrida.id;
  corridaAtivaDados = corrida;

  const painelMot = document.getElementById('painel-motorista-encontrado');
  const painelEsp = document.getElementById('painel-espera-corrida');
  const painelSol = document.getElementById('painel-solicitacao');
  if (painelMot) { painelMot.classList.add('hidden'); painelMot.style.display = 'none'; }
  if (painelEsp) { painelEsp.classList.add('hidden'); painelEsp.style.display = 'none'; }
  if (painelSol) { painelSol.classList.add('hidden'); painelSol.style.display = 'none'; }

  const valorNum = Number(corrida.valor ?? corrida.valor_total ?? 15.0);
  const valorExibido = Number.isFinite(valorNum) ? valorNum : 15.0;
  const valorEl = document.getElementById('passageiro-valor-final');
  if (valorEl) {
    valorEl.innerText = `R$ ${valorExibido.toFixed(2).replace('.', ',')}`;
  }

  passageiroSelecionarEstrela(5);
  const motivoEl = document.getElementById('passageiro-input-motivo-negativo');
  if (motivoEl) motivoEl.value = '';

  const painelAvaliacao = document.getElementById('painel-avaliacao-passageiro');
  if (painelAvaliacao) {
    painelAvaliacao.classList.remove('hidden');
    painelAvaliacao.style.display = '';
  }
}

window.exibirPainelAvaliacaoPassageiro = exibirPainelAvaliacaoPassageiro;

function passageiroSelecionarEstrela(nota) {
  passageiroNotaSelecionada = nota;
  const estrelas = document.querySelectorAll('#passageiro-container-estrelas i');
  const textoNota = document.getElementById('passageiro-texto-feedback');
  const blocoJustificativa = document.getElementById('passageiro-bloco-justificativa');

  estrelas.forEach((star, index) => {
    if (index < nota) {
      star.classList.remove('text-slate-600');
      star.classList.add('text-amber-400');
    } else {
      star.classList.remove('text-amber-400');
      star.classList.add('text-slate-600');
    }
  });

  if (textoNota) {
    if (nota === 5) {
      textoNota.innerText = 'Excelente (5 estrelas)';
    } else if (nota === 4) {
      textoNota.innerText = 'Bom (4 estrelas)';
    } else if (nota === 3) {
      textoNota.innerText = 'Regular (3 estrelas)';
    } else {
      textoNota.innerText = 'Ruim / Muito Ruim';
    }
  }

  if (nota < 5) {
    blocoJustificativa?.classList.remove('hidden');
  } else {
    blocoJustificativa?.classList.add('hidden');
  }
}

async function passageiroConcluirAvaliacao() {
  const cliente = obterClienteSupabaseMapa();
  if (enviandoAvaliacaoPassageiro) return;

  const idAlvo = corridaAtualId || corridaAtivaDados?.id;
  if (!idAlvo) {
    resetarPainelCompletoPassageiro(true);
    return;
  }

  if (obterIdsCorridasAvaliadas().includes(String(idAlvo))) {
    resetarPainelCompletoPassageiro(true);
    return;
  }

  const motivo = (document.getElementById('passageiro-input-motivo-negativo')?.value || '').trim();
  if (passageiroNotaSelecionada < 5 && !motivo) {
    mostrarModal('Atenção', 'Por favor, informe o motivo da avaliação baixa.', 'cancelar', 3000);
    return;
  }

  enviandoAvaliacaoPassageiro = true;

  try {
    if (cliente) {
      const { error } = await cliente
        .from('corridas')
        .update({
          avaliacao_passageiro: passageiroNotaSelecionada,
          motivo_avaliacao_passageiro: motivo || null
        })
        .eq('id', idAlvo);

      if (error) {
        enviandoAvaliacaoPassageiro = false;
        mostrarModal('Erro', 'Erro ao enviar avaliação.', 'cancelar', 3000);
        return;
      }

      if (passageiroNotaSelecionada < 5) {
        const dadosUsuario = obterPassageiroLogadoSeguro();
        if (dadosUsuario.id) {
          await cliente.from('mensagens_suporte_app').insert([{
            usuario_id: String(dadosUsuario.id),
            mensagem: `[Relato de Nota Baixa - Corrida #${idAlvo}] Nota: ${passageiroNotaSelecionada} estrelas. Motivo: ${motivo}`,
            remetente: 'passageiro',
            lido: false
          }]);
        }
      }
    }

    marcarCorridaComoAvaliadaLocal(idAlvo);
    salvarCacheCorridaPassageiro(null);
    enviandoAvaliacaoPassageiro = false;
    mostrarModal('Obrigado', 'Avaliação enviada com sucesso!', 'sucesso', 2500);
    resetarPainelCompletoPassageiro(true);
  } catch (e) {
    enviandoAvaliacaoPassageiro = false;
    mostrarModal('Erro', 'Erro ao enviar avaliação.', 'cancelar', 3000);
  }
}

function resetarPainelCompletoPassageiro(manterLocalizacao = false) {
  if (timerIntervalId) clearInterval(timerIntervalId);
  const cliente = obterClienteSupabaseMapa();
  if (canalPassageiroRealtime && cliente) {
    try { cliente.removeChannel(canalPassageiroRealtime); } catch (_) {}
    canalPassageiroRealtime = null;
  }
  if (typeof window.fecharChatCorrida === 'function') window.fecharChatCorrida();
  if (typeof window.encerrarChamadaP2P === 'function') window.encerrarChamadaP2P(false);

  corridaAtualId = null;
  corridaAtivaDados = null;
  salvarCacheCorridaPassageiro(null);
  ultimaNotificacaoProximidade = false;
  coordsDestino = null;
  coordsParadas = {};
  valorCalculadoAtual = 0;

  const painelAvaliacao = document.getElementById('painel-avaliacao-passageiro');
  if (painelAvaliacao) {
    painelAvaliacao.classList.add('hidden');
    painelAvaliacao.style.display = 'none';
  }
  const painelEsp = document.getElementById('painel-espera-corrida');
  if (painelEsp) {
    painelEsp.classList.add('hidden');
    painelEsp.style.display = 'none';
  }
  const painelMot = document.getElementById('painel-motorista-encontrado');
  if (painelMot) {
    painelMot.classList.add('hidden');
    painelMot.style.display = 'none';
  }
  const painelSol = document.getElementById('painel-solicitacao');
  if (painelSol) {
    painelSol.classList.remove('hidden');
    painelSol.style.display = '';
  }

  const destinoInput = document.getElementById('destino-corrida');
  if (destinoInput) destinoInput.value = '';
  const containerParadas = document.getElementById('container-paradas');
  if (containerParadas) containerParadas.innerHTML = '';
  document.getElementById('bloco-estimativa')?.classList.add('hidden');

  if (marcadorDestino && mapaLeaflet) {
    mapaLeaflet.removeLayer(marcadorDestino);
    marcadorDestino = null;
  }
  Object.values(marcadoresParadas).forEach(m => {
    if (mapaLeaflet) mapaLeaflet.removeLayer(m);
  });
  marcadoresParadas = {};

  if (polylineRota && mapaLeaflet) {
    mapaLeaflet.removeLayer(polylineRota);
    polylineRota = null;
  }

  atualizarEstadoBotaoChamar('bloqueado');
  if (!manterLocalizacao && typeof usarMinhaLocalizacao === 'function') {
    usarMinhaLocalizacao(true);
  }
}

window.resetarPainelCompletoPassageiro = resetarPainelCompletoPassageiro;

function formatarSegundosHHMM(segundos) {
  const totalSeg = Math.max(0, Math.round(Number(segundos) || 0));
  const totalMin = Math.round(totalSeg / 60);
  const horas = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function iniciarTimerEsperaCorrida() {
  const regras = typeof obterRegrasMapa === 'function'
    ? obterRegrasMapa()
    : { tempo_espera_segundos: 180 };
  let tempoRestante = regras.tempo_espera_segundos;
  const display = document.getElementById('timer-regressivo');
  const cliente = obterClienteSupabaseMapa();

  if (timerIntervalId) clearInterval(timerIntervalId);

  const atualizarDisplay = () => {
    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;
    if (display) {
      display.innerText = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    }
  };

  atualizarDisplay();

  timerIntervalId = setInterval(async () => {
    tempoRestante--;
    atualizarDisplay();

    if (tempoRestante <= 0) {
      clearInterval(timerIntervalId);
      const tempoFormatado = formatarSegundosHHMM(regras.tempo_espera_segundos);
      mostrarModal('Tempo Esgotado', `Tempo limite de ${tempoFormatado} esgotado sem motoristas aceitarem.`, 'cancelar', 4000);

      if (corridaAtualId && cliente) {
        await cliente.from('corridas').update({ status: 'expirado' }).eq('id', corridaAtualId);
      }
      salvarCacheCorridaPassageiro(null);
      resetarPainelCompletoPassageiro(true);
    }
  }, 1000);
}

async function cancelarBuscaCorrida() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  const cliente = obterClienteSupabaseMapa();

  if (corridaAtualId && cliente) {
    await cliente.from('corridas').update({ status: 'cancelado' }).eq('id', corridaAtualId);
  }

  salvarCacheCorridaPassageiro(null);
  mostrarModal('Cancelado', 'Corrida cancelada com sucesso.', 'cancelar', 3000);
  resetarPainelCompletoPassageiro(true);
}